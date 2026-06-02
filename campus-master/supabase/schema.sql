-- Campus "万事达" schema for Supabase (Postgres)
-- Apply this in Supabase SQL Editor.

-- Extensions
create extension if not exists "pgcrypto";

-- Enums
do $$ begin
  create type public.user_role as enum ('requester', 'helper', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_status as enum (
    'open',              -- 待接单
    'in_progress',       -- 进行中
    'awaiting_acceptance', -- 待验收
    'completed',         -- 已完成
    'disputed'           -- 争议中
  );
exception when duplicate_object then null; end $$;

-- Add new status values safely (for existing projects)
do $$ begin
  alter type public.task_status add value 'canceled';
exception when duplicate_object then null; end $$;

-- Profiles (one row per auth.user)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'requester',
  display_name text,
  credit_score integer not null default 100,
  created_at timestamptz not null default now()
);

-- Accounts: virtual wallet
create table if not exists public.accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  available_cents bigint not null default 0,
  frozen_cents bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  direction text not null check (direction in ('in','out','freeze','unfreeze')),
  amount_cents bigint not null check (amount_cents > 0),
  reference_type text not null,
  reference_id uuid,
  note text,
  created_at timestamptz not null default now()
);

-- Tasks
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete restrict,
  helper_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text not null,
  category text,
  reward_cents bigint not null check (reward_cents > 0),
  status public.task_status not null default 'open',
  lat double precision,
  lng double precision,
  geohash text,
  evidence_text text,
  evidence_image_paths text[] not null default '{}'::text[],
  accepted_at timestamptz,
  evidence_submitted_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  canceled_by uuid references public.profiles(id) on delete set null,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If tasks already exists, ensure the column exists
alter table public.tasks
  add column if not exists evidence_image_paths text[] not null default '{}'::text[];

alter table public.tasks
  add column if not exists accepted_at timestamptz;

alter table public.tasks
  add column if not exists evidence_submitted_at timestamptz;

alter table public.tasks
  add column if not exists completed_at timestamptz;

alter table public.tasks
  add column if not exists canceled_at timestamptz;

alter table public.tasks
  add column if not exists canceled_by uuid references public.profiles(id) on delete set null;

alter table public.tasks
  add column if not exists cancel_reason text;

alter table public.tasks
  add column if not exists lat double precision;

alter table public.tasks
  add column if not exists lng double precision;

alter table public.tasks
  add column if not exists geohash text;

create table if not exists public.task_violations (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  violation_type text not null,
  credit_delta int not null,
  reason text,
  created_at timestamptz not null default now(),
  unique(task_id, user_id, violation_type)
);

create index if not exists task_violations_user_created_idx
  on public.task_violations(user_id, created_at desc);

create index if not exists tasks_status_idx on public.tasks(status);
create index if not exists tasks_created_at_idx on public.tasks(created_at desc);
create index if not exists tasks_geohash_idx on public.tasks(geohash text_pattern_ops);

create table if not exists public.task_state_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  from_status public.task_status,
  to_status public.task_status not null,
  actor_id uuid,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.tasks(id) on delete cascade,
  opened_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null,
  resolution text,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  reference_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Private chat (per task)
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.tasks(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  body text not null,
  created_at timestamptz not null default now(),
  check (char_length(body) between 1 and 2000)
);

create index if not exists messages_conversation_created_idx
  on public.messages(conversation_id, created_at desc);

-- AI audits (optional)
create table if not exists public.ai_audits (
  task_id uuid primary key references public.tasks(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  risk_level text not null default 'pending'
    check (risk_level in ('pending','low','medium','high','skipped','error')),
  reason text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reviews (credit)
create table if not exists public.task_reviews (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique(task_id, reviewer_id)
);

-- Helpers
create or replace function public.is_admin(p_user uuid)
returns boolean
language sql
stable
as $$
  select exists(select 1 from public.profiles p where p.id = p_user and p.role = 'admin');
$$;

-- Auto-create profile + account on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, role, display_name)
  values (new.id, 'requester', coalesce(new.raw_user_meta_data->>'display_name', null))
  on conflict (id) do nothing;

  insert into public.accounts(user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Keep updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row execute procedure public.set_updated_at();

drop trigger if exists ai_audits_set_updated_at on public.ai_audits;
create trigger ai_audits_set_updated_at
before update on public.ai_audits
for each row execute procedure public.set_updated_at();

-- State transition check + log + notifications
create or replace function public.on_task_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_is_service boolean := (auth.role() = 'service_role');
  ok boolean := false;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.status = old.status then
    return new;
  end if;

  -- Allow service_role bypass (server-side ops)
  if actor_is_service then
    ok := true;
  else
    -- Enforce FSM transitions + actor permissions
    if old.status = 'open' and new.status = 'in_progress' then
      ok := (actor = new.helper_id);
    elsif old.status = 'in_progress' and new.status = 'awaiting_acceptance' then
      ok := (actor = new.helper_id);
    elsif old.status = 'awaiting_acceptance' and new.status = 'completed' then
      ok := (actor = new.requester_id);
    elsif old.status = 'open' and new.status = 'canceled' then
      ok := (actor = new.requester_id or public.is_admin(actor));
    elsif old.status in ('in_progress','awaiting_acceptance') and new.status = 'canceled' then
      ok := (actor = new.requester_id or actor = new.helper_id or public.is_admin(actor));
    elsif (old.status in ('open','in_progress','awaiting_acceptance')) and new.status = 'disputed' then
      ok := (actor = new.requester_id or actor = new.helper_id);
    elsif old.status = 'disputed' and new.status in ('completed','open','canceled') then
      ok := public.is_admin(actor);
    end if;
  end if;

  if not ok then
    raise exception 'Illegal task status transition or actor not allowed';
  end if;

  insert into public.task_state_logs(task_id, from_status, to_status, actor_id)
  values (new.id, old.status, new.status, actor);

  -- Timestamps on state changes (best-effort)
  if new.status = 'in_progress' and new.accepted_at is null then
    new.accepted_at := now();
  end if;

  if new.status = 'awaiting_acceptance' and new.evidence_submitted_at is null then
    new.evidence_submitted_at := now();
  end if;

  if new.status = 'completed' and new.completed_at is null then
    new.completed_at := now();
  end if;

  if new.status = 'canceled' and new.canceled_at is null then
    new.canceled_at := now();
  end if;

  if new.status = 'canceled' and new.canceled_by is null then
    new.canceled_by := actor;
  end if;

  -- Notifications (best-effort)
  if new.status = 'canceled' then
    if new.requester_id is not null then
      insert into public.notifications(user_id, type, title, body, reference_id)
      values (new.requester_id, 'task', '任务已取消', coalesce(new.cancel_reason, '任务被取消'), new.id);
    end if;

    if new.helper_id is not null then
      insert into public.notifications(user_id, type, title, body, reference_id)
      values (new.helper_id, 'task', '任务已取消', coalesce(new.cancel_reason, '任务被取消'), new.id);
    end if;
  elsif actor_is_service and old.status = 'in_progress' and new.status = 'open' and old.helper_id is not null and new.helper_id is null then
    -- auto reopen due to helper timeout
    insert into public.notifications(user_id, type, title, body, reference_id)
    values (new.requester_id, 'task', '接单方超时', '接单方长时间未推进，任务已重新开放可再次接单。', new.id);

    insert into public.notifications(user_id, type, title, body, reference_id)
    values (old.helper_id, 'task', '你已超时', '你长时间未推进该任务，系统已将任务重新开放。', new.id);
  elsif actor_is_service and old.status = 'awaiting_acceptance' and new.status = 'completed' then
    -- auto complete due to requester timeout
    if new.requester_id is not null then
      insert into public.notifications(user_id, type, title, body, reference_id)
      values (new.requester_id, 'task', '系统自动确认完成', '你超时未验收，系统已自动确认完成并支付。', new.id);
    end if;

    if new.helper_id is not null then
      insert into public.notifications(user_id, type, title, body, reference_id)
      values (new.helper_id, 'task', '系统自动确认完成', '需求方超时未验收，系统已自动确认完成并支付。', new.id);
    end if;
  else
    -- default generic status update
    if new.requester_id is not null then
      insert into public.notifications(user_id, type, title, body, reference_id)
      values (new.requester_id, 'task', '任务状态更新', concat('任务已变更为：', new.status::text), new.id);
    end if;

    if new.helper_id is not null then
      insert into public.notifications(user_id, type, title, body, reference_id)
      values (new.helper_id, 'task', '任务状态更新', concat('任务已变更为：', new.status::text), new.id);
    end if;
  end if;

  return new;
end;
$$;

-- Apply credit penalty (idempotent per task/user/type)
create or replace function public.apply_violation(
  p_task_id uuid,
  p_user_id uuid,
  p_violation_type text,
  p_credit_delta int,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted boolean := false;
  affected_rows int := 0;
begin
  insert into public.task_violations(task_id, user_id, violation_type, credit_delta, reason)
  values (p_task_id, p_user_id, p_violation_type, p_credit_delta, p_reason)
  on conflict (task_id, user_id, violation_type) do nothing;

  get diagnostics affected_rows = row_count;
  inserted := (affected_rows = 1);

  if inserted then
    update public.profiles
    set credit_score = greatest(0, credit_score + p_credit_delta)
    where id = p_user_id;

    insert into public.notifications(user_id, type, title, body, reference_id)
    values (
      p_user_id,
      'violation',
      '违约记录',
      concat('信用分变动 ', p_credit_delta::text, '：', coalesce(p_reason,'')),
      p_task_id
    );
  end if;
end;
$$;

-- RPC: cancel task (refund + optional penalty)
create or replace function public.cancel_task(
  p_task_id uuid,
  p_reason text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  actor_is_service boolean := (auth.role() = 'service_role');
  cur public.tasks;
  canceller uuid;
begin
  if uid is null and not actor_is_service then
    raise exception 'Not authenticated';
  end if;

  canceller := coalesce(uid, null);

  select * into cur from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  if cur.status in ('completed','canceled') then
    raise exception 'Task not cancelable';
  end if;

  if not actor_is_service then
    if not (uid = cur.requester_id or uid = cur.helper_id or public.is_admin(uid)) then
      raise exception 'Not allowed';
    end if;
  end if;

  -- Refund frozen funds back to requester
  update public.accounts
  set frozen_cents = frozen_cents - cur.reward_cents,
      available_cents = available_cents + cur.reward_cents,
      updated_at = now()
  where user_id = cur.requester_id;

  insert into public.ledger_entries(user_id, direction, amount_cents, reference_type, reference_id, note)
  values (cur.requester_id, 'unfreeze', cur.reward_cents, 'task_cancel', cur.id, '取消任务退款');

  update public.tasks
  set status = 'canceled',
      canceled_at = now(),
      canceled_by = coalesce(canceller, cur.canceled_by),
      cancel_reason = nullif(p_reason, '')
  where id = p_task_id;

  -- Penalty: cancel after acceptance is a violation (best-effort)
  if cur.status in ('in_progress','awaiting_acceptance') and not actor_is_service then
    if uid = cur.helper_id then
      perform public.apply_violation(cur.id, uid, 'helper_cancel', -2, '接单后取消：' || coalesce(nullif(p_reason,''), '无'));
    elsif uid = cur.requester_id then
      perform public.apply_violation(cur.id, uid, 'requester_cancel', -1, '接单后取消：' || coalesce(nullif(p_reason,''), '无'));
    end if;
  end if;
end;
$$;

-- Service-only completion (used by auto_finalize_tasks)
create or replace function public.confirm_completion_service(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_is_service boolean := (auth.role() = 'service_role');
  cur public.tasks;
begin
  if not actor_is_service then
    raise exception 'service_role only';
  end if;

  select * into cur from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  if cur.status <> 'awaiting_acceptance' then
    return;
  end if;

  if cur.helper_id is null then
    raise exception 'No helper';
  end if;

  -- Move money: requester frozen -> helper available
  update public.accounts
  set frozen_cents = frozen_cents - cur.reward_cents,
      updated_at = now()
  where user_id = cur.requester_id;

  update public.accounts
  set available_cents = available_cents + cur.reward_cents,
      updated_at = now()
  where user_id = cur.helper_id;

  insert into public.ledger_entries(user_id, direction, amount_cents, reference_type, reference_id, note)
  values (cur.requester_id, 'out', cur.reward_cents, 'task_payout_auto', cur.id, '超时自动确认完成：支付');

  insert into public.ledger_entries(user_id, direction, amount_cents, reference_type, reference_id, note)
  values (cur.helper_id, 'in', cur.reward_cents, 'task_payout_auto', cur.id, '超时自动确认完成：收款');

  update public.tasks
  set status = 'completed',
      completed_at = coalesce(completed_at, now())
  where id = p_task_id;

  perform public.apply_violation(cur.id, cur.requester_id, 'requester_timeout', -1, '已提交凭证但超时未验收，系统自动确认完成');

end;
$$;

-- RPC: service auto-finalize (timeouts)
create or replace function public.auto_finalize_tasks(
  p_in_progress_timeout_minutes int default 1440,
  p_acceptance_timeout_minutes int default 1440
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_is_service boolean := (auth.role() = 'service_role');
  reopened_count int := 0;
  auto_completed_count int := 0;
  t record;
begin
  if not actor_is_service then
    raise exception 'service_role only';
  end if;

  -- Helper timeout: accepted but too long without submitting evidence -> reopen task
  for t in
    select id, requester_id, helper_id
    from public.tasks
    where status = 'in_progress'
      and helper_id is not null
      and accepted_at is not null
      and accepted_at < now() - make_interval(mins => p_in_progress_timeout_minutes)
  loop
    update public.tasks
    set helper_id = null,
        status = 'open',
        accepted_at = null,
        evidence_submitted_at = null
    where id = t.id;

    reopened_count := reopened_count + 1;

    perform public.apply_violation(t.id, t.helper_id, 'helper_timeout', -2, '接单后超时未提交凭证，任务已重新开放');
  end loop;

  -- Requester timeout: evidence submitted but too long without confirmation -> auto-complete
  for t in
    select id
    from public.tasks
    where status = 'awaiting_acceptance'
      and evidence_submitted_at is not null
      and evidence_submitted_at < now() - make_interval(mins => p_acceptance_timeout_minutes)
  loop
    -- reuse payout logic by performing a service-side completion
    perform public.confirm_completion_service(t.id);
    auto_completed_count := auto_completed_count + 1;
  end loop;

  return jsonb_build_object(
    'reopened_count', reopened_count,
    'auto_completed_count', auto_completed_count
  );
end;
$$;

drop trigger if exists tasks_status_change on public.tasks;
create trigger tasks_status_change
before update of status on public.tasks
for each row execute procedure public.on_task_status_change();

-- RPC: top up (simulated)
create or replace function public.top_up(p_amount_cents bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_amount_cents <= 0 then
    raise exception 'Invalid amount';
  end if;

  update public.accounts
  set available_cents = available_cents + p_amount_cents, updated_at = now()
  where user_id = uid;

  insert into public.ledger_entries(user_id, direction, amount_cents, reference_type, note)
  values (uid, 'in', p_amount_cents, 'top_up', '模拟充值');
end;
$$;

-- RPC: create task (freeze funds atomically)
-- Drop the older 4-arg signature so upgraded projects don't end up with an
-- ambiguous overload alongside the location-aware version below.
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

-- RPC: list tasks ordered by distance from the caller's position.
-- Uses Haversine for exact ordering; tasks without coordinates sort last
-- (then by recency). GeoHash is stored for prefix-based pre-filtering and
-- can be layered on top of this for larger datasets.
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

-- RPC: accept task
create or replace function public.accept_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cur public.tasks;
  urole public.user_role;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select role into urole from public.profiles where id = uid;
  if urole is null then
    raise exception 'Profile not found';
  end if;

  if not (urole = 'helper' or urole = 'admin') then
    raise exception 'Only helper can accept task';
  end if;

  select * into cur from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  if cur.status <> 'open' then
    raise exception 'Task not open';
  end if;

  if cur.requester_id = uid then
    raise exception 'Requester cannot accept own task';
  end if;

  update public.tasks
  set helper_id = uid,
      status = 'in_progress'
  where id = p_task_id;

  -- Create a chat conversation for this task (idempotent)
  insert into public.conversations(task_id)
  values (p_task_id)
  on conflict (task_id) do nothing;
end;
$$;

-- Chat notifications: create a notification for the counterparty on new message
create or replace function public.on_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tasks;
  c public.conversations;
  recipient uuid;
begin
  select * into c from public.conversations where id = new.conversation_id;
  if not found then
    return new;
  end if;

  select * into t from public.tasks where id = c.task_id;
  if not found then
    return new;
  end if;

  if new.sender_id = t.requester_id then
    recipient := t.helper_id;
  elsif new.sender_id = t.helper_id then
    recipient := t.requester_id;
  else
    -- not a participant; ignore
    return new;
  end if;

  if recipient is null then
    return new;
  end if;

  insert into public.notifications(user_id, type, title, body, reference_id)
  values (
    recipient,
    'message',
    '私聊新消息',
    left(new.body, 80),
    t.id
  );

  return new;
end;
$$;

drop trigger if exists messages_notify_on_insert on public.messages;
create trigger messages_notify_on_insert
after insert on public.messages
for each row execute procedure public.on_message_insert();

-- Reviews validation: only participants, only after completion, and only review the counterparty
create or replace function public.validate_task_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  t public.tasks;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if new.reviewer_id <> uid then
    raise exception 'reviewer_id must equal auth.uid()';
  end if;

  select * into t from public.tasks where id = new.task_id;
  if not found then
    raise exception 'Task not found';
  end if;

  if t.status <> 'completed' then
    raise exception 'Task not completed';
  end if;

  if not (uid = t.requester_id or uid = t.helper_id) then
    raise exception 'Not a participant';
  end if;

  if uid = t.requester_id and new.reviewee_id <> t.helper_id then
    raise exception 'Requester must review helper';
  end if;

  if uid = t.helper_id and new.reviewee_id <> t.requester_id then
    raise exception 'Helper must review requester';
  end if;

  return new;
end;
$$;

drop trigger if exists task_reviews_validate on public.task_reviews;
create trigger task_reviews_validate
before insert on public.task_reviews
for each row execute procedure public.validate_task_review();

-- RPC: submit evidence (text + optional image paths)
create or replace function public.submit_evidence(
  p_task_id uuid,
  p_evidence_text text,
  p_evidence_image_paths text[] default '{}'::text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cur public.tasks;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into cur from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  if cur.status <> 'in_progress' then
    raise exception 'Task not in progress';
  end if;

  if cur.helper_id <> uid then
    raise exception 'Only helper can submit evidence';
  end if;

  update public.tasks
  set evidence_text = p_evidence_text,
      evidence_image_paths = coalesce(p_evidence_image_paths, '{}'::text[]),
      status = 'awaiting_acceptance'
  where id = p_task_id;
end;
$$;

-- ==========================================================
-- Supabase Storage: task evidence bucket + RLS policies
-- ==========================================================

-- Create bucket for evidence images (private)
insert into storage.buckets (id, name, public)
values ('task-evidence', 'task-evidence', false)
on conflict (id) do nothing;

-- Read policy: task participants (requester/helper) and admin can read objects
drop policy if exists "task_evidence_read_participants" on storage.objects;
create policy "task_evidence_read_participants"
on storage.objects
for select
using (
  bucket_id = 'task-evidence'
  and auth.uid() is not null
  and (
    public.is_admin(auth.uid())
    or exists (
      select 1
      from public.tasks t
      where t.id = (split_part(name, '/', 1))::uuid
        and (t.requester_id = auth.uid() or t.helper_id = auth.uid())
    )
  )
);

-- Insert policy: only helper (or admin) of the task can upload into taskId/userId/*
drop policy if exists "task_evidence_insert_helper" on storage.objects;
create policy "task_evidence_insert_helper"
on storage.objects
for insert
with check (
  bucket_id = 'task-evidence'
  and auth.uid() is not null
  and (
    public.is_admin(auth.uid())
    or exists (
      select 1
      from public.tasks t
      where t.id = (split_part(name, '/', 1))::uuid
        and t.helper_id = auth.uid()
        and t.status = 'in_progress'
        and split_part(name, '/', 2) = auth.uid()::text
    )
  )
);

-- Delete policy: helper (own uploads) or admin can delete
drop policy if exists "task_evidence_delete_helper" on storage.objects;
create policy "task_evidence_delete_helper"
on storage.objects
for delete
using (
  bucket_id = 'task-evidence'
  and auth.uid() is not null
  and (
    public.is_admin(auth.uid())
    or split_part(name, '/', 2) = auth.uid()::text
  )
);

-- RPC: confirm completion + transfer funds
create or replace function public.confirm_completion(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cur public.tasks;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into cur from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  if cur.status <> 'awaiting_acceptance' then
    raise exception 'Task not awaiting acceptance';
  end if;

  if cur.requester_id <> uid then
    raise exception 'Only requester can confirm completion';
  end if;

  if cur.helper_id is null then
    raise exception 'No helper';
  end if;

  -- Move money: requester frozen -> helper available
  update public.accounts
  set frozen_cents = frozen_cents - cur.reward_cents,
      updated_at = now()
  where user_id = cur.requester_id;

  update public.accounts
  set available_cents = available_cents + cur.reward_cents,
      updated_at = now()
  where user_id = cur.helper_id;

  insert into public.ledger_entries(user_id, direction, amount_cents, reference_type, reference_id, note)
  values (cur.requester_id, 'out', cur.reward_cents, 'task_payout', cur.id, '任务完成支付');

  insert into public.ledger_entries(user_id, direction, amount_cents, reference_type, reference_id, note)
  values (cur.helper_id, 'in', cur.reward_cents, 'task_payout', cur.id, '任务完成收款');

  update public.tasks
  set status = 'completed'
  where id = p_task_id;
end;
$$;

-- RPC: open dispute
create or replace function public.open_dispute(p_task_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cur public.tasks;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into cur from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  if not (uid = cur.requester_id or uid = cur.helper_id) then
    raise exception 'Not a participant';
  end if;

  insert into public.disputes(task_id, opened_by, reason)
  values (p_task_id, uid, p_reason)
  on conflict (task_id) do nothing;

  update public.tasks
  set status = 'disputed'
  where id = p_task_id;
end;
$$;

-- RPC: admin resolve dispute
-- resolution: 'complete' (pay helper) | 'refund' (unfreeze back to requester)
create or replace function public.resolve_dispute(p_task_id uuid, p_resolution text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cur public.tasks;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_admin(uid) then
    raise exception 'Admin only';
  end if;

  select * into cur from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  if cur.status <> 'disputed' then
    raise exception 'Task not disputed';
  end if;

  if p_resolution = 'complete' then
    if cur.helper_id is null then
      raise exception 'No helper';
    end if;

    -- Move money: requester frozen -> helper available
    update public.accounts
    set frozen_cents = frozen_cents - cur.reward_cents,
        updated_at = now()
    where user_id = cur.requester_id;

    update public.accounts
    set available_cents = available_cents + cur.reward_cents,
        updated_at = now()
    where user_id = cur.helper_id;

    insert into public.ledger_entries(user_id, direction, amount_cents, reference_type, reference_id, note)
    values (cur.requester_id, 'out', cur.reward_cents, 'task_payout_admin', cur.id, '争议裁决：完成支付');

    insert into public.ledger_entries(user_id, direction, amount_cents, reference_type, reference_id, note)
    values (cur.helper_id, 'in', cur.reward_cents, 'task_payout_admin', cur.id, '争议裁决：完成收款');

    update public.tasks
    set status = 'completed'
    where id = p_task_id;
  elsif p_resolution = 'refund' then
    -- unfreeze back to requester
    update public.accounts
    set frozen_cents = frozen_cents - cur.reward_cents,
        available_cents = available_cents + cur.reward_cents,
        updated_at = now()
    where user_id = cur.requester_id;

    insert into public.ledger_entries(user_id, direction, amount_cents, reference_type, reference_id, note)
    values (cur.requester_id, 'unfreeze', cur.reward_cents, 'dispute_refund', cur.id, '争议裁决退款');

    update public.tasks
    set helper_id = null,
        status = 'open'
    where id = p_task_id;
  else
    raise exception 'Invalid resolution';
  end if;

  update public.disputes
  set resolution = p_resolution,
      resolved_by = uid,
      resolved_at = now()
  where disputes.task_id = p_task_id;
end;
$$;

-- Credit score update on review
create or replace function public.apply_credit_delta(p_reviewee uuid, p_stars int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  delta int;
begin
  delta := case
    when p_stars = 5 then 2
    when p_stars = 4 then 1
    when p_stars = 3 then 0
    when p_stars = 2 then -1
    else -2
  end;

  update public.profiles
  set credit_score = greatest(0, credit_score + delta)
  where id = p_reviewee;
end;
$$;

create or replace function public.on_review_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_credit_delta(new.reviewee_id, new.stars);
  return new;
end;
$$;

drop trigger if exists review_insert on public.task_reviews;
create trigger review_insert
after insert on public.task_reviews
for each row execute procedure public.on_review_insert();

-- RLS
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.tasks enable row level security;
alter table public.task_state_logs enable row level security;
alter table public.disputes enable row level security;
alter table public.notifications enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.task_violations enable row level security;
alter table public.ai_audits enable row level security;
alter table public.task_reviews enable row level security;

-- Profiles policies
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

-- Authenticated users may switch between requester/helper, but must never
-- grant themselves the admin role from a browser client.
create or replace function public.prevent_profile_admin_escalation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.role <> 'admin'
    and new.role = 'admin'
    and auth.role() <> 'service_role'
  then
    raise exception 'Admin role can only be granted by service role';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_admin_escalation on public.profiles;
create trigger profiles_prevent_admin_escalation
before update of role on public.profiles
for each row execute procedure public.prevent_profile_admin_escalation();

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

revoke update on public.profiles from authenticated;
grant update (display_name, role) on public.profiles to authenticated;

-- Accounts policies
drop policy if exists "accounts_select_own" on public.accounts;
create policy "accounts_select_own" on public.accounts
for select using (auth.uid() = user_id);

-- Ledger policies
drop policy if exists "ledger_select_own" on public.ledger_entries;
create policy "ledger_select_own" on public.ledger_entries
for select using (auth.uid() = user_id);

-- Tasks policies: any authenticated user can view task pool
drop policy if exists "tasks_select_authenticated" on public.tasks;
create policy "tasks_select_authenticated" on public.tasks
for select using (auth.uid() is not null);

drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own" on public.tasks
for insert with check (auth.uid() = requester_id);

-- Disputes: participants + admin
drop policy if exists "disputes_select_participants" on public.disputes;
create policy "disputes_select_participants" on public.disputes
for select using (
  auth.uid() is not null and (
    public.is_admin(auth.uid())
    or exists(select 1 from public.tasks t where t.id = disputes.task_id and (t.requester_id = auth.uid() or t.helper_id = auth.uid()))
  )
);

-- Notifications: own
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
for select using (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Violations: users can see their own, admin can see all
drop policy if exists "violations_select_own_or_admin" on public.task_violations;
create policy "violations_select_own_or_admin" on public.task_violations
for select using (
  auth.uid() is not null and (public.is_admin(auth.uid()) or auth.uid() = user_id)
);

-- Conversations: participants + admin
drop policy if exists "conversations_select_participants" on public.conversations;
create policy "conversations_select_participants" on public.conversations
for select using (
  auth.uid() is not null and (
    public.is_admin(auth.uid())
    or exists(
      select 1
      from public.tasks t
      where t.id = conversations.task_id
        and (t.requester_id = auth.uid() or t.helper_id = auth.uid())
    )
  )
);

drop policy if exists "conversations_insert_participants" on public.conversations;
create policy "conversations_insert_participants" on public.conversations
for insert with check (
  auth.uid() is not null and (
    public.is_admin(auth.uid())
    or exists(
      select 1
      from public.tasks t
      where t.id = conversations.task_id
        and t.helper_id is not null
        and (t.requester_id = auth.uid() or t.helper_id = auth.uid())
    )
  )
);

-- Messages: participants + admin
drop policy if exists "messages_select_participants" on public.messages;
create policy "messages_select_participants" on public.messages
for select using (
  auth.uid() is not null and (
    public.is_admin(auth.uid())
    or exists(
      select 1
      from public.conversations c
      join public.tasks t on t.id = c.task_id
      where c.id = messages.conversation_id
        and (t.requester_id = auth.uid() or t.helper_id = auth.uid())
    )
  )
);

drop policy if exists "messages_insert_participants" on public.messages;
create policy "messages_insert_participants" on public.messages
for insert with check (
  auth.uid() is not null
  and sender_id = auth.uid()
  and (
    public.is_admin(auth.uid())
    or exists(
      select 1
      from public.conversations c
      join public.tasks t on t.id = c.task_id
      where c.id = messages.conversation_id
        and (t.requester_id = auth.uid() or t.helper_id = auth.uid())
    )
  )
);

-- AI audits: task participants can see results, admin can see all
drop policy if exists "ai_audits_select_admin_or_owner" on public.ai_audits;
create policy "ai_audits_select_admin_or_owner" on public.ai_audits
for select using (
  auth.uid() is not null and (
    public.is_admin(auth.uid())
    or exists(
      select 1
      from public.tasks t
      where t.id = ai_audits.task_id
        and (t.requester_id = auth.uid() or t.helper_id = auth.uid())
    )
  )
);

drop policy if exists "ai_audits_insert_owner" on public.ai_audits;
create policy "ai_audits_insert_owner" on public.ai_audits
for insert with check (auth.uid() = requester_id);

drop policy if exists "ai_audits_update_owner" on public.ai_audits;
create policy "ai_audits_update_owner" on public.ai_audits
for update using (auth.uid() = requester_id) with check (auth.uid() = requester_id);

-- Task logs: participants + admin
drop policy if exists "task_logs_select" on public.task_state_logs;
create policy "task_logs_select" on public.task_state_logs
for select using (
  auth.uid() is not null and (
    public.is_admin(auth.uid())
    or exists(select 1 from public.tasks t where t.id = task_state_logs.task_id and (t.requester_id = auth.uid() or t.helper_id = auth.uid()))
  )
);

-- Reviews: participants only
drop policy if exists "reviews_select_participants" on public.task_reviews;
create policy "reviews_select_participants" on public.task_reviews
for select using (
  auth.uid() is not null and (
    reviewer_id = auth.uid() or reviewee_id = auth.uid()
  )
);

drop policy if exists "reviews_insert_participants" on public.task_reviews;
create policy "reviews_insert_participants" on public.task_reviews
for insert with check (auth.uid() = reviewer_id);
