-- Criar tabela de permissões
CREATE TABLE IF NOT EXISTS public.permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text UNIQUE NOT NULL,
    name text NOT NULL,
    description text,
    category text NOT NULL,
    created_at timestamptz DEFAULT now()
);

GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for authenticated permissions" ON public.permissions
FOR SELECT TO authenticated USING (true);

-- Criar tabela de permissões por role
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role public.app_role NOT NULL,
    permission_key text REFERENCES public.permissions(key) ON DELETE CASCADE NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE(role, permission_key)
);

GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for authenticated role_permissions" ON public.role_permissions
FOR SELECT TO authenticated USING (true);

-- Função para verificar permissão
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _user_role public.app_role;
BEGIN
    -- Obter a role do usuário (priorizando a tabela user_roles)
    SELECT role INTO _user_role
    FROM public.user_roles
    WHERE user_id = _user_id
    LIMIT 1;

    -- Se for super_admin, tem todas as permissões
    IF _user_role = 'super_admin' THEN
        RETURN true;
    END IF;

    -- Verificar se a role tem a permissão associada
    RETURN EXISTS (
        SELECT 1
        FROM public.role_permissions
        WHERE role = _user_role
          AND permission_key = _permission_key
    );
END;
$$;

-- Inserir permissões padrão
INSERT INTO public.permissions (key, name, category) VALUES
('dashboard:view', 'Ver Dashboard', 'General'),
('command_center:view', 'Ver Centro de Comando', 'Operational'),
('appointments:view', 'Ver Agendamentos', 'Appointments'),
('appointments:create', 'Criar Agendamentos', 'Appointments'),
('appointments:manage', 'Gerenciar Agendamentos', 'Appointments'),
('clients:view', 'Ver Clientes', 'CRM'),
('clients:manage', 'Gerenciar Clientes', 'CRM'),
('finances:view', 'Ver Financeiro', 'Financial'),
('finances:manage', 'Gerenciar Financeiro', 'Financial'),
('professionals:view', 'Ver Profissionais', 'Staff'),
('professionals:manage', 'Gerenciar Profissionais', 'Staff'),
('users:manage', 'Gerenciar Usuários', 'Staff'),
('marketing:view', 'Ver Marketing', 'Marketing'),
('marketing:manage', 'Gerenciar Marketing', 'Marketing'),
('integrations:manage', 'Gerenciar Integrações', 'Settings'),
('settings:manage', 'Configurações Gerais', 'Settings'),
('security:manage', 'Gerenciar Segurança', 'Security')
ON CONFLICT (key) DO NOTHING;

-- Presets iniciais
DO $$
DECLARE
    p_key text;
BEGIN
    -- Owner/Admin/Tenant Admin
    FOR p_key IN SELECT key FROM public.permissions LOOP
        INSERT INTO public.role_permissions (role, permission_key)
        VALUES ('admin', p_key)
        ON CONFLICT DO NOTHING;
        
        INSERT INTO public.role_permissions (role, permission_key)
        VALUES ('tenant_admin', p_key)
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- Preset Receptionist
INSERT INTO public.role_permissions (role, permission_key) VALUES
('receptionist', 'command_center:view'),
('receptionist', 'appointments:view'),
('receptionist', 'appointments:create'),
('receptionist', 'appointments:manage'),
('receptionist', 'clients:view'),
('receptionist', 'clients:manage'),
('reception', 'command_center:view'),
('reception', 'appointments:view'),
('reception', 'appointments:create'),
('reception', 'appointments:manage'),
('reception', 'clients:view'),
('reception', 'clients:manage')
ON CONFLICT DO NOTHING;

-- Migrar usuários legados para novas roles se necessário
UPDATE public.user_roles SET role = 'receptionist' WHERE role = 'reception';
UPDATE public.user_roles SET role = 'professional' WHERE role = 'barber';
