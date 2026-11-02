-- شرباكة: «اقترح إضافة». Whoever opens a «رابط الشجرة كاملة» that has a password can add people to
-- the tree as suggestions (with their own name) and send them to the tree's owner. Nothing changes in
-- the tree until the owner looks at them and picks which to add. Needs 20261102_tree_link.sql and
-- 20261102_tree_link_open.sql first.
--
-- A suggestion keeps the steps the person took, in order: ops = [{ "id": "p57", "of": "p3", "t": "S",
-- "n": "سعود", "mate": "p9" }, ...]: add a t (F M B Z S D H W, as in the finder) of person "of", named n.
-- "id" names the new person so a later step can build on them; "mate" picks which marriage a child
-- belongs to. The owner's page replays the steps it picks on the tree as it is then.

create table public.tree_suggestions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  from_name text not null check (char_length(from_name) between 1 and 40),
  ops jsonb not null check (jsonb_typeof(ops) = 'array' and jsonb_array_length(ops) between 1 and 100
    and pg_column_size(ops) <= 32000),
  created_at timestamptz not null default now()
);
create index tree_suggestions_owner_idx on public.tree_suggestions (owner_id, created_at);

comment on table public.tree_suggestions is 'Additions suggested to a family tree by people who opened its password link. Read and removed only by the tree''s owner, through the functions below.';

alter table public.tree_suggestions enable row level security;
-- No policies on purpose: nobody reads or writes this table directly.
revoke all on public.tree_suggestions from anon, authenticated;

-- Sends a suggestion through a link with a password. Answers {"ok": true} or {"error": ...}:
-- "gone" (no such link), "open" (the link has no password, so it takes no suggestions), "wrong",
-- "wait" (too many wrong passwords, or too many suggestions this hour), "full" (50 waiting already), "bad".
create function public.suggest_to_tree(link text, password text, name text, ops jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  l public.tree_links;
  who text := btrim(regexp_replace(coalesce(name, ''), '\s+', ' ', 'g'));
begin
  select * into l from public.tree_links where code = lower(trim(coalesce(link, ''))) for update;
  if not found then return jsonb_build_object('error', 'gone'); end if;
  if l.pass_hash is null then return jsonb_build_object('error', 'open'); end if;
  if l.fails_since is not null and l.fails_since < now() - interval '1 hour' then
    l.fails := 0; l.fails_since := null;
  end if;
  if l.fails >= 10 then return jsonb_build_object('error', 'wait'); end if;
  if password is null or extensions.crypt(password, l.pass_hash) <> l.pass_hash then
    update public.tree_links set fails = l.fails + 1, fails_since = coalesce(l.fails_since, now())
      where user_id = l.user_id;
    return jsonb_build_object('error', 'wrong');
  end if;
  if char_length(who) < 1 or char_length(who) > 40 or ops is null or jsonb_typeof(ops) <> 'array'
     or jsonb_array_length(ops) < 1 or jsonb_array_length(ops) > 100 or pg_column_size(ops) > 32000 then
    return jsonb_build_object('error', 'bad');
  end if;
  if (select count(*) from public.tree_suggestions where owner_id = l.user_id) >= 50 then
    return jsonb_build_object('error', 'full');
  end if;
  if (select count(*) from public.tree_suggestions
      where owner_id = l.user_id and created_at > now() - interval '1 hour') >= 20 then
    return jsonb_build_object('error', 'wait');
  end if;
  insert into public.tree_suggestions (owner_id, from_name, ops) values (l.user_id, who, ops);
  return jsonb_build_object('ok', true);
end $$;

-- My waiting suggestions, oldest first: [{ "id", "from", "at", "ops" }, ...].
create function public.my_tree_suggestions() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'from', from_name, 'at', created_at, 'ops', ops)
    order by created_at), '[]'::jsonb)
  from public.tree_suggestions where owner_id = (select auth.uid());
$$;

-- Done with a suggestion (added what I picked, or not): it goes.
create function public.drop_tree_suggestion(sid uuid) returns void
language sql volatile security definer set search_path = '' as $$
  delete from public.tree_suggestions where id = sid and owner_id = (select auth.uid());
$$;

revoke execute on function public.suggest_to_tree(text, text, text, jsonb) from public;
grant execute on function public.suggest_to_tree(text, text, text, jsonb) to anon, authenticated;
revoke execute on function public.my_tree_suggestions(), public.drop_tree_suggestion(uuid) from public, anon;
grant execute on function public.my_tree_suggestions(), public.drop_tree_suggestion(uuid) to authenticated;
