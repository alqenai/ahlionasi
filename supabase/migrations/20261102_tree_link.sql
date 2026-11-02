-- شرباكة: «رابط الشجرة», a link to the whole family tree that opens with a password its owner sets.
-- The owner can change the password any time (the link stays the same, so a QR already shared keeps
-- working with the new password) or stop the link. Whoever has the link and the password sees the
-- tree as it is now; nobody can change anything there. When the owner hides girls' and women's names
-- («أخفي أسامي البنات»), their names never leave the database.

create extension if not exists pgcrypto with schema extensions;

create table public.tree_links (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[a-z0-9]{10}$'),
  pass_hash text not null,
  fails integer not null default 0,
  fails_since timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tree_links is 'Each account''s link to its whole family tree and the link''s password (hashed). Read and changed only through the functions below. Deleted with the account.';

alter table public.tree_links enable row level security;
-- No policies on purpose: nobody reads or writes this table directly.
revoke all on public.tree_links from anon, authenticated;

-- My link's code, or null when I have none.
create function public.my_tree_link() returns text
language sql stable security definer set search_path = '' as $$
  select code from public.tree_links where user_id = (select auth.uid());
$$;

-- Sets my link's password (4 to 64 characters), making the link if I have none yet. Returns its code.
create function public.set_tree_link(password text) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  hash text;
  c text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if password is null or char_length(password) < 4 or char_length(password) > 64 then
    raise exception 'the password must be 4 to 64 characters';
  end if;
  hash := extensions.crypt(password, extensions.gen_salt('bf', 8));
  for attempt in 1..20 loop
    update public.tree_links set pass_hash = hash, fails = 0, fails_since = null, updated_at = now()
      where user_id = uid returning code into c;
    if c is not null then return c; end if;
    -- 10 letters and digits that can't be mistaken for one another (no i l o 0 1)
    select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', 1 + get_byte(b, i) % 31, 1), '' order by i) into c
      from (select extensions.gen_random_bytes(10) as b) r, generate_series(0, 9) i;
    begin
      insert into public.tree_links (user_id, code, pass_hash) values (uid, c, hash);
      return c;
    exception when unique_violation then
      null;  -- that code is taken, or another tab just made my link: go round again
    end;
  end loop;
  raise exception 'could not make a link';
end $$;

-- Stops my link: it no longer opens, even with the password. A link made later gets a new code.
create function public.stop_tree_link() returns void
language sql volatile security definer set search_path = '' as $$
  delete from public.tree_links where user_id = (select auth.uid());
$$;

-- Opens a link with its password. Answers {"tree": ...} or {"error": "gone" | "wrong" | "wait" | "empty"}.
-- After 10 wrong passwords a link waits until an hour has passed since the first of them ("minutes" left).
create function public.open_tree_link(link text, password text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  l public.tree_links;
  d jsonb;
begin
  select * into l from public.tree_links where code = lower(trim(coalesce(link, ''))) for update;
  if not found then return jsonb_build_object('error', 'gone'); end if;
  if l.fails_since is not null and l.fails_since < now() - interval '1 hour' then
    l.fails := 0; l.fails_since := null;
  end if;
  if l.fails >= 10 then
    return jsonb_build_object('error', 'wait', 'minutes',
      greatest(1, ceil(extract(epoch from l.fails_since + interval '1 hour' - now()) / 60)));
  end if;
  if password is null or extensions.crypt(password, l.pass_hash) <> l.pass_hash then
    update public.tree_links set fails = l.fails + 1, fails_since = coalesce(l.fails_since, now())
      where user_id = l.user_id;
    return jsonb_build_object('error', 'wrong');
  end if;
  update public.tree_links set fails = 0, fails_since = null where user_id = l.user_id and fails > 0;
  select data into d from public.family_trees where user_id = l.user_id;
  if d is null then return jsonb_build_object('error', 'empty'); end if;
  if d->'o'->>'hideF' = 'true' and jsonb_typeof(d->'p') = 'object' then
    d := jsonb_set(d, '{p}', coalesce((
      select jsonb_object_agg(k, case when v->>'g' = 'f' then jsonb_set(v, '{n}', '""') else v end)
      from jsonb_each(d->'p') as e(k, v)), '{}'::jsonb));
  end if;
  return jsonb_build_object('tree', d);
end $$;

revoke execute on function public.my_tree_link(), public.set_tree_link(text), public.stop_tree_link() from public, anon;
grant execute on function public.my_tree_link(), public.set_tree_link(text), public.stop_tree_link() to authenticated;
revoke execute on function public.open_tree_link(text, text) from public;
grant execute on function public.open_tree_link(text, text) to anon, authenticated;
