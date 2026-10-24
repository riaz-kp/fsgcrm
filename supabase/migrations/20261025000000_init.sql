-- FSG Practice Manager: the database behind the app.
--
-- One table per list the app keeps (clients, tasks, the filing trackers…). Columns are the app's field
-- names in snake_case; lists inside a record (remarks, documents, the fee ledger) are jsonb.
-- Every table is behind row level security: only a signed-in, active team member sees anything, and
-- what they may change follows the permissions set for them in Settings (see has_perm).
--
-- Portal passwords never sit in a public table. Usernames are in client_logins; the passwords are
-- encrypted with a key kept in Supabase Vault and only reach people allowed to see them, through
-- save_client_logins and client_login_passwords.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

/* ---------- Shared triggers ---------- */

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

/* ---------- Team ---------- */

create table public.employees (
  seq bigint generated always as identity,
  id text primary key,
  -- The sign-in that is this person. Filled in when they sign up with the email below.
  user_id uuid unique references auth.users (id) on delete set null,
  name text not null,
  title text not null default '',
  role text not null check (role in ('ceo', 'head', 'trainee', 'staff')),
  reports_to text references public.employees (id) on delete set null,
  responsibilities text[] not null default '{}',
  phone text not null default '',
  email text not null default '',
  hue integer not null default 212,
  active boolean not null default true,
  joined date,
  dob date,
  address text,
  blood_group text check (blood_group in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  qualification text,
  family jsonb,
  photo text,
  -- Null means "what the role gives"; see role_permissions.
  permissions text[],
  origin text,
  updated_at timestamptz not null default now()
);

create unique index employees_email_key on public.employees (lower(email)) where email <> '';
create index employees_reports_to_idx on public.employees (reports_to);

/** What each role may do until someone sets permissions person by person. Mirrors ROLE_PERMISSIONS in src/lib/meta.ts. */
create or replace function public.role_permissions(r text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case
    when r in ('ceo', 'head') then array['assign_tasks', 'edit_clients', 'view_logins', 'view_fees', 'consultations', 'manage_attendance', 'view_team', 'edit_team', 'settings']
    else array['edit_clients', 'view_logins', 'view_fees']
  end
$$;

/** The team member who is signed in, if they are active. */
create or replace function public.current_employee_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.employees where user_id = auth.uid() and active
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.employees where user_id = auth.uid() and active)
$$;

create or replace function public.has_perm(p text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.employees e
    where e.user_id = auth.uid() and e.active and p = any (coalesce(e.permissions, public.role_permissions(e.role)))
  )
$$;

/**
 * Keeps the columns that decide who can do what out of reach of the wrong people. Changes made outside the
 * app (the SQL editor, the service key) have no signed-in user and pass.
 */
create or replace function public.guard_employee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.user_id is not null then
      raise exception 'A sign-in is linked when the person signs up, not from the app' using errcode = '42501';
    end if;
    if new.permissions is not null and not public.has_perm('settings') then
      raise exception 'Only people who may change settings can set permissions' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.user_id is distinct from old.user_id then
    raise exception 'A sign-in is linked when the person signs up, not from the app' using errcode = '42501';
  end if;
  if new.permissions is distinct from old.permissions and not public.has_perm('settings') then
    raise exception 'Only people who may change settings can change permissions' using errcode = '42501';
  end if;
  if (new.role is distinct from old.role or new.active is distinct from old.active or new.email is distinct from old.email)
     and not public.has_perm('edit_team') then
    raise exception 'Only people who may edit the team can change a role, email or active status' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger employees_guard before insert or update on public.employees
  for each row execute function public.guard_employee();
create trigger employees_updated_at before update on public.employees
  for each row execute function public.set_updated_at();

/**
 * Sign-ups are open only to the team: the new sign-in is linked to the active team member with the same
 * email, and an email nobody added in Team is turned away.
 */
create or replace function public.link_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.employees
     set user_id = new.id
   where email <> '' and lower(email) = lower(new.email) and active and user_id is null;
  if not found then
    raise exception 'This email is not registered with the firm. Ask a head to add it in Team.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.link_new_user();

/* ---------- Settings ---------- */

create table public.scopes (
  seq bigint generated always as identity,
  key text primary key,
  label text not null,
  short text not null,
  scope_group text not null,
  tracker text check (tracker in ('gst', 'tds', 'it', 'audit', 'services')),
  detail_hint text,
  builtin boolean not null default false,
  origin text,
  updated_at timestamptz not null default now()
);

create trigger scopes_updated_at before update on public.scopes
  for each row execute function public.set_updated_at();

create table public.templates (
  key text primary key check (key in ('status', 'requirements')),
  text text not null,
  origin text,
  updated_at timestamptz not null default now()
);

create trigger templates_updated_at before update on public.templates
  for each row execute function public.set_updated_at();

/* ---------- Clients ---------- */

create sequence public.client_code_seq start 1001;

create table public.clients (
  seq bigint generated always as identity,
  id text primary key,
  code text not null unique,
  name text not null,
  category text not null check (category in ('Company', 'LLP', 'Individual', 'Proprietorship', 'Partnership', 'Trust')),
  profession text,
  business text not null default '',
  place text not null default '',
  phone text not null default '',
  whatsapp text,
  email text not null default '',
  gstin text,
  pan text,
  tan text,
  gst_frequency text check (gst_frequency in ('M', 'Q')),
  active boolean not null default true,
  scopes text[] not null default '{}',
  scope_details jsonb,
  documents jsonb not null default '[]',
  requirements_sent jsonb not null default '{}',
  clarifications jsonb not null default '[]',
  transactions jsonb not null default '[]',
  since date not null default current_date,
  origin text,
  updated_at timestamptz not null default now()
);

/** Two people adding a client at once would both pick the next code; the second one gets the code after. */
create or replace function public.assign_client_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  while new.code is null or new.code = '' or exists (select 1 from public.clients where code = new.code) loop
    new.code := 'FSG-' || nextval('public.client_code_seq');
  end loop;
  return new;
end;
$$;

create trigger clients_code before insert on public.clients
  for each row execute function public.assign_client_code();
create trigger clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

create table public.client_logins (
  client_id text not null references public.clients (id) on delete cascade,
  portal text not null check (portal in ('gst', 'eway', 'it', 'tds', 'traces_deductor', 'traces_taxpayer')),
  username text not null,
  position integer not null default 0,
  origin text,
  updated_at timestamptz not null default now(),
  primary key (client_id, portal)
);

create table private.client_login_secrets (
  client_id text not null,
  portal text not null,
  password_enc bytea not null,
  primary key (client_id, portal),
  foreign key (client_id, portal) references public.client_logins (client_id, portal) on delete cascade
);

alter table private.client_login_secrets enable row level security;

-- The key the passwords are encrypted with. It lives in Vault, apart from the data it protects.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'client_logins_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'base64'), 'client_logins_key', 'Encrypts client portal passwords');
  end if;
end;
$$;

/** Replace a client's portal logins. Only people who may see passwords may change them. */
create or replace function public.save_client_logins(p_client_id text, p_logins jsonb, p_origin text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
begin
  if not public.has_perm('view_logins') then
    raise exception 'You do not have access to portal logins' using errcode = '42501';
  end if;
  if jsonb_typeof(p_logins) <> 'array' then
    raise exception 'Logins must be a list' using errcode = '22023';
  end if;
  select decrypted_secret into k from vault.decrypted_secrets where name = 'client_logins_key';

  delete from public.client_logins
   where client_id = p_client_id
     and portal not in (select x ->> 'portal' from jsonb_array_elements(p_logins) x);

  insert into public.client_logins (client_id, portal, username, position, origin)
  select p_client_id, x ->> 'portal', x ->> 'username', (n - 1)::integer, p_origin
    from jsonb_array_elements(p_logins) with ordinality as t (x, n)
  on conflict (client_id, portal) do update
    set username = excluded.username, position = excluded.position, origin = excluded.origin, updated_at = now();

  insert into private.client_login_secrets (client_id, portal, password_enc)
  select p_client_id, x ->> 'portal', extensions.pgp_sym_encrypt(coalesce(x ->> 'password', ''), k)
    from jsonb_array_elements(p_logins) x
  on conflict (client_id, portal) do update set password_enc = excluded.password_enc;
end;
$$;

/** Decrypted passwords, for one client or all of them, for people who may see them; nothing for anyone else. */
create or replace function public.client_login_passwords(p_client_id text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k text;
  out jsonb;
begin
  if not public.has_perm('view_logins') then
    return '[]'::jsonb;
  end if;
  select decrypted_secret into k from vault.decrypted_secrets where name = 'client_logins_key';
  select coalesce(jsonb_agg(jsonb_build_object(
           'client_id', s.client_id,
           'portal', s.portal,
           'password', extensions.pgp_sym_decrypt(s.password_enc, k))), '[]'::jsonb)
    into out
    from private.client_login_secrets s
   where p_client_id is null or s.client_id = p_client_id;
  return out;
end;
$$;

/* ---------- Leads & tasks ---------- */

create table public.leads (
  seq bigint generated always as identity,
  id text primary key,
  name text not null,
  contact text not null default '',
  phone text not null default '',
  whatsapp text,
  place text not null default '',
  source text not null default '',
  category text not null check (category in ('Company', 'LLP', 'Individual', 'Proprietorship', 'Partnership', 'Trust')),
  scopes text[] not null default '{}',
  scope_details jsonb,
  status text not null check (status in ('new', 'followup', 'won', 'lost')),
  owner_id text not null references public.employees (id),
  next_follow_up date,
  created_at date not null default current_date,
  remarks jsonb not null default '[]',
  origin text,
  updated_at timestamptz not null default now()
);

create index leads_owner_id_idx on public.leads (owner_id);
create trigger leads_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

create table public.tasks (
  seq bigint generated always as identity,
  id text primary key,
  title text not null,
  description text,
  client_id text references public.clients (id) on delete set null,
  department text not null check (department in ('gst', 'tds', 'it', 'audit', 'registration', 'bookkeeping', 'general')),
  assignee_id text not null references public.employees (id),
  assigned_by_id text not null references public.employees (id),
  priority text not null check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null check (status in ('to_begin', 'in_progress', 'in_review', 'completed')),
  progress integer not null default 0 check (progress between 0 and 100),
  due_date date not null,
  recurring text check (recurring in ('monthly', 'quarterly', 'yearly')),
  created_at date not null default current_date,
  remarks jsonb not null default '[]',
  origin text,
  updated_at timestamptz not null default now()
);

create index tasks_client_id_idx on public.tasks (client_id);
create index tasks_assignee_id_idx on public.tasks (assignee_id);
create index tasks_assigned_by_id_idx on public.tasks (assigned_by_id);
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

/* ---------- Filing trackers ---------- */

create table public.gst_filings (
  seq bigint generated always as identity,
  id text primary key,
  client_id text not null references public.clients (id) on delete cascade,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  data_type text check (data_type in ('bills', 'tally', 'excel', 'json')),
  data_in date,
  gstr1 text not null check (gstr1 in ('to_begin', 'data_pending', 'in_progress', 'filed', 'nil', 'na')),
  gstr3b text not null check (gstr3b in ('to_begin', 'data_pending', 'in_progress', 'filed', 'nil', 'na')),
  assignee_id text not null references public.employees (id),
  prev_balance numeric(14, 2) not null default 0,
  fee numeric(14, 2) not null default 0,
  received numeric(14, 2) not null default 0,
  remark text not null default '',
  origin text,
  updated_at timestamptz not null default now()
);

create index gst_filings_client_id_idx on public.gst_filings (client_id);
create index gst_filings_assignee_id_idx on public.gst_filings (assignee_id);
create index gst_filings_period_idx on public.gst_filings (period);
create trigger gst_filings_updated_at before update on public.gst_filings
  for each row execute function public.set_updated_at();

create table public.tds_filings (
  seq bigint generated always as identity,
  id text primary key,
  client_id text not null references public.clients (id) on delete cascade,
  fy text not null,
  payments jsonb not null default '{}',
  quarters jsonb not null default '["to_begin", "to_begin", "to_begin", "to_begin"]',
  data_in jsonb not null default '{}',
  assignee_id text not null references public.employees (id),
  fee numeric(14, 2) not null default 0,
  received numeric(14, 2) not null default 0,
  remark text not null default '',
  origin text,
  updated_at timestamptz not null default now()
);

create index tds_filings_client_id_idx on public.tds_filings (client_id);
create index tds_filings_assignee_id_idx on public.tds_filings (assignee_id);
create trigger tds_filings_updated_at before update on public.tds_filings
  for each row execute function public.set_updated_at();

create table public.it_filings (
  seq bigint generated always as identity,
  id text primary key,
  client_id text not null references public.clients (id) on delete cascade,
  ay text not null,
  kind text not null check (kind in ('non_audit', 'audit')),
  status text not null check (status in ('to_begin', 'pending', 'filed', 'completed')),
  data_in date,
  assignee_id text not null references public.employees (id),
  fee numeric(14, 2) not null default 0,
  received numeric(14, 2) not null default 0,
  remark text not null default '',
  done_on date,
  origin text,
  updated_at timestamptz not null default now()
);

create index it_filings_client_id_idx on public.it_filings (client_id);
create index it_filings_assignee_id_idx on public.it_filings (assignee_id);
create trigger it_filings_updated_at before update on public.it_filings
  for each row execute function public.set_updated_at();

create table public.audits (
  seq bigint generated always as identity,
  id text primary key,
  client_id text not null references public.clients (id) on delete cascade,
  fy text not null,
  kind text not null check (kind in ('Tax audit', 'Statutory audit', 'Internal audit', 'Nil audit')),
  status text not null check (status in ('to_begin', 'pending', 'filed', 'completed')),
  reconciliation boolean not null default false,
  data_in date,
  assignee_id text not null references public.employees (id),
  due_date date not null,
  fee numeric(14, 2) not null default 0,
  received numeric(14, 2) not null default 0,
  remark text not null default '',
  done_on date,
  origin text,
  updated_at timestamptz not null default now()
);

create index audits_client_id_idx on public.audits (client_id);
create index audits_assignee_id_idx on public.audits (assignee_id);
create trigger audits_updated_at before update on public.audits
  for each row execute function public.set_updated_at();

create table public.services (
  seq bigint generated always as identity,
  id text primary key,
  party text not null,
  client_id text references public.clients (id) on delete set null,
  kind text not null check (kind in (
    'GST registration', 'MSME registration', 'LLP incorporation', 'Company incorporation', 'Partnership formation',
    'Trademark', 'FSSAI', 'DSC', 'Legal metrology', 'Certification', 'TAN application', 'PAN application', 'Other')),
  details text,
  status text not null check (status in ('to_begin', 'pending', 'filed', 'completed')),
  committed_date date not null,
  data_in date,
  assignee_id text not null references public.employees (id),
  fee numeric(14, 2) not null default 0,
  received numeric(14, 2) not null default 0,
  remark text not null default '',
  done_on date,
  origin text,
  updated_at timestamptz not null default now()
);

create index services_client_id_idx on public.services (client_id);
create index services_assignee_id_idx on public.services (assignee_id);
create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

/* ---------- Consultations, reminders, attendance ---------- */

create table public.consultations (
  seq bigint generated always as identity,
  id text primary key,
  with_name text not null,
  client_id text references public.clients (id) on delete set null,
  date date not null,
  time text not null check (time ~ '^\d{2}:\d{2}$'),
  duration_min integer not null default 30 check (duration_min > 0),
  topic text not null default '',
  mode text not null check (mode in ('In person', 'Phone', 'Video')),
  status text not null check (status in ('scheduled', 'done', 'cancelled')),
  notes text not null default '',
  postponed jsonb,
  origin text,
  updated_at timestamptz not null default now()
);

create index consultations_client_id_idx on public.consultations (client_id);
create index consultations_date_idx on public.consultations (date);
create trigger consultations_updated_at before update on public.consultations
  for each row execute function public.set_updated_at();

create table public.reminders (
  seq bigint generated always as identity,
  id text primary key,
  title text not null,
  note text,
  date date not null,
  repeat text not null check (repeat in ('none', 'monthly', 'yearly')),
  notify_days integer not null default 0 check (notify_days >= 0),
  for_id text references public.employees (id) on delete cascade,
  client_id text references public.clients (id) on delete set null,
  created_by text not null references public.employees (id),
  done text[] not null default '{}',
  origin text,
  updated_at timestamptz not null default now()
);

create index reminders_for_id_idx on public.reminders (for_id);
create index reminders_client_id_idx on public.reminders (client_id);
create index reminders_created_by_idx on public.reminders (created_by);
create trigger reminders_updated_at before update on public.reminders
  for each row execute function public.set_updated_at();

create table public.attendance (
  employee_id text not null references public.employees (id) on delete cascade,
  date date not null,
  mark text not null check (mark in ('P', 'H', 'L')),
  time_in text check (time_in ~ '^\d{2}:\d{2}$'),
  time_out text check (time_out ~ '^\d{2}:\d{2}$'),
  ot_minutes integer check (ot_minutes > 0),
  origin text,
  updated_at timestamptz not null default now(),
  primary key (employee_id, date)
);

create index attendance_date_idx on public.attendance (date);
create trigger attendance_updated_at before update on public.attendance
  for each row execute function public.set_updated_at();

create table public.off_days (
  date date primary key,
  name text not null default '',
  origin text,
  updated_at timestamptz not null default now()
);

create trigger off_days_updated_at before update on public.off_days
  for each row execute function public.set_updated_at();

/* ---------- Access ---------- */

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all functions in schema public from public, anon;
grant execute on function
  public.current_employee_id(),
  public.is_staff(),
  public.has_perm(text),
  public.role_permissions(text),
  public.save_client_logins(text, jsonb, text),
  public.client_login_passwords(text)
to authenticated;

alter table public.employees enable row level security;
alter table public.scopes enable row level security;
alter table public.templates enable row level security;
alter table public.clients enable row level security;
alter table public.client_logins enable row level security;
alter table public.leads enable row level security;
alter table public.tasks enable row level security;
alter table public.gst_filings enable row level security;
alter table public.tds_filings enable row level security;
alter table public.it_filings enable row level security;
alter table public.audits enable row level security;
alter table public.services enable row level security;
alter table public.consultations enable row level security;
alter table public.reminders enable row level security;
alter table public.attendance enable row level security;
alter table public.off_days enable row level security;

-- Team: everyone sees the team; adding and editing people is for those allowed (the trigger guards permissions).
create policy "staff read team" on public.employees for select to authenticated using ((select public.is_staff()));
create policy "edit_team adds people" on public.employees for insert to authenticated with check ((select public.has_perm('edit_team')));
create policy "edit_team or settings edits people" on public.employees for update to authenticated
  using ((select public.has_perm('edit_team')) or (select public.has_perm('settings')))
  with check ((select public.has_perm('edit_team')) or (select public.has_perm('settings')));

-- Settings: read by all, changed by those allowed. Built-in scopes cannot be deleted.
create policy "staff read scopes" on public.scopes for select to authenticated using ((select public.is_staff()));
create policy "settings adds scopes" on public.scopes for insert to authenticated with check ((select public.has_perm('settings')));
create policy "settings edits scopes" on public.scopes for update to authenticated
  using ((select public.has_perm('settings'))) with check ((select public.has_perm('settings')));
create policy "settings deletes own scopes" on public.scopes for delete to authenticated
  using ((select public.has_perm('settings')) and not builtin);

create policy "staff read templates" on public.templates for select to authenticated using ((select public.is_staff()));
create policy "settings adds templates" on public.templates for insert to authenticated with check ((select public.has_perm('settings')));
create policy "settings edits templates" on public.templates for update to authenticated
  using ((select public.has_perm('settings'))) with check ((select public.has_perm('settings')));
create policy "settings resets templates" on public.templates for delete to authenticated using ((select public.has_perm('settings')));

-- Clients, leads and the trackers are worked on by the whole team: converting a lead, logging a call,
-- marking requirements sent and updating a filing are open to everyone in the app.
create policy "staff read clients" on public.clients for select to authenticated using ((select public.is_staff()));
create policy "staff add clients" on public.clients for insert to authenticated with check ((select public.is_staff()));
create policy "staff edit clients" on public.clients for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- Usernames show to everyone; changes go through save_client_logins.
create policy "staff read logins" on public.client_logins for select to authenticated using ((select public.is_staff()));

create policy "staff read leads" on public.leads for select to authenticated using ((select public.is_staff()));
create policy "staff add leads" on public.leads for insert to authenticated with check ((select public.is_staff()));
create policy "staff edit leads" on public.leads for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- Tasks: those who assign work create tasks; the assignee, the assigner and anyone who assigns work update them.
create policy "staff read tasks" on public.tasks for select to authenticated using ((select public.is_staff()));
create policy "assign_tasks adds tasks" on public.tasks for insert to authenticated
  with check ((select public.has_perm('assign_tasks')) and assigned_by_id = (select public.current_employee_id()));
create policy "people on the task edit it" on public.tasks for update to authenticated
  using (
    (select public.has_perm('assign_tasks'))
    or assignee_id = (select public.current_employee_id())
    or assigned_by_id = (select public.current_employee_id())
  )
  with check ((select public.is_staff()));

create policy "staff read gst" on public.gst_filings for select to authenticated using ((select public.is_staff()));
create policy "staff add gst" on public.gst_filings for insert to authenticated with check ((select public.is_staff()));
create policy "staff edit gst" on public.gst_filings for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create policy "staff read tds" on public.tds_filings for select to authenticated using ((select public.is_staff()));
create policy "staff add tds" on public.tds_filings for insert to authenticated with check ((select public.is_staff()));
create policy "staff edit tds" on public.tds_filings for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create policy "staff read it" on public.it_filings for select to authenticated using ((select public.is_staff()));
create policy "staff add it" on public.it_filings for insert to authenticated with check ((select public.is_staff()));
create policy "staff edit it" on public.it_filings for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create policy "staff read audits" on public.audits for select to authenticated using ((select public.is_staff()));
create policy "staff add audits" on public.audits for insert to authenticated with check ((select public.is_staff()));
create policy "staff edit audits" on public.audits for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create policy "staff read services" on public.services for select to authenticated using ((select public.is_staff()));
create policy "staff add services" on public.services for insert to authenticated with check ((select public.is_staff()));
create policy "staff edit services" on public.services for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- The CEO's diary is only for those given access to it.
create policy "consultations read" on public.consultations for select to authenticated using ((select public.has_perm('consultations')));
create policy "consultations add" on public.consultations for insert to authenticated with check ((select public.has_perm('consultations')));
create policy "consultations edit" on public.consultations for update to authenticated
  using ((select public.has_perm('consultations'))) with check ((select public.has_perm('consultations')));

-- Reminders: everyone's, your own, the ones you made, or all of them if you assign work.
create policy "reminders read" on public.reminders for select to authenticated
  using (
    (select public.is_staff()) and (
      for_id is null
      or for_id = (select public.current_employee_id())
      or created_by = (select public.current_employee_id())
      or (select public.has_perm('assign_tasks'))
    )
  );
create policy "reminders add" on public.reminders for insert to authenticated
  with check (
    created_by = (select public.current_employee_id())
    and (for_id is null or for_id = (select public.current_employee_id()) or (select public.has_perm('assign_tasks')))
  );
-- Anyone who sees a reminder can tick it off.
create policy "reminders edit" on public.reminders for update to authenticated
  using (
    (select public.is_staff()) and (
      for_id is null
      or for_id = (select public.current_employee_id())
      or created_by = (select public.current_employee_id())
      or (select public.has_perm('assign_tasks'))
    )
  )
  with check ((select public.is_staff()));
create policy "reminders delete" on public.reminders for delete to authenticated
  using (created_by = (select public.current_employee_id()) or (select public.has_perm('assign_tasks')));

-- Attendance: your own, or everyone's if you keep attendance or may see colleagues' details.
create policy "attendance read" on public.attendance for select to authenticated
  using (
    employee_id = (select public.current_employee_id())
    or (select public.has_perm('manage_attendance'))
    or (select public.has_perm('view_team'))
  );
create policy "attendance add" on public.attendance for insert to authenticated with check ((select public.has_perm('manage_attendance')));
create policy "attendance edit" on public.attendance for update to authenticated
  using ((select public.has_perm('manage_attendance'))) with check ((select public.has_perm('manage_attendance')));
create policy "attendance clear" on public.attendance for delete to authenticated using ((select public.has_perm('manage_attendance')));

create policy "staff read off days" on public.off_days for select to authenticated using ((select public.is_staff()));
create policy "off days add" on public.off_days for insert to authenticated with check ((select public.has_perm('manage_attendance')));
create policy "off days edit" on public.off_days for update to authenticated
  using ((select public.has_perm('manage_attendance'))) with check ((select public.has_perm('manage_attendance')));
create policy "off days clear" on public.off_days for delete to authenticated using ((select public.has_perm('manage_attendance')));

/* ---------- Files: client documents and call recordings ---------- */

insert into storage.buckets (id, name, public, file_size_limit)
values ('client-files', 'client-files', false, 52428800)
on conflict (id) do nothing;

create policy "staff read client files" on storage.objects for select to authenticated
  using (bucket_id = 'client-files' and (select public.is_staff()));
create policy "staff upload client files" on storage.objects for insert to authenticated
  with check (bucket_id = 'client-files' and (select public.is_staff()));
create policy "staff replace client files" on storage.objects for update to authenticated
  using (bucket_id = 'client-files' and (select public.is_staff()));
create policy "staff remove client files" on storage.objects for delete to authenticated
  using (bucket_id = 'client-files' and (select public.is_staff()));

/* ---------- Live updates ---------- */

alter publication supabase_realtime add table
  public.employees,
  public.scopes,
  public.templates,
  public.clients,
  public.client_logins,
  public.leads,
  public.tasks,
  public.gst_filings,
  public.tds_filings,
  public.it_filings,
  public.audits,
  public.services,
  public.consultations,
  public.reminders,
  public.attendance,
  public.off_days;
