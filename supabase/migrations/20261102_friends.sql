-- شرباكة: «ربعي» (friends.js). Each account's friends and the groups they know them from, kept as one
-- document and private to that account, and «رابط ربعي», a link to all of it (shorbaka.com/f/#code).
-- Ali's call (2026-11-02): the link has no password, like the trees' links. Whoever has it sees the friends
-- and groups as they are now, and nobody can change anything there. The owner can stop the link any time;
-- a link made after that gets a new code. With «الأسامي: بس اسمي» on, the friends' names never leave the
-- database: only the owner's name and the groups' names go out.

create extension if not exists pgcrypto with schema extensions;

create table public.friend_maps (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 512000),
  updated_at timestamptz not null default now()
);

comment on table public.friend_maps is '«ربعي» of each account (friends and their groups) as one JSON document. Deleted with the account.';

alter table public.friend_maps enable row level security;

create policy "Read own friends" on public.friend_maps
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own friends" on public.friend_maps
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own friends" on public.friend_maps
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own friends" on public.friend_maps
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.friend_maps to authenticated;

create table public.friend_map_links (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[a-z0-9]{10}$'),
  created_at timestamptz not null default now()
);

comment on table public.friend_map_links is 'Each account''s «رابط ربعي» (no password). Read and changed only through the functions below. Deleted with the account.';

alter table public.friend_map_links enable row level security;
-- No policies on purpose: nobody reads or writes this table directly.
revoke all on public.friend_map_links from anon, authenticated;

-- My link's code, or null when I have none.
create function public.my_friends_link() returns text
language sql stable security definer set search_path = '' as $$
  select code from public.friend_map_links where user_id = (select auth.uid());
$$;

-- Makes my link if I have none yet. Returns its code (the one I already have, if I do).
create function public.make_friends_link() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  c text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  for attempt in 1..20 loop
    select code into c from public.friend_map_links where user_id = uid;
    if c is not null then return c; end if;
    -- 10 letters and digits that can't be mistaken for one another (no i l o 0 1)
    select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', 1 + get_byte(b, i) % 31, 1), '' order by i) into c
      from (select extensions.gen_random_bytes(10) as b) r, generate_series(0, 9) i;
    begin
      insert into public.friend_map_links (user_id, code) values (uid, c);
      return c;
    exception when unique_violation then
      null;  -- that code is taken, or another tab just made my link: go round again
    end;
  end loop;
  raise exception 'could not make a link';
end $$;

-- Stops my link: it no longer opens. A link made later gets a new code.
create function public.stop_friends_link() returns void
language sql volatile security definer set search_path = '' as $$
  delete from public.friend_map_links where user_id = (select auth.uid());
$$;

-- Opens a link. Answers {"map": ...} or {"error": "gone" | "empty"}. With «بس اسمي» on (o.hide), every
-- friend's name goes out empty.
create function public.open_friends_link(link text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid;
  d jsonb;
begin
  select user_id into uid from public.friend_map_links where code = lower(trim(coalesce(link, '')));
  if uid is null then return jsonb_build_object('error', 'gone'); end if;
  select data into d from public.friend_maps where user_id = uid;
  if d is null or jsonb_typeof(d->'g') is distinct from 'object' or jsonb_typeof(d->'p') is distinct from 'object' then
    return jsonb_build_object('error', 'empty');
  end if;
  if d->'o'->>'hide' = 'true' then
    d := jsonb_set(d, '{p}', coalesce((
      select jsonb_object_agg(k, case when jsonb_typeof(v) = 'object' then jsonb_set(v, '{n}', '""') else 'null'::jsonb end)
      from jsonb_each(d->'p') as e(k, v)), '{}'::jsonb));
  end if;
  return jsonb_build_object('map', d);
end $$;

revoke execute on function public.my_friends_link(), public.make_friends_link(), public.stop_friends_link() from public, anon;
grant execute on function public.my_friends_link(), public.make_friends_link(), public.stop_friends_link() to authenticated;
revoke execute on function public.open_friends_link(text) from public;
grant execute on function public.open_friends_link(text) to anon, authenticated;
