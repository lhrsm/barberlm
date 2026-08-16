
-- 1. Enum para categorias de conquistas (com verificação)
do $$ 
begin
    if not exists (select 1 from pg_type where typname = 'loyalty_category') then
        create type public.loyalty_category as enum ('visit', 'spend', 'referral', 'social', 'special');
    end if;
end $$;

-- 2. Tabela de Níveis de Fidelidade
create table if not exists public.loyalty_levels (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    min_xp integer not null default 0,
    icon text,
    color text,
    benefits text[],
    sort_order integer default 0,
    created_at timestamptz default now()
);

grant select on public.loyalty_levels to authenticated, anon;
grant all on public.loyalty_levels to service_role;
alter table public.loyalty_levels enable row level security;

do $$ 
begin
    if not exists (select 1 from pg_policy where polname = 'Anyone can read levels') then
        create policy "Anyone can read levels" on public.loyalty_levels for select using (true);
    end if;
end $$;

-- 3. Tabela de Conquistas (Achievements)
create table if not exists public.loyalty_achievements (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text,
    icon text,
    xp_reward integer not null default 0,
    category public.loyalty_category not null default 'visit',
    requirement_type text not null, -- 'total_visits', 'total_spend', 'referral_count', etc
    requirement_value integer not null default 1,
    hidden_until_unlocked boolean default false,
    created_at timestamptz default now()
);

grant select on public.loyalty_achievements to authenticated, anon;
grant all on public.loyalty_achievements to service_role;
alter table public.loyalty_achievements enable row level security;

do $$ 
begin
    if not exists (select 1 from pg_policy where polname = 'Anyone can read achievements') then
        create policy "Anyone can read achievements" on public.loyalty_achievements for select using (true);
    end if;
end $$;

-- 4. Tabela de Conquistas dos Clientes
create table if not exists public.customer_achievements (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid references public.customers(id) on delete cascade not null,
    achievement_id uuid references public.loyalty_achievements(id) on delete cascade not null,
    unlocked_at timestamptz default now(),
    unique(customer_id, achievement_id)
);

grant select on public.customer_achievements to authenticated;
grant all on public.customer_achievements to service_role;
alter table public.customer_achievements enable row level security;

do $$ 
begin
    if not exists (select 1 from pg_policy where polname = 'Customers can read their own achievements') then
        create policy "Customers can read their own achievements" on public.customer_achievements for select to authenticated using (true);
    end if;
end $$;

-- 5. Adicionar colunas XP e Nível em Customers
do $$ 
begin 
    if not exists (select 1 from information_schema.columns where table_name='customers' and column_name='xp') then
        alter table public.customers add column xp integer default 0;
    end if;
    if not exists (select 1 from information_schema.columns where table_name='customers' and column_name='loyalty_level_id') then
        alter table public.customers add column loyalty_level_id uuid references public.loyalty_levels(id);
    end if;
end $$;

-- 6. Inserir Níveis Iniciais (Corrigido para INSERT INTO)
insert into public.loyalty_levels (id, name, min_xp, icon, color, benefits, sort_order)
select * from (
    select gen_random_uuid(), 'Bronze', 0, 'Award', '#cd7f32', array['Fidelidade básica'], 1
    union all
    select gen_random_uuid(), 'Prata', 500, 'Shield', '#c0c0c0', array['5% cashback extra', 'Brinde no aniversário'], 2
    union all
    select gen_random_uuid(), 'Ouro', 1500, 'Crown', '#d4af37', array['10% cashback extra', 'Acesso antecipado a horários', '1 café premium/visita'], 3
    union all
    select gen_random_uuid(), 'Diamante', 4000, 'Gem', '#b9f2ff', array['15% cashback extra', 'Cancelamento sem taxa', 'Kit premium semestral'], 4
) as new_levels
where not exists (select 1 from public.loyalty_levels);

-- 7. Inserir Conquistas Iniciais
insert into public.loyalty_achievements (id, name, description, icon, xp_reward, category, requirement_type, requirement_value)
select * from (
    select gen_random_uuid(), 'Primeiro Passo', 'Concluiu seu primeiro atendimento', 'Scissors', 50, 'visit'::public.loyalty_category, 'total_visits', 1
    union all
    select gen_random_uuid(), 'Fiel Escudeiro', 'Visitou a barbearia 10 vezes', 'ShieldCheck', 250, 'visit'::public.loyalty_category, 'total_visits', 10
    union all
    select gen_random_uuid(), 'Embaixador', 'Indicou 3 amigos que concluíram um serviço', 'Users', 500, 'referral'::public.loyalty_category, 'referral_count', 3
    union all
    select gen_random_uuid(), 'Investidor', 'Gastou mais de R$ 1.000 em produtos e serviços', 'TrendingUp', 400, 'spend'::public.loyalty_category, 'total_spend', 1000
) as new_achievements
where not exists (select 1 from public.loyalty_achievements);
