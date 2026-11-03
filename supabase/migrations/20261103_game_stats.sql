-- شرباكة: «تحدي» in the dashboard (shorbaka.com/dash/ → «التحدي»). Ali, 2026-11-03: everyone who plays,
-- signed in or not, is kept, so the dashboard can say how many people play and how they do.
-- Needs 20261103_game.sql first. Safe to run more than once.
--
-- Until now a challenge played without signing in was deleted after two days (it was only kept for the
-- one-a-day check). Now every challenge stays. Without an account, a challenge carries a random id the
-- site makes for that browser (not made from anything about the person), so people can be counted
-- without keeping their internet address: the address hash is still wiped after two days.
-- The dashboard shows numbers, and the email of signed-in players; the others show as «زائر».
-- Each finished challenge also keeps which questions it asked, so «الأسئلة» can say how many times each
-- question came up and how many got it right (Ali: to turn off the ones that came up a lot).

alter table public.game_plays add column if not exists device text check (device ~ '^[0-9a-f-]{16,64}$');
-- the questions of the round in the order asked (0: one made from a family tree, not from the list)
alter table public.game_plays add column if not exists qids bigint[] check (cardinality(qids) <= 50);
create index if not exists game_plays_at on public.game_plays (played_at desc);
comment on table public.game_plays is 'Each «تحدي» played: who (an account, or a random id of the browser), when, and the score. The address hash of a not-signed-in play is only kept for two days, for the one-a-day check.';

-- Starts a challenge: {ok: true, play: id} (the 24 hours start now), or {ok: false, next: when}.
-- dev: the browser's random id, kept only when not signed in.
drop function if exists public.game_start();
create or replace function public.game_start(dev text default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  last timestamptz := public.game_last_play();
  pid bigint;
begin
  if last is not null then return jsonb_build_object('ok', false, 'next', last + interval '24 hours'); end if;
  update public.game_plays set ip_hash = null
    where user_id is null and ip_hash is not null and played_at < now() - interval '2 days';
  insert into public.game_plays (user_id, ip_hash, device)
    values (uid,
      case when uid is null then public.game_ip_hash() end,
      case when uid is null and dev ~ '^[0-9a-f-]{16,64}$' then dev end)
    returning id into pid;
  return jsonb_build_object('ok', true, 'play', pid);
end $$;

-- The score of a challenge started within the hour, by the same account (or the same not-signed-in visitor).
-- sc: right answers out of total; pts: the points (100 a question at most, fewer the slower); qids: the
-- questions asked, in order (so marks says which were right).
drop function if exists public.game_finish(bigint, integer, integer, text, integer);
create or replace function public.game_finish(play bigint, sc integer, total integer, marks text, pts integer, qids bigint[] default null) returns void
language sql volatile security definer set search_path = '' as $$
  update public.game_plays set score = sc, of_n = total, marks = game_finish.marks, points = pts,
    qids = case when cardinality(game_finish.qids) <= 50 then game_finish.qids end
  where id = play and score is null and played_at > now() - interval '1 hour'
    and user_id is not distinct from (select auth.uid());
$$;

-- «الأسئلة» in the dashboard, now with how many times each question came up in a finished challenge
-- (shown) and how many got it right (right). Admins' challenges aren't counted.
create or replace function public.admin_game_questions() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_check();
  return (
    with s as (
      select q.qid, count(*) as shown, count(*) filter (where substr(g.marks, q.pos::integer, 1) = '1') as right_n
      from public.game_plays g cross join lateral unnest(g.qids) with ordinality as q(qid, pos)
      where g.qids is not null and g.score is not null and q.qid > 0
        and (g.user_id is null or not exists (select 1 from public.admins a where a.user_id = g.user_id))
      group by q.qid
    )
    select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'k', x.kind, 'q', x.question, 'p', x.path,
      'a', jsonb_build_array(x.answer, x.wrong1, x.wrong2), 'on', x.is_on, 'at', x.updated_at,
      'shown', coalesce(s.shown, 0), 'right', coalesce(s.right_n, 0)) order by x.id), '[]'::jsonb)
    from public.game_questions x left join s on s.qid = x.id);
end $$;

-- The numbers for the dashboard. A person is an account, or a browser for the ones who don't sign in.
-- Challenges played by admins (testing) are left out of the numbers and counted on their own.
create or replace function public.admin_game_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  r jsonb;
  today date := (now() at time zone 'Asia/Kuwait')::date;
begin
  perform public.admin_check();
  with p as (
    select g.*, coalesce(g.user_id::text, g.device, g.ip_hash, 'play' || g.id) as who,
      (g.played_at at time zone 'Asia/Kuwait')::date as on_day
    from public.game_plays g
    where g.user_id is null or not exists (select 1 from public.admins a where a.user_id = g.user_id)
  )
  select jsonb_build_object(
    'players', (select count(distinct who) from p),
    'accounts', (select count(distinct user_id) from p),
    'visitors', (select count(distinct who) from p where user_id is null),
    'players_today', (select count(distinct who) from p where on_day = today),
    'players_7d', (select count(distinct who) from p where played_at > now() - interval '7 days'),
    'started', (select count(*) from p),
    'finished', (select count(*) from p where score is not null),
    'avg_points', (select round(avg(points)) from p where score is not null and points is not null),
    'perfect', (select count(*) from p where score is not null and score = of_n),
    'admin_plays', (select count(*) from public.game_plays g where exists (select 1 from public.admins a where a.user_id = g.user_id))
  ) into r;
  return r;
end $$;

-- The challenges, newest first, 50 at a time (at most 200): when, the account's email (none for a
-- visitor), whether it's an admin, and the score (none if they didn't finish).
create or replace function public.admin_game_plays(lim integer default 50, skip integer default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  r jsonb;
begin
  perform public.admin_check();
  select jsonb_build_object(
    'total', (select count(*) from public.game_plays),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'at', x.played_at, 'email', x.email, 'signed', x.user_id is not null, 'admin', x.admin,
        'score', x.score, 'of', x.of_n, 'points', x.points) order by x.played_at desc, x.id desc)
      from (
        select g.id, g.played_at, g.user_id, g.score, g.of_n, g.points, u.email::text as email,
          exists (select 1 from public.admins a where a.user_id = g.user_id) as admin
        from public.game_plays g left join auth.users u on u.id = g.user_id
        order by g.played_at desc, g.id desc
        limit least(greatest(coalesce(lim, 50), 1), 200) offset greatest(coalesce(skip, 0), 0)
      ) x), '[]'::jsonb)
  ) into r;
  return r;
end $$;

revoke execute on function public.game_start(text), public.game_finish(bigint, integer, integer, text, integer, bigint[]),
  public.admin_game_questions(), public.admin_game_stats(), public.admin_game_plays(integer, integer) from public, anon, authenticated;
grant execute on function public.game_start(text), public.game_finish(bigint, integer, integer, text, integer, bigint[]) to anon, authenticated;
grant execute on function public.admin_game_questions(), public.admin_game_stats(), public.admin_game_plays(integer, integer) to authenticated;
-- Supabase lets anon run every new function in public directly, so these helpers (only used inside the
-- functions above) and «نتائج التحدي» (accounts only) are closed to it here.
revoke execute on function public.game_ip_hash(), public.game_last_play() from public, anon, authenticated;
revoke execute on function public.my_game_results() from anon;
