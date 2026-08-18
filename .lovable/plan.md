# Barbex — Plano de Ajuste de Fluxo de Cliente e Rota Portal

Este plano visa corrigir o fluxo de reconhecimento de clientes existentes no agendamento e padronizar a rota `/$slug/portal` como a entrada principal do cliente.

## Alterações Propostas

### 1. Correção do Reconhecimento de Identidade no Agendamento (`src/routes/$slug.tsx`)
- Implementar a função `resolveCustomerIdentityState(customer)` para determinar com precisão se um cliente já concluiu sua configuração de identidade.
- Ajustar o fluxo de `handlePhoneCheck` para saltar as etapas de onboarding (e-mail, OTP, senha) quando a identidade for considerada `READY` (possui e-mail, `auth_user_id` e `identity_status` 'completed').
- Garantir que clientes `LEGACY` (sem identidade completa) solicitem apenas as informações faltantes, sem reiniciar o onboarding.
- Manter o `customerId` e `customerName` sincronizados para evitar perda de dados.

### 2. Padronização da Rota `/$slug/portal` (`src/routes/$slug.portal.tsx`)
- Refatorar a rota para agir como um roteador interno baseado no estado de autenticação.
- Se **NÃO autenticado**: Renderizar o componente `ClientLoginForm` diretamente na página (sem redirecionar para `/auth`).
- Se **autenticado**: Renderizar o dashboard do portal restaurado.
- Garantir que o login feito no portal mantenha o usuário na mesma rota após o sucesso.

### 3. Redirecionamento de Logout Dinâmico
- Atualizar a lógica de logout no `useAuth` hook e nos componentes de layout (`AppLayout.tsx`, `PortalNavigation.tsx`, `ProfileTab.tsx`) para capturar o `slug` do tenant atual antes do `signOut`.
- Redirecionar o usuário para a página pública da barbearia (`/$slug`) após o logout, em vez da landing page global.
- Adicionar o botão "Voltar para a barbearia" no Portal do Cliente e nos painéis administrativos.

### 4. Hardening de Sessão e Redirecionamento
- Garantir que a troca de sessão (login/logout) respeite o isolamento multi-tenant.
- Corrigir fallbacks de navegação para evitar loops ou redirecionamentos para `/auth` administrativo quando o contexto é um cliente.

## Detalhes Técnicos
- **Estado de Identidade**: Campos `email`, `auth_user_id`, `identity_status` e `auth_migration_status` da tabela `customers`.
- **Navegação**: Uso do `useNavigate` do TanStack Router com preservação de parâmetros e slug.
- **Isolamento**: Validação de `tenant_id` no login para garantir que o cliente pertence àquela unidade.
