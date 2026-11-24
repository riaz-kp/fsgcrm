-- Round 17: alarms.
--
--   * Reminders can be at a set time of day, with an alarm some minutes before it (or at the time, or a day before).
--   * Consultations say who from the firm takes them (the CEO and Praveen, ticked on the form) and carry an alarm too.
--   * While the app is open it pops the alarm up with a sound. With it closed, the job below sends a push
--     notification at the alarm time to each device that has notifications on. Its tag matches the one the app uses
--     ('alarm-' and the alarm's key), so a device that gets both shows one notification.
--
-- Needs push_notifications (20261119000000) first: it uses private.send_push, private.reminder_on and pg_cron.

alter table public.reminders
  add column time text check (time ~ '^\d{2}:\d{2}$'),
  add column alarm integer check (alarm between 0 and 10080),
  add constraint reminders_alarm_needs_time check (alarm is null or time is not null);

alter table public.consultations
  add column attendees text[],
  add column alarm integer check (alarm between 0 and 10080);

/* ---------- Sending alarms ---------- */

/** Alarms already sent, by key, so each is sent once. Kept a few days. */
create table private.alarms_sent (
  key text primary key,
  sent_at timestamptz not null default now()
);

/** "3:30 pm today", "11:00 am tomorrow", "3:30 pm 26 Nov": how the app writes when something is. */
create or replace function private.when_label(d date, t text, today date)
returns text
language sql
immutable
set search_path = ''
as $$
  select to_char(t::time, 'FMHH12:MI am') || ' ' || case
    when d = today then 'today'
    when d = today + 1 then 'tomorrow'
    else private.short_date(d)
  end
$$;

/**
 * Sends the alarms whose time has come in the last ten minutes (in India's time). Runs every minute. A reminder for
 * everyone rings for everyone; a consultation for the people ticked on it, or the CEO on older ones.
 */
create or replace function private.push_alarms()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_ist timestamp := now() at time zone 'Asia/Kolkata';
  today date := (now() at time zone 'Asia/Kolkata')::date;
  a record;
begin
  delete from private.alarms_sent where sent_at < now() - interval '4 days';

  for a in
    with due as (
      -- Reminders: each date one falls on, from yesterday (a day-before alarm) to two days on.
      select 'r-' || r.id || '-' || to_char(g.day, 'YYYY-MM-DD') || '-' || r.time || '-' || r.alarm as key,
             g.day::date + r.time::time - make_interval(mins => r.alarm) as ring_at,
             case when r.for_id is null then array(select e.id from public.employees e where e.active) else array[r.for_id] end as people,
             r.title as title,
             concat_ws(' · ', 'Reminder · ' || private.when_label(g.day::date, r.time, today),
               (select c.name from public.clients c where c.id = r.client_id), nullif(r.note, '')) as body,
             '/calendar?date=' || to_char(g.day, 'YYYY-MM-DD') as url
        from public.reminders r
        cross join generate_series(today - 1, today + 2, interval '1 day') g(day)
       where r.time is not null and r.alarm is not null
         and private.reminder_on(r, g.day::date)
         and not (to_char(g.day, 'YYYY-MM-DD') = any (r.done))
      union all
      select 'c-' || k.id || '-' || to_char(k.date, 'YYYY-MM-DD') || '-' || k.time || '-' || k.alarm,
             k.date + k.time::time - make_interval(mins => k.alarm),
             case when cardinality(k.attendees) > 0 then k.attendees
                  else array(select e.id from public.employees e where e.role = 'ceo' and e.active) end,
             'Consultation: ' || k.with_name,
             concat_ws(' · ', private.when_label(k.date, k.time, today) || ' · ' || k.mode, nullif(k.topic, ''),
               (select 'with ' || string_agg(e.name, ' & ' order by e.role = 'ceo' desc, e.name)
                  from public.employees e where e.id = any (k.attendees) and cardinality(k.attendees) > 1)),
             '/consultations'
        from public.consultations k
       where k.status = 'scheduled' and k.alarm is not null and k.date between today - 1 and today + 2
    )
    select * from due where ring_at <= now_ist and ring_at > now_ist - interval '10 minutes'
  loop
    insert into private.alarms_sent (key) values (a.key) on conflict do nothing;
    if found then
      perform private.send_push(a.people, a.title, a.body, a.url, 'alarm-' || a.key);
    end if;
  end loop;
end;
$$;

select cron.unschedule('push-alarms') where exists (select 1 from cron.job where jobname = 'push-alarms');
select cron.schedule('push-alarms', '* * * * *', 'select private.push_alarms()');

/* ---------- Access ---------- */

revoke all on private.alarms_sent from public, anon, authenticated;
revoke execute on function
  private.when_label(date, text, date),
  private.push_alarms()
from public, anon, authenticated;
