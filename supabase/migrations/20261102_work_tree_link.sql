-- شرباكة: «رابط الشجرة كاملة» for «شجرة دوامي», a link to the whole work tree (shorbaka.com/w/#code).
-- Ali's call (2026-11-02): every work tree gets its own link, with no password. Whoever has the link
-- sees the tree as it is now, and nobody can change anything there. The owner can stop the link any
-- time; a link made after that gets a new code. When the owner hides names («أخفي الأسامي»), only the
-- people marked «ربعي» keep theirs, and the other names never leave the database.
-- Needs 20261102_work_tree.sql first.

create extension if not exists pgcrypto with schema extensions;

create table public.work_tree_links (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[a-z0-9]{10}$'),
  created_at timestamptz not null default now()
);

comment on table public.work_tree_links is 'Each account''s link to its whole work tree (no password). Read and changed only through the functions below. Deleted with the account.';

alter table public.work_tree_links enable row level security;
-- No policies on purpose: nobody reads or writes this table directly.
revoke all on public.work_tree_links from anon, authenticated;

-- My link's code, or null when I have none.
create function public.my_work_link() returns text
language sql stable security definer set search_path = '' as $$
  select code from public.work_tree_links where user_id = (select auth.uid());
$$;

-- Makes my link if I have none yet. Returns its code (the one I already have, if I do).
create function public.make_work_link() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  c text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  for attempt in 1..20 loop
    select code into c from public.work_tree_links where user_id = uid;
    if c is not null then return c; end if;
    -- 10 letters and digits that can't be mistaken for one another (no i l o 0 1)
    select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', 1 + get_byte(b, i) % 31, 1), '' order by i) into c
      from (select extensions.gen_random_bytes(10) as b) r, generate_series(0, 9) i;
    begin
      insert into public.work_tree_links (user_id, code) values (uid, c);
      return c;
    exception when unique_violation then
      null;  -- that code is taken, or another tab just made my link: go round again
    end;
  end loop;
  raise exception 'could not make a link';
end $$;

-- Stops my link: it no longer opens. A link made later gets a new code.
create function public.stop_work_link() returns void
language sql volatile security definer set search_path = '' as $$
  delete from public.work_tree_links where user_id = (select auth.uid());
$$;

-- Opens a link. Answers {"tree": ...} or {"error": "gone" | "empty"}. With «أخفي الأسامي» on, only
-- the people marked «ربعي» (h) keep their names; everyone else's name goes out empty.
create function public.open_work_link(link text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid;
  d jsonb;
begin
  select user_id into uid from public.work_tree_links where code = lower(trim(coalesce(link, '')));
  if uid is null then return jsonb_build_object('error', 'gone'); end if;
  select data into d from public.work_trees where user_id = uid;
  if d is null or jsonb_typeof(d->'p') is distinct from 'object' then return jsonb_build_object('error', 'empty'); end if;
  if d->'o'->>'hide' = 'true' then
    d := jsonb_set(d, '{p}', coalesce((
      select jsonb_object_agg(k, case
          when jsonb_typeof(v) <> 'object' then 'null'::jsonb
          when coalesce(v->>'h', '') in ('1', 'true') then v
          else jsonb_set(v, '{n}', '""') end)
      from jsonb_each(d->'p') as e(k, v)), '{}'::jsonb));
  end if;
  return jsonb_build_object('tree', d);
end $$;

revoke execute on function public.my_work_link(), public.make_work_link(), public.stop_work_link() from public, anon;
grant execute on function public.my_work_link(), public.make_work_link(), public.stop_work_link() to authenticated;
revoke execute on function public.open_work_link(text) from public;
grant execute on function public.open_work_link(text) to anon, authenticated;
