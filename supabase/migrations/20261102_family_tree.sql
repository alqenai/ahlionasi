-- شرباكة: each account's family tree («شجرة عيلتي»), kept as one document and private to that account.
-- The document holds the people (name, male/female) and the families that join them (husband, wife, children).

create table public.family_trees (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 512000),
  updated_at timestamptz not null default now()
);

comment on table public.family_trees is 'Family tree of each account (people and families) as one JSON document. Deleted with the account.';

alter table public.family_trees enable row level security;

create policy "Read own tree" on public.family_trees
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own tree" on public.family_trees
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own tree" on public.family_trees
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own tree" on public.family_trees
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.family_trees to authenticated;
