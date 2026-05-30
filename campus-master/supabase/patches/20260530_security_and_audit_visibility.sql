-- Apply this patch once in Supabase SQL Editor for existing projects.
-- New projects already receive the same rules from supabase/schema.sql.

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

revoke update on public.profiles from authenticated;
grant update (display_name, role) on public.profiles to authenticated;

-- AI audit results are visible to task participants and administrators.
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
