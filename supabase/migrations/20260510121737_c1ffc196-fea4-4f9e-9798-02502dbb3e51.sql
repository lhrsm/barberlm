create type public.app_role as enum ('super_admin', 'admin', 'tenant_admin', 'barber', 'client');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  role public.app_role not null,
  created_at timestamp with time zone not null default now()
);

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

create policy "Users can view their own role"
on public.user_roles
for select
using (auth.uid() = user_id or public.has_role(auth.uid(), 'super_admin'));

create policy "Super admins can manage roles"
on public.user_roles
for all
using (public.has_role(auth.uid(), 'super_admin'))
with check (public.has_role(auth.uid(), 'super_admin'));

create or replace function public.is_super_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.has_role(auth.uid(), 'super_admin'), false)
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.has_role(auth.uid(), 'super_admin'), false)
$$;

create or replace function public.get_my_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text
  from public.user_roles
  where user_id = auth.uid()
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, business_name, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'business_name', 'Minha Barbearia'),
    'tenant_admin',
    'active'
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'tenant_admin')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

insert into public.user_roles (user_id, role)
select p.id,
  case
    when p.role = 'super_admin' then 'super_admin'::public.app_role
    when p.role = 'admin' then 'admin'::public.app_role
    when p.role = 'tenant_admin' then 'tenant_admin'::public.app_role
    when p.role = 'barber' then 'barber'::public.app_role
    else 'client'::public.app_role
  end
from public.profiles p
on conflict (user_id) do update set role = excluded.role;

update public.user_roles
set role = 'super_admin'
where user_id = (
  select id from auth.users where email = 'analistalouis@gmail.com' limit 1
);

update public.user_roles
set role = 'tenant_admin'
where user_id = (
  select id from auth.users where email = 'louisdabahia@gmail.com' limit 1
);

update public.profiles
set role = 'client'
where id = (
  select id from auth.users where email = 'analistalouis@gmail.com' limit 1
);

update public.profiles
set role = 'tenant_admin'
where id = (
  select id from auth.users where email = 'louisdabahia@gmail.com' limit 1
);