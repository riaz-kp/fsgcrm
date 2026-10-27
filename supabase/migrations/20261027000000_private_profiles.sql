-- Each person sees and edits their own profile. Colleagues' personal and family details (date of birth,
-- address, blood group, qualification, family) are for those given "See colleagues' details" (view_team);
-- everyone else gets a colleague's role, contact and the day and month of their birthday. Editing anyone's
-- profile, role or reporting line stays with "Add & edit team" (edit_team); without it a person changes
-- only their own photo, personal and family details.

/* ---------- Birthdays without the year ---------- */

alter table public.employees add column birthday text
  generated always as (lpad(extract(month from dob)::int::text, 2, '0') || '-' || lpad(extract(day from dob)::int::text, 2, '0')) stored;

/* ---------- Who reads what ---------- */

-- The team reads every column but the personal ones. A column added to employees later is hidden until it is
-- added here too.
revoke select on public.employees from anon, authenticated;
grant select (
  seq, id, user_id, name, title, role, reports_to, responsibilities, phone, email, hue, active, joined, photo,
  permissions, origin, updated_at, username, has_login, birthday
) on public.employees to authenticated;

/** Personal and family details: the signed-in person's own, and everyone's for those allowed to see colleagues' details. */
create or replace function public.employee_details(p_id text default null)
returns table (id text, dob date, address text, blood_group text, qualification text, family jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.dob, e.address, e.blood_group, e.qualification, e.family
  from public.employees e
  where (p_id is null or e.id = p_id)
    and (e.id = public.current_employee_id() or public.has_perm('view_team'))
  order by e.seq
$$;

revoke execute on function public.employee_details(text) from public, anon;
grant execute on function public.employee_details(text) to authenticated;

/* ---------- Who changes what ---------- */

drop policy "edit_team or settings edits people" on public.employees;
create policy "edit_team, settings or the person themself edits people" on public.employees for update to authenticated
  using ((select public.has_perm('edit_team')) or (select public.has_perm('settings')) or id = (select public.current_employee_id()))
  with check ((select public.has_perm('edit_team')) or (select public.has_perm('settings')) or id = (select public.current_employee_id()));

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
      if (new.id, new.name, new.title, new.role, new.reports_to, new.responsibilities, new.hue, new.active, new.joined, new.email)
         is distinct from (old.id, old.name, old.title, old.role, old.reports_to, old.responsibilities, old.hue, old.active, old.joined, old.email) then
        raise exception 'Only people who may edit the team can change a name, designation, role, reporting line, joining date, email or active status' using errcode = '42501';
      end if;
      if old.id is distinct from public.current_employee_id()
         and (new.phone, new.dob, new.address, new.blood_group, new.qualification, new.family, new.photo)
             is distinct from (old.phone, old.dob, old.address, old.blood_group, old.qualification, old.family, old.photo) then
        raise exception 'You can change only your own personal and family details' using errcode = '42501';
      end if;
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
