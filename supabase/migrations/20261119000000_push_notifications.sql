-- Push notifications to phones and computers (the notification panel on Windows, macOS, Android, iPhone and iPad).
--
-- Each device that turns notifications on saves a push subscription here. The database decides who to tell and what,
-- and hands the message to the `push` edge function through pg_net; the function signs it with the VAPID keys and
-- sends it to each of the person's devices. Nothing is sent for a save that is rolled back: pg_net only sends
-- after the transaction commits.
--
-- What is sent:
--   * A task given to you (new, or reassigned), by someone else.
--   * A task you assigned marked ready for review; your task approved or sent back; a remark on a task you are on.
--   * At 9:00 IST on working days: your tasks due today and overdue, and reminders that start or fall due.
--
-- Keys and the function's address are kept in Supabase Vault, not here (see supabase/push-setup.md):
--   push_vapid_public, push_vapid_private, push_hook_secret, push_function_url

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

/* ---------- Devices ---------- */

create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  employee_id text not null references public.employees (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  device text not null default '',
  created_at timestamptz not null default now(),
  seen_at timestamptz not null default now()
);

create index push_subscriptions_employee_id_idx on public.push_subscriptions (employee_id);
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon;
revoke insert, update, delete, truncate on public.push_subscriptions from authenticated;
grant select on public.push_subscriptions to authenticated;
create policy "own devices" on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));

/**
 * Turns notifications on for this device, for whoever is signed in. A device belongs to the last person who turned
 * them on there, so a shared computer stops getting the previous person's notifications.
 */
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_device text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me text := public.current_employee_id();
begin
  if me is null then
    raise exception 'Only active team members can turn on notifications' using errcode = '42501';
  end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 2000 or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'That is not a push subscription' using errcode = '22023';
  end if;
  insert into public.push_subscriptions (endpoint, user_id, employee_id, p256dh, auth, device)
  values (p_endpoint, auth.uid(), me, p_p256dh, p_auth, left(coalesce(p_device, ''), 200))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, employee_id = excluded.employee_id, p256dh = excluded.p256dh, auth = excluded.auth,
        device = excluded.device, seen_at = now();
end;
$$;

/** Turns notifications off for this device (also done when signing out). */
create or replace function public.remove_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid()
$$;

/** The public half of the VAPID key pair, which the browser needs to subscribe. */
create or replace function public.push_public_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_public' and public.is_staff()
$$;

/** Everything the edge function needs to send. Only the service key (the edge function) may call it. */
create or replace function public.push_server_config()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'public', (select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_public'),
    'private', (select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_private'),
    'secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_hook_secret')
  )
$$;

/* ---------- Sending ---------- */

/**
 * Hands one message for some team members to the edge function. Skips people who are inactive or have no device
 * with notifications on, and never lets a failure here stop the save that caused it.
 */
create or replace function private.send_push(p_to text[], p_title text, p_body text, p_url text, p_tag text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  fn_url text;
  secret text;
  people text[];
begin
  select array_agg(distinct e.id) into people
    from public.employees e
   where e.id = any (p_to) and e.active
     and exists (select 1 from public.push_subscriptions s where s.employee_id = e.id);
  if people is null then
    return;
  end if;
  select decrypted_secret into fn_url from vault.decrypted_secrets where name = 'push_function_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'push_hook_secret';
  if fn_url is null or secret is null then
    return;
  end if;
  perform net.http_post(
    url := fn_url,
    body := jsonb_build_object('to', to_jsonb(people), 'title', p_title, 'body', left(coalesce(p_body, ''), 400), 'url', p_url, 'tag', p_tag),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', secret),
    timeout_milliseconds := 10000
  );
exception when others then
  raise warning 'Push notification not sent: %', sqlerrm;
end;
$$;

/** "15 Nov", as the app writes short dates. */
create or replace function private.short_date(d date)
returns text
language sql
immutable
set search_path = ''
as $$
  select to_char(d, 'FMDD Mon')
$$;

/* ---------- Tasks ---------- */

create or replace function private.notify_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor text := public.current_employee_id();
  actor_name text;
  client_name text;
  about text;
  link text := '/tasks?open=' || new.id;
  remark jsonb;
  remark_by text;
  remark_line text;
  by_line text;
  told text[] := '{}';
begin
  select name into actor_name from public.employees where id = actor;
  select name into client_name from public.clients where id = new.client_id;
  about := new.title || coalesce(' · ' || client_name, '');

  -- A remark saved with this change (a reassignment or a send-back often comes with one).
  if tg_op = 'UPDATE' and jsonb_array_length(new.remarks) > jsonb_array_length(old.remarks) then
    remark := new.remarks -> (jsonb_array_length(new.remarks) - 1);
    remark_by := remark ->> 'by';
    remark_line := coalesce((select name from public.employees where id = remark_by) || ': ', '') || coalesce(remark ->> 'text', '');
  end if;
  -- "By <name>", unless their own remark already says who it was.
  by_line := case when remark_line is not null and remark_by is not distinct from actor then null else actor_name end;

  -- Given to someone: a new task, or one reassigned to them.
  if (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) and new.assignee_id is distinct from actor and new.status <> 'completed' then
    perform private.send_push(
      array[new.assignee_id],
      case when tg_op = 'INSERT' then 'New task for you' else 'Task passed to you' end,
      concat_ws(E'\n', about || ' · due ' || private.short_date(new.due_date), 'From ' || by_line, remark_line),
      link, 'task-' || new.id);
    told := told || new.assignee_id;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'in_review' and new.assigned_by_id is distinct from actor and not new.assigned_by_id = any (told) then
      perform private.send_push(array[new.assigned_by_id], 'Ready for review',
        concat_ws(E'\n', about, 'Marked by ' || by_line, remark_line), link, 'task-' || new.id);
      told := told || new.assigned_by_id;
    elsif old.status = 'in_review' and new.status in ('completed', 'to_begin', 'in_progress')
          and new.assignee_id is distinct from actor and not new.assignee_id = any (told) then
      perform private.send_push(array[new.assignee_id],
        case when new.status = 'completed' then 'Task approved' else 'Task sent back' end,
        concat_ws(E'\n', about, 'By ' || by_line, remark_line), link, 'task-' || new.id);
      told := told || new.assignee_id;
    end if;
  end if;

  -- A remark on its own: the others on the task hear about it.
  if remark_line is not null then
    perform private.send_push(
      array(
        select distinct x from unnest(array[new.assignee_id, new.assigned_by_id]) x
         where x is distinct from remark_by and x is distinct from actor and not x = any (told)
      ),
      'Remark on ' || new.title, remark_line, link, 'task-' || new.id || '-remark');
  end if;

  return null;
end;
$$;

create trigger tasks_push after insert or update of assignee_id, status, remarks on public.tasks
  for each row execute function private.notify_task();

/* ---------- Morning digest ---------- */

/** Whether a reminder falls on a day. Mirrors occurrences() in src/store.ts (29th–31st fall on a short month's last day). */
create or replace function private.reminder_on(r public.reminders, d date)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select d >= r.date and case r.repeat
    when 'none' then d = r.date
    when 'monthly' then extract(day from d) = least(extract(day from r.date), extract(day from (date_trunc('month', d) + interval '1 month - 1 day')))
    when 'yearly' then extract(month from d) = extract(month from r.date)
                   and extract(day from d) = least(extract(day from r.date), extract(day from (date_trunc('month', d) + interval '1 month - 1 day')))
    else false
  end
$$;

/** Sundays and the firm's off days. */
create or replace function private.is_off_day(d date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select extract(isodow from d) = 7 or exists (select 1 from public.off_days where date = d)
$$;

/**
 * Each person's morning notice: tasks due today and overdue, and reminders whose notice starts or that fall due.
 * Runs every day at 9:00 IST and does nothing on off days; the first working day after catches up on reminders.
 */
create or replace function private.push_digest(p_today date default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := coalesce(p_today, (now() at time zone 'Asia/Kolkata')::date);
  since date;
  e record;
  due_titles text[];
  due_count int;
  late_count int;
  rem text[];
  body text;
begin
  if private.is_off_day(today) then
    return;
  end if;
  -- The last working day: reminders that started since then are included today.
  since := today - 1;
  while since > today - 14 and private.is_off_day(since) loop
    since := since - 1;
  end loop;

  for e in
    select distinct emp.id from public.employees emp join public.push_subscriptions s on s.employee_id = emp.id where emp.active
  loop
    select array_agg(t.title order by t.priority = 'urgent' desc, t.priority = 'high' desc, t.title), count(*)
      into due_titles, due_count
      from public.tasks t
     where t.assignee_id = e.id and t.status <> 'completed' and t.due_date = today;
    select count(*) into late_count
      from public.tasks t
     where t.assignee_id = e.id and t.status <> 'completed' and t.due_date < today;

    if due_count > 0 or late_count > 0 then
      body := concat_ws(E'\n',
        case when due_count > 0 then due_count || ' due today: ' || array_to_string(due_titles[1:3], ', ') || case when due_count > 3 then '…' else '' end end,
        case when late_count > 0 then late_count || ' overdue' end);
      perform private.send_push(array[e.id], 'Your tasks today', body,
        case when due_count > 0 then '/tasks?due=today' else '/tasks?due=late' end, 'digest-tasks');
    end if;

    -- Reminders whose notice period started, or whose day came, since the last working day.
    select array_agg(line order by on_day, line) into rem
      from (
        select distinct r.title || case when o = today then ' · today' else ' · ' || private.short_date(o) end as line, o as on_day
          from public.reminders r
          cross join generate_series(since + 1, today, interval '1 day') g(day)
          cross join lateral (values (g.day::date), (g.day::date + r.notify_days)) occ(o)
         where (r.for_id is null or r.for_id = e.id)
           and private.reminder_on(r, occ.o)
           and (occ.o = g.day::date or occ.o >= today)
           and not (to_char(occ.o, 'YYYY-MM-DD') = any (r.done))
      ) x;

    if rem is not null then
      perform private.send_push(array[e.id],
        case when cardinality(rem) = 1 then 'Reminder' else cardinality(rem) || ' reminders' end,
        array_to_string(rem[1:4], E'\n') || case when cardinality(rem) > 4 then E'\n…' else '' end,
        '/calendar', 'digest-reminders');
    end if;
  end loop;
end;
$$;

-- 03:30 UTC is 9:00 in India.
select cron.unschedule('push-digest') where exists (select 1 from cron.job where jobname = 'push-digest');
select cron.schedule('push-digest', '30 3 * * *', 'select private.push_digest()');

/* ---------- Access ---------- */

revoke execute on function
  public.save_push_subscription(text, text, text, text),
  public.remove_push_subscription(text),
  public.push_public_key(),
  public.push_server_config()
from public, anon;
grant execute on function
  public.save_push_subscription(text, text, text, text),
  public.remove_push_subscription(text),
  public.push_public_key()
to authenticated;
revoke execute on function public.push_server_config() from authenticated;
grant execute on function public.push_server_config() to service_role;
revoke execute on function
  private.send_push(text[], text, text, text, text),
  private.short_date(date),
  private.notify_task(),
  private.reminder_on(public.reminders, date),
  private.is_off_day(date),
  private.push_digest(date)
from public, anon, authenticated;
