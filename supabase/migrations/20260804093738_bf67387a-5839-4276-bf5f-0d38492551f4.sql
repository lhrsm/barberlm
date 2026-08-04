create type public.tour_status as enum ('not_started', 'in_progress', 'completed', 'skipped');

create table public.user_onboarding_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  tenant_id uuid not null,
  step_key text not null,
  completed_at timestamptz default now(),
  unique(user_id, tenant_id, step_key)
);

create table public.user_tour_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  tenant_id uuid not null,
  tour_key text not null,
  status public.tour_status default 'not_started' not null,
  version text not null,
  last_step_index int default 0,
  updated_at timestamptz default now(),
  unique(user_id, tenant_id, tour_key)
);

grant select, insert, update on public.user_onboarding_progress to authenticated;
grant select, insert, update on public.user_tour_states to authenticated;
grant all on public.user_onboarding_progress to service_role;
grant all on public.user_tour_states to service_role;

alter table public.user_onboarding_progress enable row level security;
alter table public.user_tour_states enable row level security;

create policy "Users can manage their own onboarding progress"
  on public.user_onboarding_progress
  for all
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can manage their own tour states"
  on public.user_tour_states
  for all
  to authenticated
  using (auth.uid() = user_id);
