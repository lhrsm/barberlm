CREATE OR REPLACE FUNCTION public.sync_customer_credits()
 RETURNS trigger
 LANGUAGE plpgsql
 AS $$
BEGIN
    -- Only sync to credits balance if it is NOT cashback
    IF NEW.credit_type = 'cashback' THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' AND NEW.status = 'available' THEN
        UPDATE public.customers 
        SET credits = COALESCE(credits, 0) + NEW.amount
        WHERE id = NEW.customer_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != 'available' AND NEW.status = 'available' THEN
            UPDATE public.customers 
            SET credits = COALESCE(credits, 0) + NEW.amount
            WHERE id = NEW.customer_id;
        ELSIF OLD.status = 'available' AND NEW.status != 'available' THEN
             UPDATE public.customers 
            SET credits = COALESCE(credits, 0) - OLD.amount
            WHERE id = OLD.customer_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_appointment_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 AS $$
DECLARE
    v_profile RECORD;
    v_cashback_amount NUMERIC(10,2) := 0;
    v_expires_at TIMESTAMP WITH TIME ZONE := NULL;
    v_base_amount NUMERIC(10,2);
    v_loyalty_points INTEGER;
    v_loyalty_reward_value NUMERIC(10,2);
BEGIN
    -- Só processa se o status mudou para 'completed'
    IF (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed') THEN
        
        -- 1. Incrementar pontos de fidelidade e obter novo saldo
        UPDATE public.customers
        SET loyalty_points = COALESCE(loyalty_points, 0) + 1
        WHERE id = NEW.customer_id
        RETURNING loyalty_points INTO v_loyalty_points;

        -- 2. Carregar configurações do tenant
        SELECT * INTO v_profile FROM public.profiles WHERE id = NEW.tenant_id;

        -- 3. Regra de Fidelidade: Se atingiu 10 atendimentos, gerar crédito
        -- (Apenas se configurado no perfil ou por padrão do sistema)
        IF v_loyalty_points >= 10 THEN
            -- Reset pontos
            UPDATE public.customers SET loyalty_points = 0 WHERE id = NEW.customer_id;
            
            -- Valor do prêmio (exemplo: R$ 10 ou configurado no profile)
            v_loyalty_reward_value := COALESCE(v_profile.loyalty_reward_value, 10.00);
            
            IF v_loyalty_reward_value > 0 THEN
                INSERT INTO public.customer_credits (
                    tenant_id, customer_id, appointment_id, amount, 
                    used_amount, status, credit_type, description
                ) VALUES (
                    NEW.tenant_id, NEW.customer_id, NEW.id, v_loyalty_reward_value, 
                    0, 'available', 'loyalty', 'Prêmio de Fidelidade: 10 Atendimentos'
                );
                
                -- Registrar transação de crédito para histórico
                INSERT INTO public.credit_transactions (
                    tenant_id, customer_id, appointment_id, type, 
                    amount, description
                ) VALUES (
                    NEW.tenant_id, NEW.customer_id, NEW.id, 'earned', 
                    v_loyalty_reward_value, 'Crédito de fidelidade concedido'
                );
            END IF;
        END IF;

        -- 4. Verificar se cashback está habilitado
        IF v_profile.cashback_enabled = true THEN
            -- Evitar duplicidade
            IF NOT EXISTS (SELECT 1 FROM public.customer_credits WHERE appointment_id = NEW.id AND credit_type = 'cashback') THEN
                -- Base é o valor real pago em dinheiro/pix/cartão
                v_base_amount := COALESCE(NEW.amount_paid, NEW.final_amount, NEW.total_price, 0);
                
                IF v_base_amount >= COALESCE(v_profile.cashback_minimum_amount, 0) AND v_base_amount > 0 THEN
                    IF v_profile.cashback_type = 'fixed' THEN
                        v_cashback_amount := COALESCE(v_profile.cashback_fixed_value, 0);
                    ELSE
                        v_cashback_amount := (v_base_amount * COALESCE(v_profile.cashback_percentage, 0)) / 100;
                    END IF;

                    IF v_cashback_amount > 0 THEN
                        IF v_profile.cashback_expiration_days IS NOT NULL AND v_profile.cashback_expiration_days > 0 THEN
                            v_expires_at := now() + (v_profile.cashback_expiration_days || ' days')::interval;
                        END IF;

                        -- Inserir na tabela de créditos com tipo cashback 
                        -- (sync_customer_credits não vai aumentar o saldo de créditos por causa da nova trava)
                        INSERT INTO public.customer_credits (
                            tenant_id, customer_id, appointment_id, amount, 
                            used_amount, status, credit_type, expires_at
                        ) VALUES (
                            NEW.tenant_id, NEW.customer_id, NEW.id, v_cashback_amount, 
                            0, 'available', 'cashback', v_expires_at
                        );

                        UPDATE public.appointments SET cashback_earned = v_cashback_amount WHERE id = NEW.id;

                        -- Atualizar apenas cashback_balance
                        UPDATE public.customers
                        SET cashback_balance = COALESCE(cashback_balance, 0) + v_cashback_amount
                        WHERE id = NEW.customer_id;

                        INSERT INTO public.cashback_transactions (
                            tenant_id, customer_id, appointment_id, type, 
                            amount, base_amount, description
                        ) VALUES (
                            NEW.tenant_id, NEW.customer_id, NEW.id, 'earned', 
                            v_cashback_amount, v_base_amount, 
                            'Cashback gerado pelo agendamento ' || NEW.id
                        );
                    END IF;
                END IF;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;