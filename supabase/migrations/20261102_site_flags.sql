-- شرباكة: مفاتيح المزايا. Parts of the site the admins can turn on or off from the dashboard
-- (shorbaka.com/dash/ → «المزايا») without changing code. Turning one off only hides it on the site:
-- whatever people already saved for it stays in the database, and comes back when it's turned on.
-- Needs 20261102_admin.sql first.
--
-- Keys the site knows today:
--   divorce: the «مطلقة» switch in a person's sheet, and «طليقة» / the two strokes on the tree.

create table public.site_flags (
  key text primary key check (key ~ '^[a-z_]{1,32}$'),
  is_on boolean not null default false,
  updated_at timestamptz not null default now()
);
comment on table public.site_flags is 'Parts of the site turned on or off from the admin dashboard.';
alter table public.site_flags enable row level security;
-- No policies on purpose: read through site_flags(), changed through admin_set_flag().
revoke all on public.site_flags from anon, authenticated;

insert into public.site_flags (key, is_on) values ('divorce', false);

-- What's on and off, for every visitor: {"divorce": false, ...}.
create function public.site_flags() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(key, is_on), '{}'::jsonb) from public.site_flags;
$$;

-- Turns one on or off (admins only), and notes it in admin_log.
create function public.admin_set_flag(flag text, turn_on boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform public.admin_check();
  if flag is null or flag !~ '^[a-z_]{1,32}$' then raise exception 'bad flag'; end if;
  insert into public.site_flags (key, is_on, updated_at) values (flag, coalesce(turn_on, false), now())
    on conflict (key) do update set is_on = excluded.is_on, updated_at = now();
  insert into public.admin_log (admin_id, action, target_email)
    values ((select auth.uid()), case when turn_on then 'flag_on' else 'flag_off' end, flag);
end $$;

revoke execute on function public.site_flags(), public.admin_set_flag(text, boolean) from public;
grant execute on function public.site_flags() to anon, authenticated;
revoke execute on function public.admin_set_flag(text, boolean) from anon;
grant execute on function public.admin_set_flag(text, boolean) to authenticated;
