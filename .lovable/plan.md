# Plan: Restaurar Gestão de Agendamentos no Painel Administrativo

O objetivo é diagnosticar e corrigir o problema onde os agendamentos não aparecem no painel administrativo, garantindo que as funcionalidades de gestão (aprovação, pagamento, reagendamento, cancelamento) funcionem corretamente sem quebrar os fluxos existentes.

## Diagnóstico Técnico

Identifiquei que o problema pode estar relacionado a:
1. **Políticas de RLS**: A política `Tenant can view own appointments` exige que `tenant_id` seja igual ao `id` do perfil autenticado. Se o `tenant_id` não estiver sendo populado corretamente ou se houver um desalinhamento entre o `id` do usuário e o `tenant_id` esperado, os dados não aparecerão.
2. **Isolamento de Tenant**: O hook `useTenant` e `useReception` determinam o `tenantId`. Se houver falha na resolução deste ID (especialmente para perfis de recepcionista/gerente), a query falhará ou retornará vazio.
3. **Filtros de Data**: A query em `ReceptionQueue` e `Dashboard` utiliza filtros `gte` e `lte` baseados em strings ISO que podem ter problemas de timezone.

## Etapas de Implementação

### 1. Diagnóstico de Visibilidade de Dados
- Utilizar `getReceptionAppointments` (Server Function) para comparar o que o servidor vê vs o que o cliente vê.
- Verificar se novos agendamentos criados via link público estão recebendo o `tenant_id` correto.

### 2. Correção de RLS e Permissões
- Ajustar políticas de RLS se necessário para permitir que `reception` e `manager` visualizem agendamentos do seu tenant.
- Garantir que `tenant_id` seja obrigatório e preenchido em todos os fluxos de criação (manual e público).

### 3. Ajuste nos Componentes de Gestão
- **ReceptionQueue.tsx**: Otimizar a query para garantir que todos os agendamentos do dia sejam listados, independente do barbeiro selecionado (filtro "all").
- **Dashboard.tsx**: Sincronizar os contadores de agendamentos com a mesma lógica da agenda.
- **Calendar.tsx**: Garantir que a invalidação de query (`invalidateQueries`) aconteça em todos os eventos de realtime.

### 4. Restauração das Ações Operacionais
- Validar as RPCs `cancel_appointment` e `complete_appointment` via `useAppointmentStatus`.
- Garantir que o modal de detalhes exiba informações completas (Cliente, Pagamento, Histórico).

## Detalhes Técnicos
- **RLS**: Revisar a política `Tenant can view own appointments` para suportar `reception_permissions`.
- **Timezone**: Padronizar o uso de `startOfDay` e `endOfDay` com UTC/Timezone do banco para evitar desaparecimento de agendamentos em horários de transição.
- **Realtime**: Assegurar que os canais de realtime estejam ouvindo corretamente com o filtro de `tenant_id`.
