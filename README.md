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

## Deploying

The app is a single-page app: every address (`/clients`, `/filings/gst`…) is drawn by the same
`index.html`. `vercel.json` tells Vercel to answer any address that is not a real file with
`index.html`, so refreshing or opening a deep link works instead of showing Vercel's 404 page.
Another host needs the same "fall back to index.html" rule.

If `npm install` hangs with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` on this Mac, point
Node at the system certificate bundle first:

```bash
export NODE_EXTRA_CA_CERTS=/etc/ssl/cert.pem
```

## What's in the demo

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

Use the name at the bottom of the sidebar to view the demo as a different person.
"Reset sample data" is in the same menu.

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

- `src/data/seed.ts` — sample data. Staff names are real; every client and login is invented. Staff dates of birth and joining are placeholders, and their address, blood group, qualification and family details are left empty for them to fill in
- `src/store.ts` — app state and actions; the place a real API would plug in
- `src/lib/deadlines.ts` — statutory dates and FSG's one-day-early staff cut-offs
- `src/lib/meta.ts` — labels for scopes, statuses, departments
- `src/lib/history.ts` — builds the work history from the trackers and tasks, for a client's page and a person's page
- `src/lib/statusMessage.ts` — the lines of the work-status message; its wording is a template editable in Settings
- `src/lib/attendance.ts` — off days, working days, attendance totals, hours and overtime
- `src/data/requirements.ts` and `src/lib/requirementsPdf.ts` — the document checklists and the PDF made from them
- `src/pages/` — one file per screen
