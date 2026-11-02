-- شرباكة: «رابط الشجرة كاملة» without a password, when its owner wants that: the same link (and the
-- QR already shared) then opens for anyone who has it. The owner can put a password back any time.
-- A link without a password keeps pass_hash null. Needs 20261102_tree_link.sql first.

alter table public.tree_links alter column pass_hash drop not null;

-- My link: {"code": ..., "open": true when it opens without a password}, or null when I have none.
create function public.my_tree_link_state() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('code', code, 'open', pass_hash is null)
    from public.tree_links where user_id = (select auth.uid());
$$;

-- Takes my link's password off, making the link if I have none yet. Returns its code.
create function public.open_my_tree_link() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  c text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  for attempt in 1..20 loop
    update public.tree_links set pass_hash = null, fails = 0, fails_since = null, updated_at = now()
      where user_id = uid returning code into c;
    if c is not null then return c; end if;
    -- 10 letters and digits that can't be mistaken for one another (no i l o 0 1)
    select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', 1 + get_byte(b, i) % 31, 1), '' order by i) into c
      from (select extensions.gen_random_bytes(10) as b) r, generate_series(0, 9) i;
    begin
      insert into public.tree_links (user_id, code, pass_hash) values (uid, c, null);
      return c;
    exception when unique_violation then
      null;  -- that code is taken, or another tab just made my link: go round again
    end;
  end loop;
  raise exception 'could not make a link';
end $$;

-- The page a link opens asks this first. A link without a password answers {"tree": ...} straight
-- away; one with a password answers {"error": "password"} (then the page asks for it and uses
-- open_tree_link). Also {"error": "gone" | "empty"}. Never counts as a wrong password.
create function public.open_free_tree_link(link text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  l public.tree_links;
  d jsonb;
begin
  select * into l from public.tree_links where code = lower(trim(coalesce(link, '')));
  if not found then return jsonb_build_object('error', 'gone'); end if;
  if l.pass_hash is not null then return jsonb_build_object('error', 'password'); end if;
  select data into d from public.family_trees where user_id = l.user_id;
  if d is null then return jsonb_build_object('error', 'empty'); end if;
  if d->'o'->>'hideF' = 'true' and jsonb_typeof(d->'p') = 'object' then
    d := jsonb_set(d, '{p}', coalesce((
      select jsonb_object_agg(k, case when v->>'g' = 'f' then jsonb_set(v, '{n}', '""') else v end)
      from jsonb_each(d->'p') as e(k, v)), '{}'::jsonb));
  end if;
  return jsonb_build_object('tree', d);
end $$;

-- open_tree_link as before, and a link without a password opens whatever password comes with it.
create or replace function public.open_tree_link(link text, password text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  l public.tree_links;
  d jsonb;
begin
  select * into l from public.tree_links where code = lower(trim(coalesce(link, ''))) for update;
  if not found then return jsonb_build_object('error', 'gone'); end if;
  if l.pass_hash is not null then
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
  end if;
  select data into d from public.family_trees where user_id = l.user_id;
  if d is null then return jsonb_build_object('error', 'empty'); end if;
  if d->'o'->>'hideF' = 'true' and jsonb_typeof(d->'p') = 'object' then
    d := jsonb_set(d, '{p}', coalesce((
      select jsonb_object_agg(k, case when v->>'g' = 'f' then jsonb_set(v, '{n}', '""') else v end)
      from jsonb_each(d->'p') as e(k, v)), '{}'::jsonb));
  end if;
  return jsonb_build_object('tree', d);
end $$;

revoke execute on function public.my_tree_link_state(), public.open_my_tree_link() from public, anon;
grant execute on function public.my_tree_link_state(), public.open_my_tree_link() to authenticated;
revoke execute on function public.open_free_tree_link(text) from public;
grant execute on function public.open_free_tree_link(text) to anon, authenticated;
