-- Users created before profiles/RLS existed (or failed trigger runs) have no profiles row.
-- project_members.user_id references profiles(id), so inserts fail without a profile.

-- 1) Backfill profiles for every auth user that is missing one
insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(
    u.raw_user_meta_data->>'display_name',
    split_part(u.email, '@', 1),
    'User'
  )
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- 2) Make signup trigger safe if a profile row already exists (idempotent)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
