# Barbex: Validação Pós-Correção e Correção Cirúrgica

Ajustes cirúrgicos na persistência de agendamentos, regras financeiras de pagamento e visibilidade multi-tenant.

## Alterações Propostas

### 1. Regras Financeiras e Status de Pagamento
- **Booking Flow (`src/routes/$slug.tsx`)**: 
  - Garantir que `payment_status` seja `pending` para PIX e Pagamento no Salão.
  - Apenas agendamentos 100% cobertos por assinatura ou valor zero serão marcados como `paid` instantaneamente.
  - Separação clara entre `payment_method` e `payment_status`.
- **Dashboard Financeiro (`src/routes/dashboard.index.tsx`)**:
  - Ajustar métricas de "Faturamento Realizado" para considerar apenas agendamentos com `payment_status = 'paid'`.
  - Diferenciar "Receita Realizada" de "Receita Prevista" (pending/scheduled).

### 2. Estabilização e Visibilidade (RLS & F5)
- **RLS Hardening**: Verificar se a política permite que clientes vejam seus agendamentos via `customer_id` vinculado ao `auth.uid()`, independentemente do `user_id` da linha (tratando a falha de identificação histórica).
- **Resiliência de Loading**: Adicionar timeouts e estados de erro explícitos no Dashboard e Portal para evitar telas pretas ou loaders infinitos.

### 3. Redirecionamento e Logout
- **Pós-Agendamento**: Garantir redirecionamento para `/${slug}/portal` com persistência de sessão.
- **Logout**: Padronizar logout em `/portal` para retornar à home da barbearia (`/${slug}`).

## Detalhes Técnicos

### Regra de Pagamento no Agendamento:
```typescript
payment_status: (isCoveredFull || calculateTotal() === 0) ? 'paid' : 'pending'
```

### Métricas no Dashboard:
```typescript
// Apenas agendamentos pagos entram no fluxo de caixa real
const dailyCashInflow = dailyAppointmentsData.data
  ?.filter(appt => appt.payment_status === 'paid' || appt.status === 'completed')
  ?.reduce((acc, curr) => acc + Number(curr.final_amount || 0), 0) || 0;
```

## Testes de Validação
- Execução de agendamento real (não mockado) na Barbearia LM.
- Matriz de visibilidade (Banco, Admin, Cliente, Profissional).
- Teste de F5 e troca de abas para validação de reidratação de sessão.
