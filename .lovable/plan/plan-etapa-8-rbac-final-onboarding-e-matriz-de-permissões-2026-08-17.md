# Plan: ETAPA 8 — RBAC Final, Onboarding e Matriz de Permissões

Este plano visa consolidar a arquitetura de acesso e experiência do usuário (RBAC) do Barbex, integrando roles, permissões, onboarding e segurança em uma estrutura única e escalável.

## 1. Infraestrutura de Banco de Dados (RBAC 2.0)

- Atualizar o enum `app_role` para incluir: `super_admin`, `admin`, `manager`, `receptionist`, `financial`, `cashier`, `professional`, `client`.
- Criar tabela `public.permissions` para listar todas as chaves de permissão (ex: `appointments:view`, `finances:manage`).
- Criar tabela `public.role_permissions` para definir os presets padrão de cada role.
- Criar função `public.has_permission(_user_id uuid, _permission_key text)` (Security Definer) para uso em RLS e queries.
- Habilitar RLS e definir GRANTs em todas as novas tabelas.

## 2. Camada de Lógica de Acesso (Frontend)

- Criar hook `usePermissions` para verificar permissões de forma centralizada no cliente.
- Criar componente `PermissionGuard` para proteger partes da interface e rotas.
- Refatorar `AppLayout` para filtrar o menu lateral dinamicamente com base nas permissões efetivas do usuário.
- Implementar lógica de redirecionamento pós-login baseada na role (ex: Receptionist -> Centro de Comando).

## 3. Onboarding e Experiência do Usuário

- Atualizar o sistema de Onboarding para disparar checklists específicos por role.
- Integrar os Tours Contextuais e a Academia Barbex ao fluxo de boas-vindas.
- Garantir que usuários convidados (Etapa 4) caiam no fluxo de onboarding correto ao aceitar o convite.

## 4. Gestão e Visualização (Dashboard)

- Implementar a "Matriz de Acesso" visual na área de Usuários, mostrando o que cada perfil pode acessar.
- Atualizar a tela de edição de usuário para permitir a troca de roles com invalidação de cache automática.
- Adicionar feedbacks de "Acesso Negado" (Página 403) customizados e amigáveis.

## Detalhes Técnicos

- Utilização de `createServerFn` para manipulação de permissões e roles no servidor.
- Invalidação de queries do TanStack Query (`user-permissions`, `user-role`) ao alterar privilégios.
- Sincronização em tempo real via Supabase Realtime para mudanças de permissão.
- Preservação da compatibilidade com `super_admin` e `impersonation` mode.
