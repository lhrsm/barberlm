As melhorias focarão em garantir que agendamentos só afetem as finanças e dashboards após a conclusão pelo barbeiro, além de implementar a sincronização em tempo real.

### 1. Refatoração da Lógica Financeira (Dashboard e Finanças)
- **Dashboard**: Ajustar `fetchStats` para filtrar apenas agendamentos com `status = 'completed'` para os cálculos de "Serviços Vendidos", "Créditos Utilizados" e "Entrada em Caixa".
- **Página de Finanças**: 
  - Ajustar `fetchTransactions` para garantir que transações manuais e automáticas sejam exibidas corretamente.
  - Adicionar as colunas de Data e Hora do agendamento (conforme solicitado).
  - Garantir que o `summary` (Faturamento Operacional, Fluxo de Caixa, etc.) considere apenas o que foi efetivamente concluído.
  - O cálculo de comissão de freelancers será movido para considerar apenas transações de agendamentos concluídos.

### 2. Fluxo de Agendamento e Conclusão
- **Calendário**: 
  - Impedir que a criação de um agendamento gere uma transação financeira imediata (mesmo se marcado como "pago"). A transação só deve ser criada no momento da conclusão (`completeAppointment`).
  - No `handleMarkAsPaid`, garantir que o status também seja alterado para `completed` (isso já parece ocorrer em alguns lugares, mas será uniformizado).
- **Dashboard**:
  - No `completeAppointment`, garantir que a transação financeira seja registrada somente neste momento, independentemente de quando o pagamento foi feito.
  - Implementar o consumo de créditos do cliente apenas na conclusão do serviço.

### 3. Sincronização em Tempo Real (Realtime)
- Implementar assinaturas do Supabase Realtime nas páginas de Dashboard, Finanças e Calendário.
- Ouvir mudanças nas tabelas `appointments`, `transactions` e `customers`.
- Garantir que, quando um barbeiro alterar um status, as telas de outros administradores e do Portal do Cliente reflitam a mudança instantaneamente.

### 4. Portal do Cliente
- Garantir que a lógica de atualização em tempo real (que já possui uma base) cubra todos os estados (confirmado, concluído, cancelado).

### Detalhes Técnicos
- Uso de `supabase.channel()` para subscrição em tempo real.
- Filtros SQL rigorosos nas consultas (`.eq('status', 'completed')`) para os dashboards.
- Inclusão de `start_time` nas consultas de transação para exibir o horário correto.
