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
| GST, TDS, Income tax, Audit, One-time | The Excel trackers as editable tables, one sidebar entry each |
| Clients | Details, scope checkmarks with "requirement sent", clarifications (call summary and recording), fee ledger, portal logins, documents, work in progress |
| Leads | Enquiry → follow-up → won / lost, with remarks; a won lead converts to a client |
| Team | Photo, date of joining, birthday, who reports to whom, and workload |
| Attendance | Daily register per person, month by month |

Use the name at the bottom of the sidebar to view the demo as a different person.
Heads can assign and approve; trainees see their own work. "Reset sample data"
is in the same menu.

## Where things live

- `src/data/seed.ts` — sample data (staff are real, every client and login is invented)
- `src/store.ts` — app state and actions; the place a real API would plug in
- `src/lib/deadlines.ts` — statutory dates and FSG's one-day-early staff cut-offs
- `src/lib/meta.ts` — labels for scopes, statuses, departments
- `src/pages/` — one file per screen
