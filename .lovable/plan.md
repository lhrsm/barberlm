# Auditoria e Reparo Arquitetural Multi-Tenant e Identidade

Este plano visa corrigir as falhas críticas de roteamento, perda de slug e inconsistência de dados no Portal do Cliente e fluxos de autenticação, seguindo a Lovable Master Instruction — Barbex v2.

## Auditoria de Dados (Louis & Carlos)

- **Louis (louishenrique19@hotmail.com)**: Identificamos dois registros de customer. Um legado (vinculado a um `tenant_id` que parece ser o antigo ID de proprietário) e um novo (vinculado ao `tenant_id` da LM, `c54ac1ac-49be-4505-b7a4-d257ed023f08`). O vínculo Auth oficial é via `user_id` em `customers`.
- **Carlos Menezes**: Possui um registro legado com `phone` 5571988939385.
- **Inconsistência**: O erro "column customers.auth_user_id does not exist" confirma que o frontend está tentando usar uma coluna inexistente. A coluna correta é `user_id`.

## Ações Técnicas

### 1. Correção do Schema e Consultas (Identity Fix)
- Remover todas as referências a `auth_user_id` no codebase (especialmente em `src/routes/$slug.portal.tsx` e `src/lib/auth-verification.functions.ts`).
- Padronizar o uso de `customers.user_id` como o vínculo único com `auth.users.id`.
- Corrigir a query no Portal do Cliente para filtrar estritamente por `user_id` e `tenant_id`.

### 2. Blindagem de Roteamento (Slug Preservation)
- **Portal URL**: Garantir que `/$slug/portal` seja a única porta de entrada para clientes.
- **Auth Redirects**: Modificar o `ClientLoginForm` e o fluxo de logout para NUNCA redirecionar para `/portal` (global) ou `/auth`. Sempre usar `/${tenantSlug}/portal` ou `/${tenantSlug}`.
- **Lost Slug Recovery**: Se um cliente cair em `/portal` ou `/auth` sem contexto, implementar lógica para recuperar o slug do tenant a partir da sessão ativa (se houver membership) ou orientar o usuário a voltar para a página da barbearia.

### 3. Remoção de Fluxos Legados
- Desativar a aba "Cliente" em `/auth` ou torná-la um redirecionador para o slug contextual (se detectado).
- Adicionar botão explícito "PORTAL DO CLIENTE" na landing page da barbearia (`/$slug`).
- Garantir que após o agendamento o cliente seja levado para `/$slug/portal`.

### 4. Implementação de Testes de Validação
- Validar acesso anônimo em `/lm/portal`.
- Validar login do Louis e persistência do slug `lm`.
- Validar F5 e navegação em novas abas sem perda de contexto.

## Detalhes Técnicos para o Usuário
- Não criaremos a coluna `auth_user_id`. Corrigiremos o sistema para usar `user_id`, que já existe.
- A URL `barbex.shop/portal` não será mais utilizada para clientes.
- O redirecionamento após o login será forçado via `window.location.href` para garantir que o estado do TanStack Router seja limpo e o novo contexto carregado corretamente.
