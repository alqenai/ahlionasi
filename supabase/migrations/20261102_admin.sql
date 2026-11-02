-- شرباكة: لوحة التحكم (shorbaka.com/dash/). Only accounts listed in public.admins can use it.
-- The page is public like the rest of the site; what guards the data is these functions: each one
-- checks that the signed-in account is an admin before it answers. They give counts and account
-- details (email, dates, how many people / relations / links), never the names inside a tree or
-- in saved relations, as the site promises its users.
--
-- After running this file, make yourself the admin: open shorbaka.com/dash/ signed in, copy the
-- line it shows («insert into public.admins …») and run it here in the SQL Editor.

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
comment on table public.admins is 'Accounts that can open the admin dashboard. Added by hand in the SQL Editor.';
alter table public.admins enable row level security;
-- No policies on purpose: nobody reads or writes this table from the site.
revoke all on public.admins from anon, authenticated;

-- What admins did (block, delete, stop a link), kept so nothing happens silently.
create table public.admin_log (
  id bigint generated always as identity primary key,
  admin_id uuid,
  action text not null,
  target_email text not null default '',
  at timestamptz not null default now()
);
comment on table public.admin_log is 'Actions taken from the admin dashboard.';
alter table public.admin_log enable row level security;
revoke all on public.admin_log from anon, authenticated;

create function public.am_i_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

create function public.admin_check() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admins where user_id = (select auth.uid())) then
    raise exception 'not an admin' using errcode = '42501';
  end if;
end $$;

-- The numbers at the top, and sign-ups / active accounts per day for the last 30 days (Kuwait time).
create function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  r jsonb;
begin
  perform public.admin_check();
  select jsonb_build_object(
    'users', (select count(*) from auth.users),
    'users_today', (select count(*) from auth.users
      where (created_at at time zone 'Asia/Kuwait')::date = (now() at time zone 'Asia/Kuwait')::date),
    'users_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'users_30d', (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'active_7d', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'blocked', (select count(*) from auth.users where banned_until > now()),
    'google', (select count(*) from auth.users where raw_app_meta_data->'providers' ? 'google'),
    'email', (select count(*) from auth.users where not coalesce(raw_app_meta_data->'providers' ? 'google', false)),
    'trees', (select count(*) from public.family_trees
      where jsonb_typeof(data->'p') = 'object' and (select count(*) from jsonb_object_keys(data->'p')) > 1),
    'tree_people', (select coalesce(sum((select count(*) from jsonb_object_keys(data->'p'))), 0)
      from public.family_trees where jsonb_typeof(data->'p') = 'object'),
    'trees_7d', (select count(*) from public.family_trees where updated_at > now() - interval '7 days'),
    'relations', (select count(*) from public.relations),
    'relations_7d', (select count(*) from public.relations where created_at > now() - interval '7 days'),
    'links', (select count(*) from public.tree_links),
    'links_open', (select count(*) from public.tree_links where pass_hash is null),
    'days', (
      select jsonb_agg(jsonb_build_object(
        'day', d::date,
        'signups', (select count(*) from auth.users u where (u.created_at at time zone 'Asia/Kuwait')::date = d::date),
        'relations', (select count(*) from public.relations x where (x.created_at at time zone 'Asia/Kuwait')::date = d::date)
      ) order by d)
      from generate_series((now() at time zone 'Asia/Kuwait')::date - 29, (now() at time zone 'Asia/Kuwait')::date, interval '1 day') d
    )
  ) into r;
  return r;
end $$;

-- The accounts, newest first, optionally filtered by part of the email or name. Up to 200 at a time.
create function public.admin_users(q text default '', lim integer default 50, skip integer default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  pat text := '%' || replace(replace(replace(lower(trim(coalesce(q, ''))), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  r jsonb;
begin
  perform public.admin_check();
  with m as (
    select u.* from auth.users u
    where lower(coalesce(u.email, '')) like pat
       or lower(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')) like pat
  )
  select jsonb_build_object(
    'total', (select count(*) from m),
    'rows', coalesce((
      select jsonb_agg(row_to_json(x)::jsonb order by x.created_at desc) from (
        select m.id, m.email, m.created_at, m.last_sign_in_at,
          coalesce(m.raw_user_meta_data->>'full_name', m.raw_user_meta_data->>'name', '') as name,
          coalesce(m.raw_app_meta_data->'providers', '[]'::jsonb) as providers,
          (m.banned_until is not null and m.banned_until > now()) as blocked,
          exists (select 1 from public.admins a where a.user_id = m.id) as admin,
          (select count(*) from public.relations x where x.user_id = m.id) as relations,
          (select case when jsonb_typeof(t.data->'p') = 'object' then (select count(*) from jsonb_object_keys(t.data->'p')) else 0 end
             from public.family_trees t where t.user_id = m.id) as people,
          (select t.updated_at from public.family_trees t where t.user_id = m.id) as tree_at,
          (select case when l.pass_hash is null then 'open' else 'password' end
             from public.tree_links l where l.user_id = m.id) as link
        from m order by m.created_at desc
        limit greatest(1, least(coalesce(lim, 50), 200)) offset greatest(0, coalesce(skip, 0))
      ) x), '[]'::jsonb)
  ) into r;
  return r;
end $$;

-- What happened lately: new accounts, sign-ins, trees changed, relations saved, links made, admin actions.
create function public.admin_activity(lim integer default 60) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  n integer := greatest(1, least(coalesce(lim, 60), 200));
  r jsonb;
begin
  perform public.admin_check();
  select coalesce(jsonb_agg(row_to_json(e)::jsonb order by e.at desc), '[]'::jsonb) into r from (
    (select 'signup' as kind, u.created_at as at, u.email, null::bigint as n
       from auth.users u order by u.created_at desc limit n)
    union all
    (select 'signin', u.last_sign_in_at, u.email, null
       from auth.users u where u.last_sign_in_at is not null and u.last_sign_in_at > u.created_at + interval '1 minute'
       order by u.last_sign_in_at desc limit n)
    union all
    (select 'tree', t.updated_at, u.email,
       case when jsonb_typeof(t.data->'p') = 'object' then (select count(*) from jsonb_object_keys(t.data->'p')) else 0 end
       from public.family_trees t join auth.users u on u.id = t.user_id order by t.updated_at desc limit n)
    union all
    (select 'relation', x.created_at, u.email, null
       from public.relations x join auth.users u on u.id = x.user_id order by x.created_at desc limit n)
    union all
    (select case when l.pass_hash is null then 'link_open' else 'link' end, l.updated_at, u.email, null
       from public.tree_links l join auth.users u on u.id = l.user_id order by l.updated_at desc limit n)
    union all
    (select 'admin:' || g.action, g.at, g.target_email, null
       from public.admin_log g order by g.at desc limit n)
    order by at desc limit n
  ) e;
  return r;
end $$;

-- Blocks an account (it can't sign in, and its open sessions end) or unblocks it.
create function public.admin_block(target uuid, block boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  em text;
begin
  perform public.admin_check();
  if target = (select auth.uid()) then raise exception 'you cannot block yourself'; end if;
  update auth.users set banned_until = case when block then now() + interval '100 years' else null end
    where id = target returning email into em;
  if not found then raise exception 'no such account'; end if;
  if block then
    begin
      delete from auth.sessions where user_id = target;  -- their refresh tokens go with them
    exception when others then
      null;  -- the block still holds: a blocked account can't refresh, so its sign-in ends within the hour
    end;
  end if;
  insert into public.admin_log (admin_id, action, target_email)
    values ((select auth.uid()), case when block then 'block' else 'unblock' end, coalesce(em, ''));
end $$;

-- Stops an account's «رابط الشجرة كاملة»: the link and its QR stop opening.
create function public.admin_stop_link(target uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform public.admin_check();
  delete from public.tree_links where user_id = target;
  insert into public.admin_log (admin_id, action, target_email)
    values ((select auth.uid()), 'stop_link', coalesce((select email from auth.users where id = target), ''));
end $$;

-- Deletes an account and everything saved in it, like «امسح حسابي» does for its owner.
create function public.admin_delete_user(target uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  em text;
begin
  perform public.admin_check();
  if target = (select auth.uid()) then raise exception 'you cannot delete yourself here'; end if;
  delete from auth.users where id = target returning email into em;
  if not found then raise exception 'no such account'; end if;
  insert into public.admin_log (admin_id, action, target_email) values ((select auth.uid()), 'delete', coalesce(em, ''));
end $$;

revoke execute on function public.am_i_admin(), public.admin_check(), public.admin_overview(),
  public.admin_users(text, integer, integer), public.admin_activity(integer), public.admin_block(uuid, boolean),
  public.admin_stop_link(uuid), public.admin_delete_user(uuid) from public, anon;
grant execute on function public.am_i_admin(), public.admin_overview(),
  public.admin_users(text, integer, integer), public.admin_activity(integer), public.admin_block(uuid, boolean),
  public.admin_stop_link(uuid), public.admin_delete_user(uuid) to authenticated;
