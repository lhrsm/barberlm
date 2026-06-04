-- 1. CORREÇÃO DO ERRO v_cashback_earned na função complete_appointment
CREATE OR REPLACE FUNCTION public.complete_appointment(
    p_appointment_id uuid, 
    p_changed_by_type text DEFAULT 'admin'::text, 
    p_changed_by_id uuid DEFAULT NULL::uuid, 
    p_source text DEFAULT 'system'::text, 
    p_metadata jsonb DEFAULT '{}'::jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_appt RECORD;
    v_tenant RECORD;
    v_cashback_percentage DECIMAL(10, 2) := 0;
    v_cashback_amount DECIMAL(10, 2) := 0;
    v_already_earned BOOLEAN := FALSE;
    v_result JSONB;
    v_final_amount DECIMAL(10, 2);
    v_credit_used DECIMAL(10, 2);
    v_cashback_used DECIMAL(10, 2);
    v_payment_status TEXT;
    v_old_cashback_balance DECIMAL(10, 2);
    v_new_cashback_balance DECIMAL(10, 2);
    v_old_credit_balance DECIMAL(10, 2);
    v_new_credit_balance DECIMAL(10, 2);
    v_deduction_text TEXT := '';
    v_cashback_earned DECIMAL(10, 2) := 0; -- DECLARAÇÃO DA VARIÁVEL FALTANTE
BEGIN
    -- 1. Buscar agendamento e configurações do tenant (perfil)
    SELECT * INTO v_appt FROM appointments WHERE id = p_appointment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
    END IF;

    -- Se já estiver concluído, apenas retornar sucesso
    IF v_appt.status = 'completed' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Agendamento já está concluído');
    END IF;

    SELECT * INTO v_tenant FROM profiles WHERE id = v_appt.tenant_id;

    -- 2. Aplicar Metadados (Pagamento, Créditos Usados, etc.)
    v_payment_status := COALESCE(p_metadata->>'payment_status', v_appt.payment_status, 'pending');
    v_credit_used := COALESCE((p_metadata->>'credit_used')::numeric, v_appt.credit_used, 0);
    v_cashback_used := COALESCE((p_metadata->>'cashback_used')::numeric, v_appt.cashback_used, 0);
    v_final_amount := COALESCE((p_metadata->>'final_amount')::numeric, v_appt.final_amount, (v_appt.total_price - v_credit_used - v_cashback_used));

    -- 3. Lógica de Desconto de Cashback (Se utilizado)
    IF v_cashback_used > 0 THEN
        UPDATE customers 
        SET cashback_balance = COALESCE(cashback_balance, 0) - v_cashback_used,
            updated_at = now()
        WHERE id = v_appt.customer_id
        RETURNING cashback_balance INTO v_new_cashback_balance;

        INSERT INTO cashback_transactions (
            tenant_id, customer_id, appointment_id, type, amount, base_amount, description
        ) VALUES (
            v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'cashback_used', -v_cashback_used, v_appt.total_price, 'Cashback utilizado no agendamento'
        );
        
        v_deduction_text := v_deduction_text || ' (Cashback: R$ ' || v_cashback_used || ')';
    END IF;

    -- 4. Lógica de Desconto de Créditos (Se utilizado)
    IF v_credit_used > 0 THEN
        UPDATE customers 
        SET credits = COALESCE(credits, 0) - v_credit_used,
            updated_at = now()
        WHERE id = v_appt.customer_id
        RETURNING credits INTO v_new_credit_balance;
        
        v_deduction_text := v_deduction_text || ' (Créditos: R$ ' || v_credit_used || ')';
    END IF;

    -- 5. Atualizar o agendamento com as informações de pagamento
    UPDATE appointments SET
        payment_status = v_payment_status,
        credit_used = v_credit_used,
        cashback_used = v_cashback_used,
        final_amount = v_final_amount,
        updated_at = now()
    WHERE id = p_appointment_id;

    -- 6. Lógica de Ganho de Cashback
    IF COALESCE(v_tenant.cashback_enabled, false) AND v_payment_status = 'paid' THEN
        SELECT EXISTS (
            SELECT 1 FROM cashback_transactions 
            WHERE appointment_id = p_appointment_id AND type = 'cashback_earned'
        ) INTO v_already_earned;

        IF NOT v_already_earned THEN
            v_cashback_percentage := COALESCE(v_tenant.cashback_percentage, 0);
            IF v_cashback_percentage > 0 THEN
                v_cashback_earned := (v_appt.total_price * v_cashback_percentage) / 100;
                v_cashback_amount := v_cashback_earned;
            END IF;
        END IF;
    END IF;

    -- 7. Atualizar status para concluído usando função central
    v_result := update_appointment_status(
        p_appointment_id, 
        'completed', 
        p_changed_by_type, 
        p_changed_by_id, 
        p_source,
        p_metadata || jsonb_build_object(
            'cashback_earned', v_cashback_earned,
            'total_price', v_appt.total_price
        )
    );

    IF NOT (v_result->>'success')::boolean THEN
        RETURN v_result;
    END IF;

    -- 8. Efetivar ganho de cashback se calculado
    IF v_cashback_amount > 0 AND NOT v_already_earned THEN
        UPDATE customers 
        SET 
            cashback_balance = COALESCE(cashback_balance, 0) + v_cashback_amount,
            loyalty_points = COALESCE(loyalty_points, 0) + 1,
            updated_at = now()
        WHERE id = v_appt.customer_id;

        INSERT INTO cashback_transactions (
            tenant_id, customer_id, appointment_id, type, amount, base_amount, description
        ) VALUES (
            v_appt.tenant_id, v_appt.customer_id, p_appointment_id, 'cashback_earned', v_cashback_amount, v_appt.total_price, 'Cashback por atendimento concluído'
        );

        UPDATE appointments SET cashback_earned = v_cashback_amount WHERE id = p_appointment_id;
        
        -- Gerar gatilho para automação de cashback
        INSERT INTO automation_v2_queue (tenant_id, event_name, payload)
        VALUES (v_appt.tenant_id, 'cashback.created', jsonb_build_object(
            'appointment_id', p_appointment_id,
            'customer_id', v_appt.customer_id,
            'amount', v_cashback_amount
        ));
    END IF;

    -- 9. Registrar Transação Financeira REAL (Entrada em Caixa)
    IF v_payment_status = 'paid' AND v_final_amount > 0 THEN
        IF NOT EXISTS (SELECT 1 FROM transactions WHERE appointment_id = p_appointment_id) THEN
            INSERT INTO transactions (
                tenant_id, user_id, barber_id, appointment_id, amount, type, category, description, date
            ) VALUES (
                v_appt.tenant_id, v_appt.tenant_id, v_appt.barber_id, p_appointment_id, v_final_amount, 'income', 'Serviço', 
                'Atendimento' || v_deduction_text || ': ' || (SELECT name FROM services WHERE id = v_appt.service_id) || ' - ' || (SELECT name FROM customers WHERE id = v_appt.customer_id),
                CURRENT_DATE
            );
        END IF;
    END IF;

    -- Gerar gatilho para automação de pós-atendimento
    INSERT INTO automation_v2_queue (tenant_id, event_name, payload)
    VALUES (v_appt.tenant_id, 'appointment.completed', jsonb_build_object(
        'appointment_id', p_appointment_id,
        'customer_id', v_appt.customer_id
    ));

    RETURN jsonb_build_object(
        'success', true, 
        'cashback_earned', v_cashback_amount,
        'cashback_used', v_cashback_used,
        'credit_used', v_credit_used,
        'final_amount', v_final_amount,
        'new_status', 'completed'
    );
END;
$function$;

-- 2. CADASTRO DE WORKFLOWS PADRÃO V2
-- Garantir constraint de unicidade
ALTER TABLE public.automation_v2_workflows DROP CONSTRAINT IF EXISTS automation_v2_workflows_tenant_key_unique;
ALTER TABLE public.automation_v2_workflows ADD CONSTRAINT automation_v2_workflows_tenant_key_unique UNIQUE (tenant_id, workflow_key);

-- Função para popular workflows padrão para todos os tenants
CREATE OR REPLACE FUNCTION public.seed_default_workflows_v2()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    t_id uuid;
BEGIN
    FOR t_id IN SELECT id FROM profiles LOOP
        
        -- 1. Confirmação Único
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'confirmation_single', 'Confirmação de Agendamento Único', 'appointment.created', true, jsonb_build_object(
            'flow_type', 'single',
            'template', 'Olá {customer_name} 👋\n\nSeu agendamento na {barbershop_name} foi realizado com sucesso.\n\n📋 Resumo do agendamento:\n\n✅ Serviço: {service_name}\n💈 Profissional: {professional_name}\n📅 Data: {appointment_date}\n⏰ Horário: {appointment_time}\n\nO que deseja fazer?'
        )) ON CONFLICT (tenant_id, workflow_key) DO NOTHING;

        -- 2. Confirmação Multi
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'confirmation_multi', 'Confirmação de Múltiplos Agendamentos', 'appointment.created', true, jsonb_build_object(
            'flow_type', 'multi',
            'template', 'Olá {customer_name} 👋\n\nSeus agendamentos na {barbershop_name} foram realizados com sucesso.\n\n📋 Resumo dos agendamentos:\n\n{appointments_list}\n\nO que deseja fazer?'
        )) ON CONFLICT (tenant_id, workflow_key) DO NOTHING;

        -- 3. Cancelamento
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'appointment_cancelled', 'Cancelamento de Agendamento', 'appointment.cancelled', true, jsonb_build_object(
            'template', 'Olá {customer_name}, seu agendamento na {barbershop_name} foi cancelado com sucesso.'
        )) ON CONFLICT (tenant_id, workflow_key) DO NOTHING;

        -- 4. Reagendamento
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'appointment_rescheduled', 'Reagendamento de Agendamento', 'appointment.rescheduled', true, jsonb_build_object(
            'template', 'Olá {customer_name}, seu agendamento foi reagendado com sucesso.\n\n📅 Nova data: {appointment_date}\n⏰ Novo horário: {appointment_time}'
        )) ON CONFLICT (tenant_id, workflow_key) DO NOTHING;

        -- 5. Lembrete
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'appointment_reminder', 'Lembrete de Agendamento', 'appointment.reminder', true, jsonb_build_object(
            'times', ARRAY['24h', '2h'],
            'template', 'Olá {customer_name}, passando para lembrar do seu agendamento na {barbershop_name}.\n\n📅 Data: {appointment_date}\n⏰ Horário: {appointment_time}\n💈 Profissional: {professional_name}'
        )) ON CONFLICT (tenant_id, workflow_key) DO NOTHING;

        -- 6. Aniversário
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'customer_birthday', 'Aniversário do Cliente', 'customer.birthday', false, jsonb_build_object(
            'template', 'Feliz aniversário, {customer_name}! 🎉\n\nA {barbershop_name} deseja um dia incrível para você.'
        )) ON CONFLICT (tenant_id, workflow_key) DO NOTHING;

        -- 7. Cliente Inativo
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'inactive_customer', 'Cliente Inativo', 'customer.inactive', false, jsonb_build_object(
            'days', 30,
            'template', 'Olá {customer_name}, sentimos sua falta na {barbershop_name}! Que tal agendar seu próximo atendimento?'
        )) ON CONFLICT (tenant_id, workflow_key) DO NOTHING;

        -- 8. Pós-atendimento
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'post_service', 'Pós-atendimento', 'appointment.completed', true, jsonb_build_object(
            'template', 'Obrigado pela visita, {customer_name}! Foi um prazer atender você na {barbershop_name}.'
        )) ON CONFLICT (tenant_id, workflow_key) DO NOTHING;

        -- 9. Pedido de Avaliação
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'review_request', 'Pedido de Avaliação', 'appointment.completed', false, jsonb_build_object(
            'template', 'Olá {customer_name}, como foi sua experiência na {barbershop_name}? Sua avaliação é muito importante para nós.'
        )) ON CONFLICT (tenant_id, workflow_key) DO NOTHING;

        -- 10. Créditos Disponíveis
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'credit_created', 'Créditos Disponíveis', 'credit.created', true, jsonb_build_object(
            'template', 'Olá {customer_name}, você recebeu R$ {credit_amount} em créditos na {barbershop_name}.'
        )) ON CONFLICT (tenant_id, workflow_key) DO NOTHING;

        -- 11. Cashback Gerado
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'cashback_created', 'Cashback Gerado', 'cashback.created', true, jsonb_build_object(
            'template', 'Olá {customer_name}, você ganhou R$ {cashback_amount} de cashback na {barbershop_name}.'
        )) ON CONFLICT (tenant_id, workflow_key) DO NOTHING;

        -- 12. Pagamento Confirmado
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'payment_confirmed', 'Pagamento Confirmado', 'payment.confirmed', true, jsonb_build_object(
            'template', 'Olá {customer_name}, seu pagamento foi confirmado com sucesso.'
        )) ON CONFLICT (tenant_id, workflow_key) DO NOTHING;

        -- 13. Pagamento Pendente
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'payment_pending', 'Pagamento Pendente', 'payment.pending', false, jsonb_build_object(
            'template', 'Olá {customer_name}, identificamos um pagamento pendente referente ao seu agendamento.'
        )) ON CONFLICT (tenant_id, workflow_key) DO NOTHING;

        -- 14. Aviso Barbearia
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'notify_barbershop_new_appointment', 'Aviso para a Barbearia', 'appointment.created', false, jsonb_build_object(
            'recipient', 'admin',
            'template', 'Novo agendamento recebido:\n\nCliente: {customer_name}\nServiço: {service_name}\nData: {appointment_date}\nHorário: {appointment_time}\nProfissional: {professional_name}'
        )) ON CONFLICT (tenant_id, workflow_key) DO NOTHING;

        -- 15. Profissional Notificado
        INSERT INTO automation_v2_workflows (tenant_id, workflow_key, name, event_name, active, configuration)
        VALUES (t_id, 'notify_professional_new_appointment', 'Profissional Notificado', 'appointment.created', false, jsonb_build_object(
            'recipient', 'professional',
            'template', 'Novo atendimento agendado:\n\nCliente: {customer_name}\nServiço: {service_name}\nData: {appointment_date}\nHorário: {appointment_time}'
        )) ON CONFLICT (tenant_id, workflow_key) DO NOTHING;

    END LOOP;
END;
$function$;

-- Executar o seeding
SELECT public.seed_default_workflows_v2();

-- Grant permissões (necessário para a tabela v2_workflows se foi criada recentemente)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_v2_workflows TO authenticated;
GRANT ALL ON public.automation_v2_workflows TO service_role;
