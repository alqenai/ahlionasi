-- شرباكة: the wallet of saved relations, one row per (person, relation), private to each account.

create table public.relations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  me text not null default '' check (char_length(me) <= 40),
  them text not null default '' check (char_length(them) <= 40),
  -- the walk from "me" to "them": F M B Z S D H W = father mother brother sister son daughter husband wife
  steps text not null check (steps ~ '^[FMBZSDHW]{1,8}$'),
  created_at timestamptz not null default now()
);

comment on table public.relations is 'Saved kinship relations (the wallet). Each row belongs to one account.';

-- saving the same person with the same relation again updates the row instead of adding a copy
create unique index relations_user_them_steps_key on public.relations (user_id, them, steps);
create index relations_user_created_idx on public.relations (user_id, created_at desc);

alter table public.relations enable row level security;

create policy "Read own relations" on public.relations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own relations" on public.relations
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own relations" on public.relations
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own relations" on public.relations
  for delete to authenticated using ((select auth.uid()) = user_id);

-- keep any one account to a sane size
create function public.relations_cap() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.relations where user_id = new.user_id) >= 500 then
    raise exception 'wallet is full (500)';
  end if;
  return new;
end $$;

create trigger relations_cap before insert on public.relations
  for each row execute function public.relations_cap();

-- lets a signed-in person delete their account and everything saved in it
create function public.delete_my_account() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid();
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
