# Plano de Ação - Sincronização e Estabilização do Portal do Cliente e Dashboard Admin

Este plano visa resolver os problemas operacionais e de exibição de dados no Portal do Cliente, estabilizar a persistência de agendamentos e garantir que o Dashboard Admin reflita a realidade operacional em tempo real.

## 1. Portal do Cliente - Reparo de Loops e Visibilidade de Dados
*   **Problema:** Carregamentos infinitos e cards de agendamento desaparecendo ou não atualizando.
*   **Solução:**
    *   Otimizar o `loadPortalData` em `src/routes/$slug.portal.tsx` para garantir que erros de query não travem a UI.
    *   Corrigir o filtro de `NextAppointmentCard` para considerar agendamentos `confirmed` recentes (hoje) mesmo que o horário de início já tenha passado mas ainda não tenham sido marcados como `completed`.
    *   Adicionar tratamento de erro explícito para queries de transações financeiras (créditos/cashback) para evitar que falhas em tabelas secundárias impeçam a visualização dos agendamentos.

## 2. Persistência de Agendamentos e Status Operacional
*   **Problema:** Agendamentos marcados como pagos via PIX no booking às vezes não aparecem como concluídos ou pagos no admin.
*   **Solução:**
    *   Auditar o `handleFinalizeBooking` em `src/routes/$slug.tsx` para garantir que o `payment_status: 'paid'` seja persistido corretamente para fluxos PIX concluídos.
    *   Garantir que agendamentos com `payment_status: 'paid'` mas `status: 'confirmed'` sejam contabilizados como receita no Dashboard Operacional.

## 3. Dashboard Admin - Visibilidade Operacional
*   **Problema:** Agendamentos de hoje não aparecem no Executive Summary.
*   **Solução:**
    *   Refatorar as queries do `ExecutiveSummary.tsx` e `dashboard.index.tsx` para alinhar os filtros de `status`. Incluir explicitamente agendamentos `pending` (que aguardam ação manual ou confirmação de pagamento) na visão operacional.
    *   Garantir que a query de agendamentos do dia use `start_time` normalizado para evitar problemas de fuso horário/timezone.

## 4. Segurança e Hardening de Acesso
*   **Problema:** Risco de loops de auth e perda de sessão em refreshes (F5).
*   **Solução:**
    *   Hardening do `useAuth.ts` para ser mais resiliente a latências de rede no fetch do perfil.
    *   Aprimorar o redirecionamento pós-login no `ClientLoginForm.tsx` para usar o slug correto de forma determinística.

## Detalhes Técnicos
*   **Tecnologias:** TanStack Start v1, Supabase (Lovable Cloud), Framer Motion, date-fns.
*   **Infraestrutura:** Manter lógica de banco em RPCs `security definer` para evitar bypass de RLS indevido em operações críticas.
