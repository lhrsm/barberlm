create table public.email_logs (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references public.profiles(id) on delete set null, -- Using profiles as tenant reference based on types.ts academy_paths
    user_id uuid references auth.users(id) on delete set null,
    recipient text not null,
    template_key text not null,
    provider text not null default 'resend',
    provider_message_id text,
    status text not null default 'pending',
    attempts integer not null default 0,
    sent_at timestamptz,
    delivered_at timestamptz,
    failed_at timestamptz,
    error_code text,
    correlation_id text,
    provider_event_id text unique,
    created_at timestamptz not null default now()
);

grant select, insert, update on public.email_logs to authenticated;
grant all on public.email_logs to service_role;

alter table public.email_logs enable row level security;

create policy "Admins can view all email logs"
    on public.email_logs
    for select
    to authenticated
    using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin'));

create policy "Tenants can view their own email logs"
    on public.email_logs
    for select
    to authenticated
    using (tenant_id = (select tenant_id from public.tenant_memberships where user_id = auth.uid() limit 1));