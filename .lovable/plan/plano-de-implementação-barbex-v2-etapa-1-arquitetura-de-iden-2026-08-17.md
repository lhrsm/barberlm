# Plano de Implementação — Barbex V2 Etapa 1: Arquitetura de Identidade e Usuários

Este plano estabelece a base estrutural para a evolução da identidade no Barbex, garantindo que o sistema possa suportar múltiplos papéis, vínculos complexos e migração progressiva sem quebrar as funcionalidades atuais.

## Auditoria e Diagnóstico (Realizado)

*   **Identidade e Auth**: Utiliza Supabase Auth (`auth.users`). Metadados são armazenados em `raw_user_meta_data`.
*   **Profiles**: A tabela `public.profiles` funciona como o cadastro da barbearia (tenant) para `tenant_admin` (onde `id` = `tenant_id`) e como perfil de usuário para outros. Possui campos de branding (logo, cores) e operacionais.
*   **Clientes**: Tabela `public.customers`. Identificados principalmente por `phone` e `tenant_id`. Possuem vínculo opcional com `user_id`.
*   **Profissionais**: Tabela `public.barbers`. Identificados por `phone`. Possuem vínculo obrigatório com `user_id` (que aponta para o tenant no modelo atual).
*   **Roles**: Armazenadas na tabela `public.user_roles` (enum `app_role`) e redundante na coluna `role` da tabela `profiles`.
*   **Membership**: Atualmente implícito via `tenant_id` nas tabelas operacionais ou via `id` na tabela `profiles` para admins. Não há uma tabela de junção explícita para multi-tenant.

## 1. Evolução do Schema (Não Destrutivo)

### public.profiles
Adicionar colunas para suportar a transição de identidade:
*   `identity_status`: Enum (`legacy`, `pending`, `completed`) para rastrear a migração de e-mail/senha.
*   `display_name`: Nome de exibição do usuário (diferente do `business_name`).
*   `avatar_url`: Já existe, garantir uso para o usuário.

### public.customers
*   Garantir que a coluna `user_id` seja a chave para o vínculo com a conta Auth futura.
*   Adicionar `auth_migration_status` para controle individual.

### public.barbers
*   Adicionar `auth_migration_status`.
*   Preparar para que `user_id` aponte para a identidade do barbeiro, não apenas para o tenant.

### Nova Tabela: public.tenant_memberships
Criar estrutura para desvincular o "usuário" da "barbearia", permitindo que um usuário pertença a um ou mais tenants com papéis específicos.
*   `id`, `tenant_id`, `user_id`, `role`, `status`.

## 2. Camada de Segurança e RLS
*   Implementar RLS na nova tabela `tenant_memberships`.
*   Atualizar políticas em `profiles` e `user_roles` para suportar a nova arquitetura de membros.

## 3. Lógica de Identidade (Backend/RPC)
*   Criar funções `security definer` para resolver a identidade atual: `get_current_identity_context()`.
*   Esta função retornará o `user_id`, `tenant_id` ativo, `role` no tenant e status de migração.

## 4. Adaptação do Frontend (Hooks)
*   Refatorar `useAuth` para consumir o contexto de identidade completo.
*   Refatorar `useTenant` para priorizar a resolução via `tenant_memberships`.
*   Garantir que o fallback para `tenant_admin` (onde `id` = `tenant_id`) continue funcionando para não quebrar a base atual.

## Detalhes Técnicos para o Usuário
*   **Compatibilidade**: O login via WhatsApp (legado) continuará funcionando sem alterações no fluxo.
*   **Preparação**: O sistema passará a entender que "Carlos" (Pessoa) é diferente de "Barbearia do Carlos" (Empresa), mesmo que hoje usem o mesmo ID.
*   **Roles**: Novas permissões para Gerente, Recepcionista e Financeiro serão preparadas no banco de dados.
*   **Sem Impacto**: Nenhuma tela nova será criada agora e nenhuma senha será exigida nesta etapa.
