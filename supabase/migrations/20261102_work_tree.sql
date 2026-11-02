-- شرباكة: each account's work tree («شجرة دوامي», work.js), kept as one document and private to that account.
-- The document holds the people (name, job, department, who their manager is) and the departments.

create table public.work_trees (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 512000),
  updated_at timestamptz not null default now()
);

comment on table public.work_trees is 'Work tree of each account (people, managers, departments) as one JSON document. Deleted with the account.';

alter table public.work_trees enable row level security;

create policy "Read own work tree" on public.work_trees
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own work tree" on public.work_trees
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own work tree" on public.work_trees
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own work tree" on public.work_trees
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.work_trees to authenticated;
