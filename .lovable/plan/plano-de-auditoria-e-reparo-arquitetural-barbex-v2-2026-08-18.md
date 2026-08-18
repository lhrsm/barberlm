# Plano de Auditoria e Reparo Arquitetural — Barbex v2

## Contexto
O sistema apresenta inconsistências críticas na sincronização de agendamentos, roteamento do portal do cliente e integridade financeira. Este plano visa restaurar a ordem seguindo a arquitetura definitiva.

## 1. Auditoria e Reparo de Rotas (/$slug/portal)
- **Correção de Redirecionamentos**: 
  - Impedir loops `/$slug/portal` -> `/$slug`.
  - Auditar `src/routes/$slug.portal.tsx` e `src/components/public/auth/ClientLoginForm.tsx`.
  - Garantir que logout leve a `/$slug`.
- **Eliminação de Rotas Legadas**: 
  - Remover referências a `/portal` global e `/auth?tab=client`.
  - Atualizar o link "Acesso para Clientes" em `/auth` para ser sensível ao contexto do tenant.

## 2. Auditoria de Persistência de Agendamentos (Appointments)
- **Sincronização Central**:
  - Garantir que a confirmação do agendamento em `src/routes/$slug.tsx` seja a única fonte de verdade.
  - O agendamento deve ser persistido *antes* do disparo de automações ou registros financeiros.
- **Correção de Relacionamentos**:
  - Verificar se `appointment.customer_id` aponta para `customers.id` (e não `auth.users.id`).
  - Garantir que `tenant_id` seja propagado corretamente do slug da barbearia.

## 3. Reparo Financeiro
- **Regra de Pagamento**:
  - Restaurar a distinção entre "Agendado" e "Pago".
  - Agendamentos com "Pagar no Salão" devem ser criados com `payment_status = 'pending'` e não devem ser contabilizados como receita até confirmação manual.

## 4. Auditoria de Interfaces
- **Painel Admin / Agenda / Profissional**:
  - Auditar queries para garantir que exibam agendamentos novos (status `confirmed` ou `scheduled`).
- **Portal do Cliente**:
  - Garantir que a lista de agendamentos filtre corretamente por `customer_id` e `tenant_id`.

## Relatório Forense (Preparação)
Será realizado um agendamento de teste para validar:
1. Persistência no banco (`public.appointments`).
2. Disparo de automação (`Z-API`).
3. Aparecimento em todas as interfaces.
4. Redirecionamento correto pós-fluxo.

---
**Regra de Ouro**: O que funciona (WhatsApp, Resend, Auth Admin, Multi-tenancy) não será alterado.
