-- Permitir que qualquer pessoa se cadastre como cliente (necessário para o primeiro agendamento)
CREATE POLICY "Anyone can create customers" 
ON public.customers 
FOR INSERT 
WITH CHECK (true);

-- Permitir que qualquer pessoa crie ou atualize seu registro de auth simplificado
CREATE POLICY "Anyone can create client auth" 
ON public.client_auth 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update client auth" 
ON public.client_auth 
FOR UPDATE 
USING (true);

-- Garantir que qualquer pessoa possa criar agendamentos
DROP POLICY IF EXISTS "Anyone can create appointments" ON public.appointments;
CREATE POLICY "Anyone can create appointments" 
ON public.appointments 
FOR INSERT 
WITH CHECK (true);
