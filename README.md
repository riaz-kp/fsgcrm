# FSG Practice Manager

The practice manager for Fin Savvy Consultors LLP: clients, leads, tasks, filing trackers,
deadlines and the team. The team signs in, and everything is kept in a Supabase (Postgres)
database, with files in Supabase Storage. Changes are saved as they are made and show up for
everyone else straight away.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

With `.env.local` filled in (see `.env.example`) the app talks to the database and asks you to sign
in. With no database settings, `npm run dev` opens on made-up sample data kept in your browser,
handy for trying a change without touching real work.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Type-check and build into `dist/` |
| `npm run preview` | Serve `dist/` with the same security headers as the live site |
| `npm run lint` | Lint |

If `npm install` hangs with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` on a Mac, point Node at the
system certificate bundle first: `export NODE_EXTRA_CA_CERTS=/etc/ssl/cert.pem`.

## The database

Everything the database needs is in `supabase/migrations/`, in order:

| File | What it sets up |
| --- | --- |
| `…_init.sql` | One table per list the app keeps, the access rules, encrypted portal passwords, the `client-files` bucket and live updates |
| `…_starting_data.sql` | The nine team members and the built-in scopes of work. No clients or sample figures |
| `…_lock_trigger_functions.sql` | Keeps internal functions out of the API |
| `…_username_logins.sql` | Usernames, the admin role, and logins only the admin or CEO can create |

They have been applied to the project `ibektwkpgpybuixadqcl`, and the `staff-logins` function is
deployed there. For a new project:

1. Run the migrations in the SQL editor in that order (or link the project with the Supabase CLI and
   run `supabase db push`).
2. Deploy the function: `supabase functions deploy staff-logins --no-verify-jwt` (it checks the
   caller itself).
3. Give the first admin a login. Nobody can sign in yet to do it from the app, so in the SQL editor run
   `select public.grant_login('e-admin', 'admin@fsg.local');` and, within two minutes, add a user in
   Authentication → Users with that email, a password and *Auto confirm* ticked. Then run
   `update public.employees set username = 'admin' where id = 'e-admin';`. The admin signs in as
   `admin` and gives everyone else a login from Settings → Logins.

### Who can do what

Every table has row level security, so the rules hold whatever someone does with the API, not
just in the app:

- Only an **active team member who has signed in** sees anything. Anyone else, signed in or not,
  gets nothing.
- **Logins are given out only by people with the "Give out logins" permission** (the admin and the
  CEO to start with), in Settings → Logins. Nobody can sign up on their own: the database turns away
  any sign-in that was not made there, even one made by calling Supabase's sign-up API directly.
  Only people with that permission can grant it to others, or make someone admin or CEO.
- The permissions in Settings are enforced by the database too: assigning tasks, keeping
  attendance, the CEO's consultations, changing settings and editing the team. Only someone who may
  change settings can change permissions.
- **Portal passwords** are encrypted with a key kept in Supabase Vault. Usernames show to the whole
  team; passwords only reach people allowed to see them, and only they can change logins.
- Client documents and call recordings sit in a private bucket and are opened through links that
  last a minute.
- Fees, and colleagues' personal details, are hidden in the app from people without the permission,
  but the database does not hide those columns from the rest of the team.

### Logins

People sign in with a **username and password** given to them by someone with the "Give out logins"
permission (Settings → Permissions; the admin and the CEO have it to start with). There is no sign-up
and no "forgot password": they set a new password from Settings → Logins.

- **Create logins for everyone** makes a username and a random password for each active person
  without a login, saves the list as `fsg-logins.csv` straight away, and shows it once to copy or
  print as slips. Passwords are not stored anywhere readable, so keep that file safe.
- Per person: create a login, set a new password, change the username, or remove the login.
- Someone who leaves: mark them not active on the Team page (their sign-in stops working at once),
  or remove their login.

Supabase Auth signs in by email, so behind the scenes a username is kept as `<username>@fsg.local`.
No email is ever sent to those addresses. The work is done by the `staff-logins` Edge Function
(`supabase/functions/staff-logins`), which holds the service key; the browser never sees it.

The admin's own login was made with an email before usernames existed, and still works: the sign-in
box accepts that email. Give the admin a username from Settings → Logins → Set username.

### Supabase settings to check

In Supabase → Authentication → Sign In / Providers, turn off **Allow new users to sign up**. The
database already refuses sign-ups it was not asked for, so this is a second lock on the same door.
Email confirmation, SMTP and redirect URLs no longer matter, since the app sends no email.

## Deploying

On Vercel, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` under Settings →
Environment Variables, then deploy. A production build without them shows a "not connected" page
rather than falling back to sample data; set `VITE_DEMO=true` to deploy the sample-data demo on
purpose.

`vercel.json` does two things:

- Answers any address that is not a real file with `index.html`, so refreshing or opening a deep
  link (`/clients/…`) works. Another host needs the same rule.
- Sends security headers: a Content-Security-Policy that only allows the app itself and Supabase,
  no framing, no MIME sniffing, and long caching for the hashed files in `/assets`.

## How saving works

The screens read and change the app's state exactly as they did on sample data. `src/lib/sync.ts`
watches that state, works out which records changed, and saves only the changed fields: a burst
of typing becomes one request, records are saved before anything that points at them, and a save
that fails for want of a connection is kept and tried again. The header shows **Saving…**,
**Saved** or **Offline**. If the database turns a change down (say, a permission was just taken
away), a message says so and the record goes back to what the database has.

Other people's changes arrive over Supabase Realtime and appear without a reload. If the live
connection drops, everything is loaded again once it is back. Closing the tab while something is
still being saved asks first.

## What's in the app

| Screen | What it shows |
| --- | --- |
| Dashboard | Tasks due today and the count in each status, a today's-tasks box per person, work needing attention, GST progress, deadlines, birthday wishes, and the CEO's consultations |
| Tasks | Heads assign work; the assignee updates a progress bar and remarks, then submits; a head approves or sends it back. Only those allowed to assign work see everyone's tasks |
| Calendar | Statutory dates worked out from each client's scopes, plus task due dates, lead follow-ups, dates committed to customers, consultations and reminders anyone adds (once, monthly or yearly, ticked off date by date). Checkmark filters by kind and work head, with Check all / Uncheck all |
| Consultations | The CEO's consulting schedule, with reminders the day before and on the day; an appointment can be postponed and keeps its earlier slots on record |
| GST, TDS, Income tax, Audit, One-time | The Excel trackers as editable tables, one sidebar entry each. Every tracker filters by search, status and person, plus its own filters, and records the day the client's data came in (GST also the kind of data: bills, Tally backup, Excel or JSON). TDS counts the month's deposits paid and each deductor's months paid this year. Fee and received columns, a fee balance and a totals row show to those allowed to see fees |
| Clients | Details with click-to-call phone, WhatsApp and email; scope of work with "requirement sent"; clarifications (call summary and recording); fee ledger; portal logins (added, edited and removed in place; passwords only for those allowed); documents; filing status and a month-by-month work history. "Send status" drafts a work-status message and opens it in WhatsApp for the staff member to send. Sortable list |
| Leads | Enquiry → follow-up → won / lost, with remarks; a won lead converts to a client. Filters and sorting on the board and the list |
| Requirements | Document checklists from the firm's requirements note (GST registration by constitution, incorporations, TDS on property, IT, MSME, TAN). Tick what is needed, then export a PDF, send it on WhatsApp, or mark it sent on the client |
| Team | Photo, date of joining, birthday, who reports to whom, and workload. Each person opens to their own page: personal details (age worked out from the date of birth), family details, their tasks, what sits with them in each tracker, a month-by-month work history, and attendance |
| Attendance | Daily register of present, half day and leave, with time in and out and overtime in hours. Sundays and the holidays the firm marks are off for everyone and left out of the month's working days; someone who comes in on one is marked as usual. Each person has a detail page with working days, days worked, leave, overtime, hours, day-by-day timings and a month-by-month summary |
| Settings | Scopes of work (add, edit, delete), what each person may do, and the wording of the WhatsApp messages |

The name at the bottom of the sidebar opens your profile and signs you out. On sample data it
instead switches who you are viewing the app as, and has "Reset sample data".

What each person may do (assign tasks, edit clients, see passwords or fees, keep attendance, see
colleagues' details, edit the team, change settings) starts from their role and can be changed
person by person in Settings → Permissions.

## Screen sizes

The app adapts from a phone to a wide monitor:

- **Navigation** — a slide-in menu below 1024px, a rail of icons from 1024px to 1280px, and the full
  sidebar above that. On a wide screen the button beside the search box collapses the sidebar to the rail
  for more room; the choice is remembered.
- **Tables** — where there is no room for columns (a phone, a tablet held upright), each row becomes a
  card with the column names as labels. This goes by the width of the box the table sits in, so it is
  set per table with the `stack` class and a `label` on each cell; see the note in `src/index.css`.
- **Everything else** — page headers, filters, forms and dialogs wrap or stack as the screen narrows.
  On touch screens form fields use 16px text so iOS does not zoom in when one is tapped.

## Where things live

- `supabase/migrations/` — the database: tables, access rules, starting data
- `src/lib/supabase.ts` — the connection, and whether the app runs live or on sample data
- `src/lib/sync.ts` — loads the firm's data, saves changes, applies other people's changes
- `src/lib/files.ts` — client documents and call recordings in Storage
- `src/components/AuthGate.tsx`, `src/pages/SignIn.tsx` — signing in with a username
- `src/pages/SettingsLogins.tsx`, `src/lib/logins.ts`, `supabase/functions/staff-logins/` — giving out logins
- `src/data/seed.ts` — sample data, used only without a database. Staff names are real; every client and login is invented
- `src/store.ts` — app state and actions
- `src/lib/deadlines.ts` — statutory dates and FSG's one-day-early staff cut-offs
- `src/lib/meta.ts` — labels for scopes, statuses, departments
- `src/lib/history.ts` — builds the work history from the trackers and tasks, for a client's page and a person's page
- `src/lib/statusMessage.ts` — the lines of the work-status message; its wording is a template editable in Settings
- `src/lib/attendance.ts` — off days, working days, attendance totals, hours and overtime
- `src/data/requirements.ts` and `src/lib/requirementsPdf.ts` — the document checklists and the PDF made from them
- `src/pages/` — one file per screen
