-- Giving out logins becomes a permission like the others (Settings → Permissions), instead of something
-- tied to the admin and CEO roles. Those two have it to start with; heads do not. Only someone who has it
-- can grant it to, or take it from, anyone else, so it cannot be picked up through Settings alone.

create or replace function public.role_permissions(r text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case
    when r in ('admin', 'ceo') then array['assign_tasks', 'edit_clients', 'view_logins', 'view_fees', 'consultations', 'manage_attendance', 'view_team', 'edit_team', 'settings', 'manage_logins']
    when r = 'head' then array['assign_tasks', 'edit_clients', 'view_logins', 'view_fees', 'consultations', 'manage_attendance', 'view_team', 'edit_team', 'settings']
    else array['edit_clients', 'view_logins', 'view_fees']
  end
$$;

create or replace function public.can_manage_logins()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_perm('manage_logins')
$$;

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
    if (new.role is distinct from old.role or new.active is distinct from old.active or new.email is distinct from old.email)
       and not public.has_perm('edit_team') then
      raise exception 'Only people who may edit the team can change a role, email or active status' using errcode = '42501';
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
