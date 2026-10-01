# FSG Practice Manager — frontend demo

A clickable demo of the CRM for Fin Savvy Consultors LLP: clients, leads, tasks,
filing trackers, deadlines and the team. There is no backend yet. Everything runs
in the browser on made-up sample data and is saved to `localStorage`.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

If `npm install` hangs with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` on this Mac, point
Node at the system certificate bundle first:

```bash
export NODE_EXTRA_CA_CERTS=/etc/ssl/cert.pem
```

## What's in the demo

| Screen | What it shows |
| --- | --- |
| Dashboard | Tasks due today and the count in each status, a today's-tasks box per person, work needing attention, GST progress, deadlines, birthday wishes, and the CEO's consultations |
| Tasks | Heads assign work; the assignee updates a progress bar and remarks, then submits; a head approves or sends it back. Only the CEO and heads see everyone's tasks |
| Deadlines | Calendar of statutory dates worked out from each client's scopes, plus task due dates, lead follow-ups and consultations |
| Consultations | The CEO's consulting schedule, with reminders the day before and on the day (CEO and heads only) |
| GST, TDS, Income tax, Audit, One-time | The Excel trackers as editable tables, one sidebar entry each. Every tracker filters by search, status and person, plus its own filters (return period, payment month, quarter, kind of audit or service). All five carry fee and received columns, a fee balance figure and a totals row for the rows on screen |
| Clients | Details with click-to-call phone, WhatsApp and email; scope of work (changed only through Edit, each scope opens its tracker for that client) with "requirement sent"; clarifications (call summary and recording); fee ledger; portal logins; documents; filing status and a month-by-month work history showing who did what. "Send status" drafts a work-status message and opens it in WhatsApp for the staff member to send |
| Leads | Enquiry → follow-up → won / lost, with remarks; a won lead converts to a client |
| Team | Photo, date of joining, birthday, who reports to whom, and workload. Each person opens to their own page: personal details (age worked out from the date of birth), family details, their tasks, what sits with them in each tracker, a month-by-month work history, and attendance |
| Attendance | Daily register with time in and out, month by month. Each person has a detail page: days worked, present, half days, leave, absent, hours, day-by-day timings and a month-by-month summary |

Use the name at the bottom of the sidebar to view the demo as a different person.
Heads can assign and approve; trainees see their own work. "Reset sample data"
is in the same menu.

A person's personal and family details, work and attendance are shown to the heads
and to that person; everyone else sees only what they do at the firm and how to
reach them. Only heads can edit them.

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

- `src/data/seed.ts` — sample data. Staff names are real; every client and login is invented. Staff dates of birth and joining are placeholders, and their address, blood group, qualification and family details are left empty for them to fill in
- `src/store.ts` — app state and actions; the place a real API would plug in
- `src/lib/deadlines.ts` — statutory dates and FSG's one-day-early staff cut-offs
- `src/lib/meta.ts` — labels for scopes, statuses, departments
- `src/lib/history.ts` — builds the work history from the trackers and tasks, for a client's page and a person's page
- `src/lib/statusMessage.ts` — wording of the work-status message sent to clients
- `src/lib/attendance.ts` — attendance totals and hours
- `src/pages/` — one file per screen
