-- شرباكة: «تحدي» (shorbaka.com/#game). The questions of the game: a small map of you and someone
-- («شنو يصير لك؟») or a question / riddle, each with three answers and the first one right. Admins add,
-- change and turn them on or off from shorbaka.com/dash/ → «الأسئلة». Every visitor reads the ones that
-- are on through game_questions(); a round picks 10 of them at random in the browser.
-- Needs 20261102_admin.sql and 20261102_site_flags.sql first. Running it also puts in the starter questions (game-bank.js).

create table public.game_questions (
  id bigint generated always as identity primary key,
  kind text not null default 'text' check (kind in ('map', 'text')),
  question text not null default '' check (length(question) <= 300),
  path text not null default '' check (path ~ '^[FMBZSDHW]{0,8}$'),
  answer text not null check (length(answer) between 1 and 80),
  wrong1 text not null check (length(wrong1) between 1 and 80),
  wrong2 text not null check (length(wrong2) between 1 and 80),
  is_on boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind = 'text' or path <> ''),
  check (kind = 'map' or question <> '')
);
comment on table public.game_questions is 'Questions of the «تحدي» game. path: F أبو, M أم, B أخو, Z أخت, S ولد, D بنت, H زوج, W زوجة.';
alter table public.game_questions enable row level security;
-- No policies on purpose: read through game_questions(), changed through the admin_* functions below.
revoke all on public.game_questions from anon, authenticated;

-- The questions that are on, for every visitor: [{id, k, q, p, a: [right, wrong, wrong]}].
create function public.game_questions() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'k', kind, 'q', question, 'p', path,
    'a', jsonb_build_array(answer, wrong1, wrong2)) order by id), '[]'::jsonb)
  from public.game_questions where is_on;
$$;

-- All of them, on and off (admins only).
create function public.admin_game_questions() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_check();
  return (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'k', kind, 'q', question, 'p', path,
    'a', jsonb_build_array(answer, wrong1, wrong2), 'on', is_on, 'at', updated_at) order by id), '[]'::jsonb)
    from public.game_questions);
end $$;

-- Adds a question (qid null) or changes one; returns its id. Admins only, noted in admin_log.
create function public.admin_save_question(qid bigint, q_kind text, q_text text, q_path text,
  q_answer text, q_wrong1 text, q_wrong2 text, turn_on boolean) returns bigint
language plpgsql volatile security definer set search_path = '' as $$
declare
  out_id bigint;
begin
  perform public.admin_check();
  if qid is null then
    insert into public.game_questions (kind, question, path, answer, wrong1, wrong2, is_on)
      values (q_kind, btrim(coalesce(q_text, '')), upper(coalesce(q_path, '')), btrim(q_answer), btrim(q_wrong1), btrim(q_wrong2), coalesce(turn_on, true))
      returning id into out_id;
  else
    update public.game_questions set kind = q_kind, question = btrim(coalesce(q_text, '')), path = upper(coalesce(q_path, '')),
      answer = btrim(q_answer), wrong1 = btrim(q_wrong1), wrong2 = btrim(q_wrong2), is_on = coalesce(turn_on, is_on), updated_at = now()
      where id = qid returning id into out_id;
    if out_id is null then raise exception 'no such question'; end if;
  end if;
  insert into public.admin_log (admin_id, action, target_email)
    values ((select auth.uid()), case when qid is null then 'question_add' else 'question_edit' end, out_id::text);
  return out_id;
end $$;

-- Turns one on or off (admins only).
create function public.admin_set_question_on(qid bigint, turn_on boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform public.admin_check();
  update public.game_questions set is_on = coalesce(turn_on, false), updated_at = now() where id = qid;
  insert into public.admin_log (admin_id, action, target_email)
    values ((select auth.uid()), case when turn_on then 'question_on' else 'question_off' end, qid::text);
end $$;

-- Deletes one for good (admins only).
create function public.admin_delete_question(qid bigint) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform public.admin_check();
  delete from public.game_questions where id = qid;
  insert into public.admin_log (admin_id, action, target_email) values ((select auth.uid()), 'question_delete', qid::text);
end $$;

revoke execute on function public.game_questions(), public.admin_game_questions(),
  public.admin_save_question(bigint, text, text, text, text, text, text, boolean),
  public.admin_set_question_on(bigint, boolean), public.admin_delete_question(bigint) from public;
grant execute on function public.game_questions() to anon, authenticated;
revoke execute on function public.admin_game_questions(),
  public.admin_save_question(bigint, text, text, text, text, text, text, boolean),
  public.admin_set_question_on(bigint, boolean), public.admin_delete_question(bigint) from anon;
grant execute on function public.admin_game_questions(),
  public.admin_save_question(bigint, text, text, text, text, text, text, boolean),
  public.admin_set_question_on(bigint, boolean), public.admin_delete_question(bigint) to authenticated;

-- One challenge every 24 hours (Ali, 2026-11-03). Signed in: per account, and every score is kept
-- («نتائج التحدي» in the account menu). Not signed in: per internet address (kept only as a hash, and
-- forgotten after two days); the score isn't kept. Admins can play any time. The address check can be
-- turned off from the dashboard (المزايا → game_ip), since a whole house shares one address.
create table public.game_plays (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,
  ip_hash text,
  score smallint check (score between 0 and 50),
  of_n smallint check (of_n between 1 and 50),
  marks text check (marks ~ '^[01]{0,50}$'),
  points smallint check (points between 0 and 5000),
  played_at timestamptz not null default now()
);
create index game_plays_user on public.game_plays (user_id, played_at desc);
create index game_plays_ip on public.game_plays (ip_hash, played_at desc) where user_id is null;
comment on table public.game_plays is 'Each «تحدي» played: who (account, or a hash of the address), when, and the score.';
alter table public.game_plays enable row level security;
revoke all on public.game_plays from anon, authenticated;

insert into public.site_flags (key, is_on) values ('game_ip', true) on conflict (key) do nothing;

-- The address the request came from, hashed (null when unknown).
create function public.game_ip_hash() returns text
language sql stable security definer set search_path = '' as $$
  select case when ip is null or ip = '' then null
    else encode(extensions.digest('shorbaka-game:' || ip, 'sha256'), 'hex') end
  from (select btrim(coalesce(h ->> 'cf-connecting-ip', h ->> 'x-real-ip', split_part(h ->> 'x-forwarded-for', ',', 1))) as ip
    from (select coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json as h) x) y;
$$;

-- When the last challenge was, for whoever is asking (null: none in the last 24 hours, or an admin).
create function public.game_last_play() returns timestamptz
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  ih text;
begin
  if uid is not null then
    if exists (select 1 from public.admins where user_id = uid) then return null; end if;
    return (select max(played_at) from public.game_plays where user_id = uid and played_at > now() - interval '24 hours');
  end if;
  if not coalesce((select is_on from public.site_flags where key = 'game_ip'), true) then return null; end if;
  ih := public.game_ip_hash();
  if ih is null then return null; end if;
  return (select max(played_at) from public.game_plays where user_id is null and ip_hash = ih and played_at > now() - interval '24 hours');
end $$;

-- Can I play now? {ok: true} or {ok: false, next: when}.
create function public.game_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  last timestamptz := public.game_last_play();
begin
  if last is null then return jsonb_build_object('ok', true); end if;
  return jsonb_build_object('ok', false, 'next', last + interval '24 hours');
end $$;

-- Starts a challenge: {ok: true, play: id} (the 24 hours start now), or {ok: false, next: when}.
create function public.game_start() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  last timestamptz := public.game_last_play();
  pid bigint;
begin
  if last is not null then return jsonb_build_object('ok', false, 'next', last + interval '24 hours'); end if;
  delete from public.game_plays where user_id is null and played_at < now() - interval '2 days';
  insert into public.game_plays (user_id, ip_hash) values (uid, case when uid is null then public.game_ip_hash() end)
    returning id into pid;
  return jsonb_build_object('ok', true, 'play', pid);
end $$;

-- The score of a challenge started within the hour, by the same account (or the same not-signed-in visitor).
-- sc: right answers out of total; pts: the points (100 a question at most, fewer the slower).
create function public.game_finish(play bigint, sc integer, total integer, marks text, pts integer) returns void
language sql volatile security definer set search_path = '' as $$
  update public.game_plays set score = sc, of_n = total, marks = game_finish.marks, points = pts
  where id = play and score is null and played_at > now() - interval '1 hour'
    and user_id is not distinct from (select auth.uid());
$$;

-- My scores: {total: all my points added up, plays: how many, rows: [{at, score, of, marks, points}] newest first}.
create function public.my_game_results() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'total', (select coalesce(sum(points), 0) from public.game_plays where user_id = (select auth.uid()) and score is not null),
    'plays', (select count(*) from public.game_plays where user_id = (select auth.uid()) and score is not null),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object('at', played_at, 'score', score, 'of', of_n, 'marks', marks, 'points', points) order by played_at desc), '[]'::jsonb)
      from (select * from public.game_plays where user_id = (select auth.uid()) and score is not null order by played_at desc limit 200) r));
$$;

revoke execute on function public.game_ip_hash(), public.game_last_play(), public.game_status(), public.game_start(),
  public.game_finish(bigint, integer, integer, text, integer), public.my_game_results() from public;
grant execute on function public.game_status(), public.game_start(), public.game_finish(bigint, integer, integer, text, integer) to anon, authenticated;
grant execute on function public.my_game_results() to authenticated;

-- The starter questions (the same list as game-bank.js).
insert into public.game_questions (kind, question, path, answer, wrong1, wrong2) values
  ('map', '', 'FB', 'عمي', 'خالي', 'جدي'),
  ('map', '', 'FZ', 'عمتي', 'خالتي', 'جدتي'),
  ('map', '', 'MB', 'خالي', 'عمي', 'جدي'),
  ('map', '', 'MZ', 'خالتي', 'عمتي', 'أختي'),
  ('map', '', 'FF', 'جدي', 'عمي', 'خالي'),
  ('map', '', 'FM', 'جدتي', 'عمتي', 'خالتي'),
  ('map', '', 'MF', 'جدي', 'خالي', 'عم أمي'),
  ('map', '', 'MM', 'جدتي', 'خالتي', 'عمتي'),
  ('map', '', 'FBS', 'ولد عمي', 'ولد خالي', 'أخوي'),
  ('map', '', 'FBD', 'بنت عمي', 'بنت خالي', 'عمتي'),
  ('map', '', 'FZS', 'ولد عمتي', 'ولد عمي', 'ولد خالتي'),
  ('map', '', 'FZD', 'بنت عمتي', 'بنت خالتي', 'بنت عمي'),
  ('map', '', 'MBS', 'ولد خالي', 'ولد عمي', 'ولد خالتي'),
  ('map', '', 'MBD', 'بنت خالي', 'بنت خالتي', 'خالتي'),
  ('map', '', 'MZS', 'ولد خالتي', 'ولد خالي', 'ولد عمتي'),
  ('map', '', 'MZD', 'بنت خالتي', 'بنت عمتي', 'بنت خالي'),
  ('map', '', 'BS', 'ولد أخوي', 'ولد أختي', 'ولد عمي'),
  ('map', '', 'BD', 'بنت أخوي', 'بنت أختي', 'بنت عمي'),
  ('map', '', 'ZS', 'ولد أختي', 'ولد أخوي', 'ولد خالتي'),
  ('map', '', 'ZD', 'بنت أختي', 'بنت أخوي', 'بنت خالتي'),
  ('map', '', 'SS', 'حفيدي', 'ولد أخوي', 'ولد عمي'),
  ('map', '', 'DD', 'حفيدتي', 'بنت أختي', 'بنت عمي'),
  ('map', '', 'SD', 'حفيدتي', 'بنت أخوي', 'بنتي'),
  ('map', '', 'DS', 'حفيدي', 'ولد أختي', 'ولدي'),
  ('map', '', 'FFB', 'عم أبوي', 'عمي', 'خال أبوي'),
  ('map', '', 'FFZ', 'عمة أبوي', 'عمتي', 'خالة أبوي'),
  ('map', '', 'FMB', 'خال أبوي', 'عم أبوي', 'خالي'),
  ('map', '', 'FMZ', 'خالة أبوي', 'عمة أبوي', 'خالتي'),
  ('map', '', 'MFB', 'عم أمي', 'خال أمي', 'عمي'),
  ('map', '', 'MFZ', 'عمة أمي', 'خالة أمي', 'عمتي'),
  ('map', '', 'MMB', 'خال أمي', 'عم أمي', 'خالي'),
  ('map', '', 'MMZ', 'خالة أمي', 'عمة أمي', 'خالتي'),
  ('map', '', 'FFF', 'جد أبوي', 'جدي', 'عم أبوي'),
  ('map', '', 'MMM', 'جدة أمي', 'جدتي', 'خالة أمي'),
  ('map', '', 'FMF', 'جد أبوي', 'جد أمي', 'خال أبوي'),
  ('map', '', 'MFM', 'جدة أمي', 'جدة أبوي', 'عمة أمي'),
  ('map', '', 'FBSS', 'ولد ولد عمي', 'ولد عمي', 'ولد أخوي'),
  ('map', '', 'FBSD', 'بنت ولد عمي', 'بنت عمي', 'بنت أخوي'),
  ('map', '', 'FBDS', 'ولد بنت عمي', 'ولد عمي', 'ولد عمتي'),
  ('map', '', 'FZSS', 'ولد ولد عمتي', 'ولد عمتي', 'ولد ولد عمي'),
  ('map', '', 'MBSD', 'بنت ولد خالي', 'بنت خالي', 'بنت ولد خالتي'),
  ('map', '', 'MZDS', 'ولد بنت خالتي', 'ولد خالتي', 'ولد بنت خالي'),
  ('map', '', 'FFBS', 'ولد عم أبوي', 'ولد عمي', 'عم أبوي'),
  ('map', '', 'MFBS', 'ولد عم أمي', 'ولد خالي', 'ولد عم أبوي'),
  ('map', '', 'FMZD', 'بنت خالة أبوي', 'بنت خالتي', 'بنت عمة أبوي'),
  ('map', '', 'BSS', 'ولد ولد أخوي', 'ولد أخوي', 'حفيدي'),
  ('map', '', 'ZDD', 'بنت بنت أختي', 'بنت أختي', 'حفيدتي'),
  ('map', '', 'SSS', 'ولد حفيدي', 'حفيدي', 'ولد ولد أخوي'),
  ('map', '', 'FBW', 'زوجة عمي', 'عمتي', 'خالتي'),
  ('map', '', 'FZH', 'زوج عمتي', 'عمي', 'خالي'),
  ('map', '', 'MBW', 'زوجة خالي', 'خالتي', 'عمتي'),
  ('map', '', 'MZH', 'زوج خالتي', 'خالي', 'عمي'),
  ('map', '', 'BW', 'زوجة أخوي', 'أختي', 'بنت عمي'),
  ('map', '', 'ZH', 'زوج أختي', 'أخوي', 'ولد عمي'),
  ('map', '', 'SW', 'زوجة ولدي', 'بنتي', 'حفيدتي'),
  ('map', '', 'DH', 'زوج بنتي', 'ولدي', 'حفيدي'),
  ('map', '', 'WB', 'نسيبي', 'عديلي', 'ولد عمي'),
  ('map', '', 'WZH', 'عديلي', 'نسيبي', 'أخوي'),
  ('map', '', 'FBSW', 'زوجة ولد عمي', 'بنت عمي', 'زوجة عمي'),
  ('map', '', 'MZDH', 'زوج بنت خالتي', 'ولد خالتي', 'زوج خالتي'),
  ('text', 'سارة أخت أبو فهد. سارة شنو تصير لفهد؟', '', 'عمته', 'خالته', 'جدته'),
  ('text', 'مريم أخت أم ناصر. ناصر شنو يصير لمريم؟', '', 'ولد أختها', 'ولد أخوها', 'ولد عمها'),
  ('text', 'علي عنده أخت اسمها نورة، ونورة عندها ولد. علي شنو يصير للولد؟', '', 'خاله', 'عمه', 'جده'),
  ('text', 'خالد ولد عم بدر. أبو خالد شنو يصير لبدر؟', '', 'عمه', 'خاله', 'أخوه'),
  ('text', 'لولوة بنت خالة دانة. أم لولوة شنو تصير لدانة؟', '', 'خالتها', 'عمتها', 'أختها'),
  ('text', 'يوسف أبو سلمان، وسلمان أبو جاسم. يوسف شنو يصير لجاسم؟', '', 'جده', 'عمه', 'جد أبوه'),
  ('text', 'هيا أخت جاسم، وجاسم أبو مشعل. هيا شنو تصير لمشعل؟', '', 'عمته', 'خالته', 'أخته'),
  ('text', 'حمد أخو جد يوسف (أبو أبوه). حمد شنو يصير ليوسف؟', '', 'عم أبوه', 'عمه', 'جده'),
  ('text', 'فاطمة أم أم سعود. بنت فاطمة الثانية شنو تصير لسعود؟', '', 'خالته', 'عمته', 'جدته'),
  ('text', 'أحمد ومحمد إخوان. ولد أحمد وولد محمد شنو يصيرون لبعض؟', '', 'عيال عم', 'عيال خال', 'إخوان'),
  ('text', 'نورة وشيخة خوات. عيال نورة وعيال شيخة شنو يصيرون لبعض؟', '', 'عيال خالة', 'عيال عم', 'عيال عمة'),
  ('text', 'مبارك أخو أمل. عيال مبارك وعيال أمل شنو يصيرون لبعض؟', '', 'عيال خال وعمة', 'عيال عم', 'عيال خالة'),
  ('text', 'بدرية بنت عم أم راشد. بدرية شنو تصير لأم راشد؟', '', 'بنت عمها', 'أختها', 'عمتها'),
  ('text', 'عبدالله ولد سارة، وسارة أخت منيرة. عبدالله شنو يصير لعيال منيرة؟', '', 'ولد خالتهم', 'ولد عمهم', 'أخوهم'),
  ('text', 'ناصر زوج أخت بدر. بدر شنو يصير لعيال ناصر؟', '', 'خالهم', 'عمهم', 'جدهم'),
  ('text', 'ولد أبوك وأمك، وما هو أخوك. منو؟', '', 'أنت', 'ولد عمك', 'ولد خالك'),
  ('text', 'أخت خالك، وما هي خالتك. منو؟', '', 'أمك', 'عمتك', 'جدتك'),
  ('text', 'أخو عمك، وما هو عمك. منو؟', '', 'أبوك', 'خالك', 'جدك'),
  ('text', 'رجال يقول: ما عندي إخوان ولا خوات، بس أبو هذا الرجال ولد أبوي. منو الرجال؟', '', 'ولده', 'هو نفسه', 'ولد أخوه'),
  ('text', 'بنت تقول: أبو هذا الولد ولد أبوي الوحيد. الولد شنو يصير لها؟', '', 'ولد أخوها', 'أخوها', 'ولدها'),
  ('text', 'أبوين وولدين راحوا البر، وكل واحد أخذ كرسي، وكانوا ثلاث كراسي بس. شلون؟', '', 'كانوا جد وأبو وولد', 'واحد قعد على الأرض', 'واحد ما راح'),
  ('text', 'جد وأبو وولد، كم أبو فيهم؟', '', '2', '1', '3'),
  ('text', 'جد وأبو وولد، كم ولد فيهم؟', '', '2', '1', '3'),
  ('text', 'أبو عمك شنو يصير لك؟', '', 'جدك', 'أبوك', 'عم أبوك'),
  ('text', 'أم خالتك شنو تصير لك؟', '', 'جدتك', 'أمك', 'خالة أمك'),
  ('text', 'أبو ولد أخوك شنو يصير لك؟', '', 'أخوك', 'عمك', 'ولد عمك'),
  ('text', 'أم ولد خالك شنو تصير لك؟', '', 'زوجة خالك', 'خالتك', 'عمتك'),
  ('text', 'ولد عمك، أبوه شنو يصير لأبوك؟', '', 'أخوه', 'ولد عمه', 'خاله'),
  ('text', 'بنت عمك، شنو تصير لأبوك؟', '', 'بنت أخوه', 'بنت أخته', 'أخته'),
  ('text', 'ولد خالتك، أمه شنو تصير لأمك؟', '', 'أختها', 'بنت عمها', 'خالتها'),
  ('text', 'بنت عمتك، أمها شنو تصير لأبوك؟', '', 'أخته', 'بنت عمه', 'زوجته'),
  ('text', 'أبوك عنده 3 إخوان وأختين. كم عم عندك؟', '', '3', '5', '2'),
  ('text', 'أمك عندها 4 خوات وأخو واحد. كم خالة عندك؟', '', '4', '5', '1'),
  ('text', 'جدك أبو أبوك عنده 6 عيال، واحد منهم أبوك. كم عم وعمة عندك؟', '', '5', '6', '7'),
  ('text', 'أبوك عنده 3 إخوان، كل واحد منهم عنده ولدين. كم ولد عم عندك؟', '', '6', '3', '5'),
  ('text', 'جدتك أم أمك عندها 3 بنات وولد. كم خالة عندك؟', '', '2', '3', '1'),
  ('text', 'كم جد وجدة عندك من الجهتين؟', '', '4', '2', '6'),
  ('text', 'كم واحد بجيل أجداد أبوك وأمك (أبو وأم كل جد وجدة)؟', '', '8', '4', '6'),
  ('text', 'كم جيل بينك وبين جد أبوك؟', '', '3', '2', '4'),
  ('text', 'عم أبوك من أي جيل؟', '', 'جيل أجدادي', 'جيل أبوي وأمي', 'جيلي'),
  ('text', 'ولد أخوك من أي جيل؟', '', 'جيل عيالي', 'جيلي', 'جيل أحفادي'),
  ('text', 'بنت بنت عمك من أي جيل؟', '', 'جيل عيالي', 'جيلي', 'جيل أحفادي'),
  ('text', 'خالة أمك من أي جيل؟', '', 'جيل أجدادي', 'جيل أبوي وأمي', 'جيل أجداد أبوي وأمي'),
  ('text', 'ولد عمك وولد خالك، من أي جيل؟', '', 'جيلي', 'جيل أبوي وأمي', 'جيل عيالي'),
  ('text', 'منو أكبر بالجيل: عم أبوك ولا ولد عمك؟', '', 'عم أبوي', 'ولد عمي', 'نفس الجيل'),
  ('text', 'فهد سالم ناصر: شنو اسم أبو فهد؟', '', 'سالم', 'ناصر', 'فهد'),
  ('text', 'فهد سالم ناصر: ناصر شنو يصير لفهد؟', '', 'جده', 'أبوه', 'عمه'),
  ('text', 'فهد سالم ناصر العلي: «العلي» شنو تكون؟', '', 'اسم العائلة', 'اسم جده', 'اسم أمه'),
  ('text', 'بالاسم الرباعي، الاسم الثالث يكون اسم منو؟', '', 'الجد', 'الأبو', 'العم'),
  ('text', 'أولاد العم والعمة من أي جهة؟', '', 'جهة الأبو', 'جهة الأم', 'جهة الزوجة'),
  ('text', 'الخال والخالة من أي جهة؟', '', 'جهة الأم', 'جهة الأبو', 'جهة الجد'),
  ('text', '«الحفيد» منو؟', '', 'ولد ولدك أو ولد بنتك', 'ولد أخوك', 'ولد عمك'),
  ('text', '«العديل» منو؟', '', 'زوج أخت زوجتك', 'أخو زوجتك', 'ولد عمك'),
  ('text', '«النسيب» منو؟', '', 'قريبك من الزواج', 'ولد عمك', 'جارك'),
  ('text', '«صلة الرحم» يعني شنو؟', '', 'تزور أهلك وتسأل عنهم', 'تكتب شجرة عائلتك', 'تحفظ أسامي جدودك'),
  ('text', '«الأرحام» منو؟', '', 'الأهل والأقارب', 'الجيران', 'الربع'),
  ('text', '«السبط» بالفصحى يعني؟', '', 'ولد البنت', 'ولد الأخو', 'الجد'),
  ('text', '«بن» بالاسم معناها؟', '', 'ولد', 'أخو', 'جد');
