/*
 * Attendance is kept on the day itself. Whoever keeps attendance can mark, change or clear today's (India time),
 * and make today or a later date an off day for everyone; earlier days are corrected only by the CEO.
 * The app holds to the same (`canEditAttendanceOn` in src/store.ts). Changes made outside the app (the SQL editor,
 * the service key) skip row level security and are not affected.
 */

/** Whether the signed-in person may change attendance or off days on this date. */
create or replace function public.day_open(d date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select d >= (now() at time zone 'Asia/Kolkata')::date
    or exists (select 1 from public.employees e where e.user_id = auth.uid() and e.active and e.role = 'ceo')
$$;

revoke all on function public.day_open(date) from public, anon;
grant execute on function public.day_open(date) to authenticated;

drop policy if exists "attendance add" on public.attendance;
drop policy if exists "attendance edit" on public.attendance;
drop policy if exists "attendance clear" on public.attendance;

create policy "attendance add" on public.attendance for insert to authenticated
  with check ((select public.has_perm('manage_attendance')) and public.day_open(date));
-- Checked on the row as it was and as it becomes, so a day cannot be moved into the past either.
create policy "attendance edit" on public.attendance for update to authenticated
  using ((select public.has_perm('manage_attendance')) and public.day_open(date))
  with check ((select public.has_perm('manage_attendance')) and public.day_open(date));
create policy "attendance clear" on public.attendance for delete to authenticated
  using ((select public.has_perm('manage_attendance')) and public.day_open(date));

drop policy if exists "off days add" on public.off_days;
drop policy if exists "off days edit" on public.off_days;
drop policy if exists "off days clear" on public.off_days;

create policy "off days add" on public.off_days for insert to authenticated
  with check ((select public.has_perm('manage_attendance')) and public.day_open(date));
create policy "off days edit" on public.off_days for update to authenticated
  using ((select public.has_perm('manage_attendance')) and public.day_open(date))
  with check ((select public.has_perm('manage_attendance')) and public.day_open(date));
create policy "off days clear" on public.off_days for delete to authenticated
  using ((select public.has_perm('manage_attendance')) and public.day_open(date));
