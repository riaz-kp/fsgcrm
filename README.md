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
| Dashboard | GST progress for the month, work needing attention, upcoming deadlines, team workload, lead pipeline |
| Tasks | Heads assign work; the assignee updates a progress bar and remarks, then submits; a head approves or sends it back |
| Filings | The Excel trackers as editable tables: GST (monthly), TDS (quarterly), income tax (yearly), audit, one-time services |
| Deadlines | Calendar of statutory dates worked out from each client's scopes, plus task due dates and lead follow-ups |
| Clients | Details, scope-of-work checkmarks, portal logins, documents, and the work in progress for each client |
| Leads | Enquiry → follow-up → won / lost, with remarks; a won lead converts to a client |
| Team | Who reports to whom and how much each person has open |

Use the name at the bottom of the sidebar to view the demo as a different person.
Heads can assign and approve; trainees see their own work. "Reset sample data"
is in the same menu.

## Where things live

- `src/data/seed.ts` — sample data (staff are real, every client and login is invented)
- `src/store.ts` — app state and actions; the place a real API would plug in
- `src/lib/deadlines.ts` — statutory dates and FSG's one-day-early staff cut-offs
- `src/lib/meta.ts` — labels for scopes, statuses, departments
- `src/pages/` — one file per screen
