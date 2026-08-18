# Barbex — Correção Definitiva do Reconhecimento de Customer no Booking

Correção da resolução de identidade no fluxo de agendamento para garantir isolamento por unidade (tenant), restaurar a experiência visual premium de reconhecimento e pular etapas redundantes para clientes ativos (READY).

## User Review Required

> [!IMPORTANT]
> A correção foca no isolamento estrito por unidade. Clientes com o mesmo telefone em unidades diferentes serão tratados como identidades distintas, conforme solicitado.

- **Isolamento por Unidade**: A busca multi-tenant será removida do booking para evitar que "Luiz" apareça onde deveria ser "Carlos".
- **Bypass de E-mail**: Clientes `READY` pularão diretamente para a seleção de serviços.
- **Restauração Visual**: O card verde de confirmação será restaurado.

## Technical Details

### 1. Resolução de Identidade (src/routes/$slug.tsx)
- Modificar `findCustomer` para remover a busca multi-tenant. A query será filtrada exclusivamente por `tenant_id` e `phone`.
- Implementar limpeza agressiva de estado (`setCustomerId(null)`, etc.) antes de iniciar a busca.
- Adicionar `[CUSTOMER_RESOLUTION_TRACE]` com logs detalhados para auditoria de telefone, tenant e resultados da query.
- Garantir que `checkCustomerCashback` e outras funções secundárias não alterem a identidade resolvida.

### 2. Fluxo READY (Bypass de Onboarding)
- Unificar a lógica de detecção de `isReady` para considerar `email`, `auth_user_id` e status de migração/identidade.
- Garantir que `setShowIdentityStep(false)` e `setBookingStep(2)` sejam chamados de forma atômica no `handlePhoneCheck`.
- Corrigir a condição de renderização do `BookingAuthStep` para respeitar o estado `isReady` globalmente.

### 3. Restauração UI Premium
- Atualizar o componente de confirmação em `src/routes/$slug.tsx` para o estilo "Gold/Green" com ícone de check e saudação personalizada.
- Mapear corretamente os steps (1 = Identification, 2 = Service Selection) para evitar números mágicos incorretos.

### 4. Critérios de Aceite
- Telefone 71988939385 deve exibir "Carlos Menezes" (não Luiz).
- Telefone 71996242196 deve pular a etapa de e-mail e ir para serviços.
- Alternar entre os números deve limpar a saudação anterior instantaneamente.
