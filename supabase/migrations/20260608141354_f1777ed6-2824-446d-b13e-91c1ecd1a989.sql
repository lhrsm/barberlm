-- 1. Adicionar colunas em profiles para configurações avançadas de cashback
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS cashback_type TEXT DEFAULT 'percentage',
ADD COLUMN IF NOT EXISTS cashback_fixed_value NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cashback_minimum_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cashback_expiration_days INTEGER;

-- 2. Adicionar colunas em customer_credits para melhor controle
ALTER TABLE public.customer_credits
ADD COLUMN IF NOT EXISTS credit_type TEXT DEFAULT 'cashback',
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS source_payment_id TEXT;

-- 3. Atualizar a função de gatilho para processar o cashback ao concluir agendamento
CREATE OR REPLACE FUNCTION public.handle_appointment_completion()
RETURNS TRIGGER AS $$
DECLARE
    v_profile RECORD;
    v_cashback_amount NUMERIC(10,2) := 0;
    v_expires_at TIMESTAMP WITH TIME ZONE := NULL;
    v_base_amount NUMERIC(10,2);
BEGIN
    -- Só processa se o status mudou para 'completed'
    IF (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed') THEN
        
        -- 1. Incrementar pontos de fidelidade (regra existente)
        UPDATE public.customers
        SET loyalty_points = COALESCE(loyalty_points, 0) + 1
        WHERE id = NEW.customer_id;

        -- 2. Carregar configurações de cashback do tenant
        SELECT * INTO v_profile FROM public.profiles WHERE id = NEW.tenant_id;

        -- 3. Verificar se cashback está habilitado
        IF v_profile.cashback_enabled = true THEN
            
            -- Verificar se já existe cashback para este agendamento (evitar duplicidade)
            IF NOT EXISTS (SELECT 1 FROM public.customer_credits WHERE appointment_id = NEW.id AND credit_type = 'cashback') THEN
                
                v_base_amount := COALESCE(NEW.amount_paid, NEW.total_price, 0);
                
                -- Verificar valor mínimo
                IF v_base_amount >= COALESCE(v_profile.cashback_minimum_amount, 0) AND v_base_amount > 0 THEN
                    
                    -- Calcular valor do cashback
                    IF v_profile.cashback_type = 'fixed' THEN
                        v_cashback_amount := COALESCE(v_profile.cashback_fixed_value, 0);
                    ELSE
                        -- Default: percentage
                        v_cashback_amount := (v_base_amount * COALESCE(v_profile.cashback_percentage, 0)) / 100;
                    END IF;

                    -- Se o cashback for maior que zero, conceder o crédito
                    IF v_cashback_amount > 0 THEN
                        
                        -- Calcular expiração
                        IF v_profile.cashback_expiration_days IS NOT NULL AND v_profile.cashback_expiration_days > 0 THEN
                            v_expires_at := now() + (v_profile.cashback_expiration_days || ' days')::interval;
                        END IF;

                        -- Inserir o crédito
                        INSERT INTO public.customer_credits (
                            tenant_id,
                            customer_id,
                            appointment_id,
                            amount,
                            used_amount,
                            status,
                            credit_type,
                            expires_at
                        ) VALUES (
                            NEW.tenant_id,
                            NEW.customer_id,
                            NEW.id,
                            v_cashback_amount,
                            0,
                            'available',
                            'cashback',
                            v_expires_at
                        );

                        -- Atualizar o agendamento com o valor ganho
                        UPDATE public.appointments 
                        SET cashback_earned = v_cashback_amount
                        WHERE id = NEW.id;

                        -- Atualizar o saldo do cliente (opcional se usar view, mas mantendo compatibilidade)
                        UPDATE public.customers
                        SET cashback_balance = COALESCE(cashback_balance, 0) + v_cashback_amount,
                            credits = COALESCE(credits, 0) + v_cashback_amount
                        WHERE id = NEW.customer_id;

                        -- Registrar na tabela de histórico de transações de cashback
                        INSERT INTO public.cashback_transactions (
                            tenant_id,
                            customer_id,
                            appointment_id,
                            type,
                            amount,
                            base_amount,
                            description
                        ) VALUES (
                            NEW.tenant_id,
                            NEW.customer_id,
                            NEW.id,
                            'earned',
                            v_cashback_amount,
                            v_base_amount,
                            'Cashback gerado pelo agendamento ' || NEW.id
                        );
                    END IF;
                END IF;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
