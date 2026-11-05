-- "In association with": a client linked with others, such as the same person's other businesses, each of which
-- is a client of its own. The app keeps a link on both clients, so either page shows it.
-- Must reach the database before the frontend that reads it: sync saves this column with every client.

alter table public.clients add column associates text[] not null default '{}';
