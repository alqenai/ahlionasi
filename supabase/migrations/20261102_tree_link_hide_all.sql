-- شرباكة: «الأسامي» on the «رابط الشجرة كاملة» page. The owner picks whose names others see in the
-- pictures, the PDF and on the link page: everyone's, «بدون البنات» (o.hideF: girls' and women's names
-- hidden, as before) or «بس اسمي» (o.hideAll: everyone's hidden but the owner's own, Ali 2026-11-02).
-- Hidden names never leave the database: the tree a link opens comes with them blanked. The names of
-- those whose suggestions the owner added (h) aren't shown anywhere, so they stay out too.
-- Needs 20261102_tree_link_open.sql first. Safe to run again.

-- The tree as a link shows it: hidden names blanked, h left out. Only the two functions below use it.
create or replace function public.tree_as_shared(d jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select case when coalesce(jsonb_typeof(d->'p'), '') <> 'object' then d - 'h'
    else jsonb_set(d - 'h', '{p}', coalesce((
      select jsonb_object_agg(k, case
        when d->'o'->>'hideAll' = 'true' then case when k = d->>'me' then v else jsonb_set(v, '{n}', '""') end
        when d->'o'->>'hideF' = 'true' and v->>'g' = 'f' then jsonb_set(v, '{n}', '""')
        else v end)
      from jsonb_each(d->'p') as e(k, v)), '{}'::jsonb))
  end;
$$;
revoke execute on function public.tree_as_shared(jsonb) from public, anon, authenticated;

-- The page a link opens asks this first. A link without a password answers {"tree": ...} straight
-- away; one with a password answers {"error": "password"} (then the page asks for it and uses
-- open_tree_link). Also {"error": "gone" | "empty"}. Never counts as a wrong password.
create or replace function public.open_free_tree_link(link text) returns jsonb
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
  d := public.tree_as_shared(d);
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
  d := public.tree_as_shared(d);
  return jsonb_build_object('tree', d);
end $$;
