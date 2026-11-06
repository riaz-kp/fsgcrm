-- Statutory due dates moved from the usual one in Settings → Deadlines (an extension, say), kept on the scope whose
-- clients they apply to: deadline id -> date, e.g. {"itr-audit-2026": "2026-11-30"}.
-- Must reach the database before the frontend that reads it: sync saves this column with every scope.

alter table public.scopes add column deadlines jsonb;

-- Those who assign work may delete a task. Until now no one could.

create policy "assign_tasks deletes tasks" on public.tasks for delete to authenticated
  using ((select public.has_perm('assign_tasks')));
