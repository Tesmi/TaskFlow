-- Taskflow: profiles, projects, project_members, tasks + RLS
-- Task delete rule: any project member may delete tasks in that project (full CRUD for members).

-- Extensions
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- New user -> profile row
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
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Projects + project_members (tables before helper functions & triggers)
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index idx_projects_created_by on public.projects (created_by);

create type public.project_role as enum ('admin', 'member');

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.project_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index idx_project_members_user on public.project_members (user_id);

-- ---------------------------------------------------------------------------
-- Helper functions for RLS
-- ---------------------------------------------------------------------------
create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_members pm
    where pm.project_id = p_project_id and pm.user_id = auth.uid()
  );
$$;

create or replace function public.is_project_admin(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
      and pm.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Projects RLS + creator becomes admin (after project_members exists)
-- ---------------------------------------------------------------------------
alter table public.projects enable row level security;

create policy "Members can select projects"
  on public.projects for select
  to authenticated
  using (public.is_project_member(id));

create policy "Authenticated users can create projects as self"
  on public.projects for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "Admins can update projects"
  on public.projects for update
  to authenticated
  using (public.is_project_admin(id))
  with check (public.is_project_admin(id));

create policy "Admins can delete projects"
  on public.projects for delete
  to authenticated
  using (public.is_project_admin(id));

create or replace function public.add_creator_as_project_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.created_by, 'admin');
  return new;
end;
$$;

create trigger on_project_created_add_admin
  after insert on public.projects
  for each row execute function public.add_creator_as_project_admin();

-- ---------------------------------------------------------------------------
-- Project members RLS + last-admin guard
-- ---------------------------------------------------------------------------
alter table public.project_members enable row level security;

create policy "Members can view project_members for their projects"
  on public.project_members for select
  to authenticated
  using (public.is_project_member(project_id));

create policy "Admins can insert project members"
  on public.project_members for insert
  to authenticated
  with check (public.is_project_admin(project_id));

create policy "Admins can update project members"
  on public.project_members for update
  to authenticated
  using (public.is_project_admin(project_id))
  with check (public.is_project_admin(project_id));

create policy "Admins can delete project members"
  on public.project_members for delete
  to authenticated
  using (public.is_project_admin(project_id));

create or replace function public.enforce_at_least_one_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_count int;
begin
  if tg_op = 'DELETE' then
    if old.role = 'admin' then
      select count(*) into admin_count
      from public.project_members
      where project_id = old.project_id and role = 'admin';
      if admin_count <= 1 then
        raise exception 'Cannot remove the last admin from the project';
      end if;
    end if;
    return old;
  elsif tg_op = 'UPDATE' then
    if old.role = 'admin' and new.role = 'member' then
      select count(*) into admin_count
      from public.project_members
      where project_id = old.project_id and role = 'admin';
      if admin_count <= 1 then
        raise exception 'Cannot demote the last admin';
      end if;
    end if;
    return new;
  end if;
  return new;
end;
$$;

create trigger project_members_last_admin_delete
  before delete on public.project_members
  for each row execute function public.enforce_at_least_one_admin();

create trigger project_members_last_admin_update
  before update on public.project_members
  for each row execute function public.enforce_at_least_one_admin();

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
create type public.task_status as enum ('todo', 'in_progress', 'done');

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  description text,
  status public.task_status not null default 'todo',
  assignee_id uuid references auth.users (id) on delete set null,
  due_date date,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_tasks_project on public.tasks (project_id);
create index idx_tasks_assignee on public.tasks (assignee_id);
create index idx_tasks_due_date on public.tasks (due_date);
create index idx_tasks_status on public.tasks (status);

alter table public.tasks enable row level security;

create policy "Members can view tasks in their projects"
  on public.tasks for select
  to authenticated
  using (public.is_project_member(project_id));

create policy "Members can insert tasks in their projects"
  on public.tasks for insert
  to authenticated
  with check (
    public.is_project_member(project_id)
    and created_by = auth.uid()
  );

create policy "Members can update tasks in their projects"
  on public.tasks for update
  to authenticated
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

create policy "Members can delete tasks in their projects"
  on public.tasks for delete
  to authenticated
  using (public.is_project_member(project_id));

create or replace function public.tasks_assignee_is_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assignee_id is not null then
    if not exists (
      select 1 from public.project_members pm
      where pm.project_id = new.project_id and pm.user_id = new.assignee_id
    ) then
      raise exception 'Assignee must be a member of the project';
    end if;
  end if;
  return new;
end;
$$;

create trigger tasks_assignee_member_check
  before insert or update on public.tasks
  for each row execute function public.tasks_assignee_is_member();

create or replace function public.set_tasks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_tasks_updated_at();

-- ---------------------------------------------------------------------------
-- Profiles updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
