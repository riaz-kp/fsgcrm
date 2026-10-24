-- Logins by username, made by the admin or the CEO.
--
-- Nobody signs up on their own any more. The admin or the CEO gives a team member a username and a
-- password from Settings → Logins, through the staff-logins Edge Function. Supabase Auth still works by
-- email underneath, so a username is kept as <username>@fsg.local. No email is ever sent to those
-- addresses: there is no sign-up confirmation and no password reset by email; the admin or CEO resets
-- passwords.

/* ---------- An admin role ---------- */

alter table public.employees drop constraint employees_role_check;
alter table public.employees add constraint employees_role_check check (role in ('admin', 'ceo', 'head', 'trainee', 'staff'));

create or replace function public.role_permissions(r text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case
    when r in ('admin', 'ceo', 'head') then array['assign_tasks', 'edit_clients', 'view_logins', 'view_fees', 'consultations', 'manage_attendance', 'view_team', 'edit_team', 'settings']
    else array['edit_clients', 'view_logins', 'view_fees']
  end
$$;

/** Logins are for the admin and the CEO to give out, whatever else anyone has been allowed in Settings. */
create or replace function public.can_manage_logins()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.employees where user_id = auth.uid() and active and role in ('admin', 'ceo'))
$$;

grant execute on function public.can_manage_logins() to authenticated;

/* ---------- Usernames ---------- */

alter table public.employees add column username text check (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$');
alter table public.employees add column has_login boolean generated always as (user_id is not null) stored;
create unique index employees_username_key on public.employees (username);

update public.employees set role = 'admin' where id = 'e-admin';

/** Adds to the checks on the team: usernames are only set by the staff-logins function, and only the admin or CEO hands out the top roles. */
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
    if new.user_id is not null or new.username is not null then
      raise exception 'Logins are given out from Settings → Logins' using errcode = '42501';
    end if;
    if new.permissions is not null and not public.has_perm('settings') then
      raise exception 'Only people who may change settings can set permissions' using errcode = '42501';
    end if;
    if new.role in ('admin', 'ceo') and not public.can_manage_logins() then
      raise exception 'Only the admin or the CEO can make someone admin or CEO' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.user_id is distinct from old.user_id or new.username is distinct from old.username then
    raise exception 'Logins are given out from Settings → Logins' using errcode = '42501';
  end if;
  if new.permissions is distinct from old.permissions and not public.has_perm('settings') then
    raise exception 'Only people who may change settings can change permissions' using errcode = '42501';
  end if;
  if (new.role is distinct from old.role or new.active is distinct from old.active or new.email is distinct from old.email)
     and not public.has_perm('edit_team') then
    raise exception 'Only people who may edit the team can change a role, email or active status' using errcode = '42501';
  end if;
  if new.role is distinct from old.role and (new.role in ('admin', 'ceo') or old.role in ('admin', 'ceo')) and not public.can_manage_logins() then
    raise exception 'Only the admin or the CEO can make someone admin or CEO, or change their role' using errcode = '42501';
  end if;
  return new;
end;
$$;

/* ---------- Only the admin's requests make sign-ins ---------- */

-- The staff-logins function notes the sign-in it is about to make; the trigger below lets through only a
-- sign-in that was noted, and links it to that team member. Anything else (someone calling the sign-up API
-- directly, say) is turned away.
create table private.login_grants (
  email text primary key,
  employee_id text not null references public.employees (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table private.login_grants enable row level security;

create or replace function public.grant_login(p_employee_id text, p_email text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.login_grants (email, employee_id) values (lower(p_email), p_employee_id)
  on conflict (email) do update set employee_id = excluded.employee_id, created_at = now();
$$;

create or replace function public.drop_login_grant(p_email text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.login_grants where email = lower(p_email);
$$;

-- Only the function (with the service key) may note a sign-in.
revoke execute on function public.grant_login(text, text), public.drop_login_grant(text) from public, anon, authenticated;
grant execute on function public.grant_login(text, text), public.drop_login_grant(text) to service_role;

create or replace function public.link_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  emp text;
begin
  delete from private.login_grants
   where email = lower(new.email) and created_at > now() - interval '2 minutes'
  returning employee_id into emp;
  if emp is null then
    raise exception 'Logins are created by the admin or the CEO.' using errcode = 'P0001';
  end if;
  update public.employees set user_id = new.id where id = emp and active and user_id is null;
  if not found then
    raise exception 'That team member already has a login, or is not active.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.link_new_user() from public, anon, authenticated;
