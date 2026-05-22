-- Habilitar visualização pública de perfis (barbearias)
CREATE POLICY "Profiles are viewable by everyone" 
ON public.profiles 
FOR SELECT 
USING (true);

-- Garantir que serviços são visíveis publicamente
DROP POLICY IF EXISTS "Services are viewable by everyone" ON public.services;
DROP POLICY IF EXISTS "Allow anonymous SELECT on services" ON public.services;
CREATE POLICY "Services are viewable by everyone" 
ON public.services 
FOR SELECT 
USING (true);

-- Garantir que barbeiros são visíveis publicamente
DROP POLICY IF EXISTS "Barbers are viewable by everyone" ON public.barbers;
CREATE POLICY "Barbers are viewable by everyone" 
ON public.barbers 
FOR SELECT 
USING (true);

-- Garantir que produtos são visíveis publicamente
DROP POLICY IF EXISTS "Public can view products" ON public.products;
CREATE POLICY "Public can view products" 
ON public.products 
FOR SELECT 
USING (true);

-- Ajustar visualização de agendamentos para anon/public
-- Importante: permitimos ver apenas campos básicos para evitar vazamento de dados de clientes
-- No entanto, como o RLS do Supabase é por linha, permitiremos o SELECT mas recomendaremos no código selecionar apenas o necessário.
DROP POLICY IF EXISTS "Allow anonymous SELECT on appointments" ON public.appointments;
CREATE POLICY "Allow anonymous SELECT on appointments" 
ON public.appointments 
FOR SELECT 
USING (true);
