-- Apply this patch once in Supabase SQL Editor for existing projects.
-- New projects already receive the same changes from supabase/schema.sql.
--
-- Adds task geolocation (lat/lng + GeoHash) and a distance-ordered task feed.

alter table public.tasks
  add column if not exists lat double precision;

alter table public.tasks
  add column if not exists lng double precision;

alter table public.tasks
  add column if not exists geohash text;

create index if not exists tasks_geohash_idx on public.tasks(geohash text_pattern_ops);

-- Extend create_task to persist coordinates + geohash.
-- Drop the older 4-arg signature first to avoid an ambiguous overload.
drop function if exists public.create_task(text, text, text, bigint);

create or replace function public.create_task(
  p_title text,
  p_description text,
  p_category text,
  p_reward_cents bigint,
  p_lat double precision default null,
  p_lng double precision default null,
  p_geohash text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_task_id uuid;
  avail bigint;
  urole public.user_role;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select role into urole from public.profiles where id = uid;
  if urole is null then
    raise exception 'Profile not found';
  end if;

  if not (urole = 'requester' or urole = 'admin') then
    raise exception 'Only requester can create task';
  end if;

  if p_reward_cents <= 0 then
    raise exception 'Invalid reward';
  end if;

  select available_cents into avail from public.accounts where user_id = uid for update;
  if avail is null then
    raise exception 'Account not found';
  end if;

  if avail < p_reward_cents then
    raise exception 'Insufficient balance';
  end if;

  update public.accounts
  set available_cents = available_cents - p_reward_cents,
      frozen_cents = frozen_cents + p_reward_cents,
      updated_at = now()
  where user_id = uid;

  insert into public.ledger_entries(user_id, direction, amount_cents, reference_type, note)
  values (uid, 'freeze', p_reward_cents, 'task', '发布任务冻结资金');

  insert into public.tasks(requester_id, title, description, category, reward_cents, status, lat, lng, geohash)
  values (
    uid,
    p_title,
    p_description,
    nullif(p_category,''),
    p_reward_cents,
    'open',
    p_lat,
    p_lng,
    nullif(p_geohash,'')
  )
  returning id into v_task_id;

  insert into public.ai_audits(task_id, requester_id, risk_level)
  values (v_task_id, uid, 'pending')
  on conflict (task_id) do nothing;

  insert into public.task_state_logs(task_id, from_status, to_status, actor_id, note)
  values (v_task_id, null, 'open', uid, '任务创建');

  return v_task_id;
end;
$$;

-- Distance-ordered task feed (Haversine).
create or replace function public.list_nearby_tasks(
  p_lat double precision,
  p_lng double precision,
  p_status text default null,
  p_category text default null,
  p_limit int default 50
)
returns table (
  id uuid,
  title text,
  category text,
  reward_cents bigint,
  status public.task_status,
  created_at timestamptz,
  lat double precision,
  lng double precision,
  distance_m double precision
)
language sql
stable
as $$
  select
    t.id,
    t.title,
    t.category,
    t.reward_cents,
    t.status,
    t.created_at,
    t.lat,
    t.lng,
    case
      when t.lat is null or t.lng is null then null
      else 2 * 6371000 * asin(
        sqrt(
          power(sin(radians(t.lat - p_lat) / 2), 2)
          + cos(radians(p_lat)) * cos(radians(t.lat))
            * power(sin(radians(t.lng - p_lng) / 2), 2)
        )
      )
    end as distance_m
  from public.tasks t
  where auth.uid() is not null
    and (p_status is null or p_status = '' or t.status = p_status::public.task_status)
    and (p_category is null or p_category = '' or t.category ilike '%' || p_category || '%')
  order by distance_m asc nulls last, t.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;
