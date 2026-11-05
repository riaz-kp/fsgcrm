-- Round 12: client DSCs, contact persons, working hours and on time, GST data reminders, each person's own
-- email, and a log of who changed what.
--
-- Apply this before the app that goes with it is deployed: the app reads the new columns as soon as it loads.

/* ---------- Clients: a contact person for anyone who is not an individual ---------- */

alter table public.clients add column contact_person text;

/* ---------- Team: working hours, your own email, and never making yourself inactive ---------- */

alter table public.employees add column work_from text check (work_from ~ '^\d{2}:\d{2}$');
alter table public.employees add column work_to text check (work_to ~ '^\d{2}:\d{2}$');

-- The team reads these like the rest of the non-personal columns (see 20261027000000_private_profiles.sql).
grant select (work_from, work_to) on public.employees to authenticated;

-- Logins are by username now, so an email is only for getting in touch: everyone keeps their own up to date.
-- Working hours are set by those who edit the team, like the joining date.
create or replace function public.guard_employee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  had boolean := false;
  has boolean := 'manage_logins' = any (coalesce(new.permissions, public.role_permissions(new.role)));
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    had := 'manage_logins' = any (coalesce(old.permissions, public.role_permissions(old.role)));
  end if;

  if tg_op = 'INSERT' then
    if new.user_id is not null or new.username is not null then
      raise exception 'Logins are given out from Settings → Logins' using errcode = '42501';
    end if;
    if new.permissions is not null and not public.has_perm('settings') then
      raise exception 'Only people who may change settings can set permissions' using errcode = '42501';
    end if;
  else
    if new.user_id is distinct from old.user_id or new.username is distinct from old.username then
      raise exception 'Logins are given out from Settings → Logins' using errcode = '42501';
    end if;
    if new.permissions is distinct from old.permissions and not public.has_perm('settings') then
      raise exception 'Only people who may change settings can change permissions' using errcode = '42501';
    end if;
    if not public.has_perm('edit_team') then
      if (new.id, new.name, new.title, new.role, new.reports_to, new.responsibilities, new.hue, new.active, new.joined, new.work_from, new.work_to)
         is distinct from (old.id, old.name, old.title, old.role, old.reports_to, old.responsibilities, old.hue, old.active, old.joined, old.work_from, old.work_to) then
        raise exception 'Only people who may edit the team can change a name, designation, role, reporting line, joining date, working hours or active status' using errcode = '42501';
      end if;
      if old.id is distinct from public.current_employee_id()
         and (new.phone, new.email, new.dob, new.address, new.blood_group, new.qualification, new.family, new.photo)
             is distinct from (old.phone, old.email, old.dob, old.address, old.blood_group, old.qualification, old.family, old.photo) then
        raise exception 'You can change only your own personal and family details' using errcode = '42501';
      end if;
    end if;
    -- Inactive people cannot sign in, so this would lock the person out.
    if old.active and not new.active and old.user_id = auth.uid() then
      raise exception 'You cannot make yourself inactive' using errcode = '42501';
    end if;
    if had and not has and new.user_id = auth.uid() then
      raise exception 'You cannot take away your own permission to give out logins' using errcode = '42501';
    end if;
  end if;

  -- Whoever can give out logins can do everything, so only someone who already can may pass it on,
  -- whether directly, by a change of role, or by making someone admin or CEO.
  if has is distinct from had and not public.can_manage_logins() then
    raise exception 'Only people allowed to give out logins can grant or remove that permission' using errcode = '42501';
  end if;
  if (tg_op = 'INSERT' or new.role is distinct from old.role)
     and (new.role in ('admin', 'ceo') or (tg_op = 'UPDATE' and old.role in ('admin', 'ceo')))
     and not public.can_manage_logins() then
    raise exception 'Only people allowed to give out logins can make someone admin or CEO, or change their role' using errcode = '42501';
  end if;
  return new;
end;
$$;

/* ---------- Attendance: arrived on time ---------- */

-- Ticked by whoever keeps attendance; the app suggests it from the time in and the person's working hours.
alter table public.attendance add column on_time boolean;

/* ---------- GST: reminding clients whose data has not come in ---------- */

-- The days the client was sent a reminder for this period's data.
alter table public.gst_filings add column data_reminded date[] not null default '{}';

alter table public.templates drop constraint templates_key_check;
alter table public.templates add constraint templates_key_check check (key in ('status', 'requirements', 'gst_data'));

/* ---------- Digital signature certificates ---------- */

-- A client may have none, one, or one per director or partner. Like portal passwords, the DSC password never
-- sits in a public table: it is encrypted with the same Vault key and only reaches people who may see passwords.
create table public.client_dscs (
  seq bigint generated always as identity,
  id text primary key,
  client_id text not null references public.clients (id) on delete cascade,
  holder text not null,
  contact_person text,
  contact_phone text,
  expiry date not null,
  note text,
  position integer not null default 0,
  origin text,
  updated_at timestamptz not null default now()
);

create index client_dscs_client_id_idx on public.client_dscs (client_id);
create index client_dscs_expiry_idx on public.client_dscs (expiry);
create trigger client_dscs_updated_at before update on public.client_dscs
  for each row execute function public.set_updated_at();

create table private.client_dsc_secrets (
  dsc_id text primary key references public.client_dscs (id) on delete cascade,
  password_enc bytea not null
);

alter table private.client_dsc_secrets enable row level security;

/* ---------- Who changed what ---------- */

create table public.change_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  -- Unset for changes made outside the app (the SQL editor, the staff-logins function).
  employee_id text references public.employees (id) on delete set null,
  table_name text not null,
  record_id text not null,
  client_id text,
  action text not null check (action in ('add', 'change', 'remove', 'sign_in')),
  -- What the record was called at the time: the client's name, the task's title, the GST period…
  label text,
  -- Column -> [before, after], or -> null where only the fact of a change is kept (lists, passwords, personal details).
  changes jsonb
);

create index change_log_at_idx on public.change_log (at desc);
create index change_log_record_idx on public.change_log (table_name, record_id, id desc);
create index change_log_client_idx on public.change_log (client_id, id desc) where client_id is not null;
create index change_log_employee_idx on public.change_log (employee_id, id desc);

/**
 * Note a change. One person's run of edits to the same record within two minutes (typing in a tracker cell,
 * say) becomes one entry: the earliest before and the latest after, with fields that went back as they were dropped.
 */
create or replace function private.note_change(p_table text, p_record text, p_client text, p_action text, p_label text, p_changes jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  who text := public.current_employee_id();
  last public.change_log;
  merged jsonb;
  col text;
begin
  if p_action = 'change' then
    select * into last from public.change_log
     where table_name = p_table and record_id = p_record
     order by id desc
     limit 1;
    if found and last.action = 'change' and last.employee_id is not distinct from who and last.at > now() - interval '2 minutes' then
      merged := coalesce(last.changes, '{}'::jsonb);
      for col in select jsonb_object_keys(p_changes) loop
        if merged ? col and merged -> col <> 'null'::jsonb and p_changes -> col <> 'null'::jsonb then
          merged := jsonb_set(merged, array[col], jsonb_build_array(merged -> col -> 0, p_changes -> col -> 1));
        else
          merged := merged || jsonb_build_object(col, p_changes -> col);
        end if;
      end loop;
      select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into merged
        from jsonb_each(merged)
       where value = 'null'::jsonb or value -> 0 is distinct from value -> 1;
      if merged = '{}'::jsonb then
        delete from public.change_log where id = last.id;
      else
        update public.change_log set changes = merged, at = now(), label = coalesce(p_label, label) where id = last.id;
      end if;
      return;
    end if;
  end if;
  insert into public.change_log (employee_id, table_name, record_id, client_id, action, label, changes)
  values (who, p_table, p_record, p_client, p_action, p_label, nullif(p_changes, '{}'::jsonb));
end;
$$;

/** After any write to a table the firm's work is kept in: what changed, by whom. */
create or replace function private.log_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  r jsonb := coalesce(n, o);
  diff jsonb := '{}'::jsonb;
  col text;
  ov jsonb;
  nv jsonb;
begin
  if tg_op <> 'DELETE' then
    for col in select jsonb_object_keys(n) loop
      -- Bookkeeping, and what says which record it is.
      continue when col in ('seq', 'origin', 'updated_at', 'user_id', 'has_login', 'birthday', 'position', 'id', 'client_id')
        or (tg_table_name = 'client_logins' and col = 'portal')
        or (tg_table_name = 'attendance' and col in ('employee_id', 'date'))
        or (tg_table_name = 'off_days' and col = 'date')
        or (tg_table_name = 'scopes' and col = 'key');
      ov := case when o is not null then o -> col end;
      nv := n -> col;
      continue when tg_op = 'UPDATE' and ov is not distinct from nv;
      -- A new record: just what it was given.
      continue when tg_op = 'INSERT' and (nv = 'null'::jsonb or jsonb_typeof(nv) in ('object', 'array') or nv = '""'::jsonb
        or (jsonb_typeof(nv) = 'number' and (nv #>> '{}')::numeric = 0));
      if jsonb_typeof(nv) in ('object', 'array') or jsonb_typeof(ov) in ('object', 'array')
         or col in ('photo', 'dob', 'address', 'blood_group', 'qualification', 'family') then
        -- Lists and personal details: that they changed, not what to.
        diff := diff || jsonb_build_object(col, null);
      else
        if jsonb_typeof(ov) = 'string' and length(ov #>> '{}') > 120 then ov := to_jsonb(left(ov #>> '{}', 117) || '…'); end if;
        if jsonb_typeof(nv) = 'string' and length(nv #>> '{}') > 120 then nv := to_jsonb(left(nv #>> '{}', 117) || '…'); end if;
        diff := diff || jsonb_build_object(col, jsonb_build_array(ov, nv));
      end if;
    end loop;
    if tg_op = 'UPDATE' and diff = '{}'::jsonb then
      return null;
    end if;
  end if;

  perform private.note_change(
    tg_table_name,
    case tg_table_name
      when 'client_logins' then (r ->> 'client_id') || ':' || (r ->> 'portal')
      when 'attendance' then (r ->> 'employee_id') || ':' || (r ->> 'date')
      when 'off_days' then r ->> 'date'
      when 'scopes' then r ->> 'key'
      else r ->> 'id'
    end,
    case tg_table_name when 'clients' then r ->> 'id' else r ->> 'client_id' end,
    case tg_op when 'INSERT' then 'add' when 'UPDATE' then 'change' else 'remove' end,
    case tg_table_name
      when 'clients' then r ->> 'name'
      when 'leads' then r ->> 'name'
      when 'employees' then r ->> 'name'
      when 'tasks' then r ->> 'title'
      when 'client_logins' then r ->> 'portal'
      when 'client_dscs' then r ->> 'holder'
      when 'gst_filings' then r ->> 'period'
      when 'tds_filings' then r ->> 'fy'
      when 'it_filings' then r ->> 'ay'
      when 'audits' then (r ->> 'kind') || ' · FY ' || (r ->> 'fy')
      when 'services' then (r ->> 'kind') || ' · ' || (r ->> 'party')
      when 'attendance' then r ->> 'date'
      when 'off_days' then r ->> 'date'
      when 'scopes' then r ->> 'label'
    end,
    case when tg_op = 'DELETE' then null else diff end
  );
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'employees', 'scopes', 'clients', 'client_logins', 'client_dscs', 'leads', 'tasks',
    'gst_filings', 'tds_filings', 'it_filings', 'audits', 'services', 'attendance', 'off_days'
  ] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.log_change()', t || '_log', t);
  end loop;
end;
$$;

/** The app calls this once a password sign-in succeeds, so the log has who signed in and when. */
create or replace function public.note_sign_in()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.change_log (employee_id, table_name, record_id, action, label)
  select e.id, 'sign_in', e.id, 'sign_in', e.name from public.employees e where e.user_id = auth.uid() and e.active;
$$;

/* ---------- Portal logins and DSCs: saving them, and noting password changes ---------- */

/** As before, and a changed password is noted in the log (that it changed, never what to). */
create or replace function public.save_client_logins(p_client_id text, p_logins jsonb, p_origin text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
  changed jsonb;
begin
  if not public.has_perm('view_logins') then
    raise exception 'You do not have access to portal logins' using errcode = '42501';
  end if;
  if jsonb_typeof(p_logins) <> 'array' then
    raise exception 'Logins must be a list' using errcode = '22023';
  end if;
  select decrypted_secret into k from vault.decrypted_secrets where name = 'client_logins_key';

  for changed in
    select l from jsonb_array_elements(p_logins) l
      join private.client_login_secrets s on s.client_id = p_client_id and s.portal = l ->> 'portal'
     where extensions.pgp_sym_decrypt(s.password_enc, k) is distinct from coalesce(l ->> 'password', '')
  loop
    perform private.note_change('client_logins', p_client_id || ':' || (changed ->> 'portal'), p_client_id, 'change', changed ->> 'portal', jsonb_build_object('password', null));
  end loop;

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

/** Replace a client's DSCs. Only people who may see portal passwords manage them. */
create or replace function public.save_client_dscs(p_client_id text, p_dscs jsonb, p_origin text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
  changed jsonb;
begin
  if not public.has_perm('view_logins') then
    raise exception 'You do not have access to DSCs' using errcode = '42501';
  end if;
  if jsonb_typeof(p_dscs) <> 'array' then
    raise exception 'DSCs must be a list' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_dscs) x
     where coalesce(x ->> 'id', '') = '' or coalesce(btrim(x ->> 'holder'), '') = '' or coalesce(x ->> 'expiry', '') = ''
  ) then
    raise exception 'Each DSC needs a holder and an expiry date' using errcode = '23502';
  end if;
  if exists (select 1 from public.client_dscs d join jsonb_array_elements(p_dscs) x on d.id = x ->> 'id' where d.client_id <> p_client_id) then
    raise exception 'That DSC belongs to another client' using errcode = '42501';
  end if;
  select decrypted_secret into k from vault.decrypted_secrets where name = 'client_logins_key';

  for changed in
    select d from jsonb_array_elements(p_dscs) d
      left join private.client_dsc_secrets s on s.dsc_id = d ->> 'id'
     where exists (select 1 from public.client_dscs c where c.id = d ->> 'id')
       and coalesce(extensions.pgp_sym_decrypt(s.password_enc, k), '') is distinct from coalesce(d ->> 'password', '')
  loop
    perform private.note_change('client_dscs', changed ->> 'id', p_client_id, 'change', btrim(changed ->> 'holder'), jsonb_build_object('password', null));
  end loop;

  delete from public.client_dscs
   where client_id = p_client_id
     and id not in (select x ->> 'id' from jsonb_array_elements(p_dscs) x);

  insert into public.client_dscs (id, client_id, holder, contact_person, contact_phone, expiry, note, position, origin)
  select x ->> 'id', p_client_id, btrim(x ->> 'holder'), nullif(btrim(x ->> 'contact_person'), ''), nullif(btrim(x ->> 'contact_phone'), ''),
         (x ->> 'expiry')::date, nullif(btrim(x ->> 'note'), ''), (n - 1)::integer, p_origin
    from jsonb_array_elements(p_dscs) with ordinality as t (x, n)
  on conflict (id) do update
    set holder = excluded.holder, contact_person = excluded.contact_person, contact_phone = excluded.contact_phone,
        expiry = excluded.expiry, note = excluded.note, position = excluded.position, origin = excluded.origin, updated_at = now();

  delete from private.client_dsc_secrets s
   using jsonb_array_elements(p_dscs) x
   where s.dsc_id = x ->> 'id' and coalesce(x ->> 'password', '') = '';
  insert into private.client_dsc_secrets (dsc_id, password_enc)
  select x ->> 'id', extensions.pgp_sym_encrypt(x ->> 'password', k)
    from jsonb_array_elements(p_dscs) x
   where coalesce(x ->> 'password', '') <> ''
  on conflict (dsc_id) do update set password_enc = excluded.password_enc;
end;
$$;

/** Decrypted DSC passwords, for one client or all of them, for people who may see passwords; nothing for anyone else. */
create or replace function public.client_dsc_passwords(p_client_id text default null)
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
  select coalesce(jsonb_agg(jsonb_build_object('id', s.dsc_id, 'password', extensions.pgp_sym_decrypt(s.password_enc, k))), '[]'::jsonb)
    into out
    from private.client_dsc_secrets s
    join public.client_dscs d on d.id = s.dsc_id
   where p_client_id is null or d.client_id = p_client_id;
  return out;
end;
$$;

/* ---------- Access ---------- */

-- New tables get Supabase's default grants; these are narrowed to what each needs.
revoke all on public.client_dscs, public.change_log from anon;
revoke insert, update, delete, truncate on public.client_dscs, public.change_log from authenticated;
grant select on public.client_dscs, public.change_log to authenticated;

alter table public.client_dscs enable row level security;
alter table public.change_log enable row level security;

-- Everyone sees which DSCs a client has and when they expire; changes go through save_client_dscs.
create policy "staff read dscs" on public.client_dscs for select to authenticated using ((select public.is_staff()));
-- Who changed what is for those who run the firm's settings.
create policy "settings reads the log" on public.change_log for select to authenticated using ((select public.has_perm('settings')));

revoke execute on function
  public.save_client_dscs(text, jsonb, text),
  public.client_dsc_passwords(text),
  public.note_sign_in()
from public, anon;
grant execute on function
  public.save_client_dscs(text, jsonb, text),
  public.client_dsc_passwords(text),
  public.note_sign_in()
to authenticated;
revoke execute on function private.note_change(text, text, text, text, text, jsonb), private.log_change() from public, anon, authenticated;

alter publication supabase_realtime add table public.client_dscs;
