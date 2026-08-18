# Plano: Auditoria e Reparo Arquitetural Multi-Tenant e Identidade

Este plano visa corrigir as falhas críticas de roteamento, perda de contexto de tenant (slug) e erros de identificação do cliente no portal.

## Problemas Identificados
1. **Redirecionamentos Inconsistentes**: Rotas como `/portal` (global) e `/auth?tab=client` estão sendo usadas indevidamente, perdendo o `$slug` da barbearia.
2. **Erros de Identidade**: Tentativa de acesso a colunas inexistentes (como `auth_user_id`) no banco de dados.
3. **Persistência de Sessão**: Perda de contexto ao recarregar a página (F5) ou trocar de aba.
4. **Recuperação de Senha**: Fluxo de redefinição de senha não redireciona corretamente para o portal do cliente específico do tenant após a conclusão.

## Ações Propostas

### 1. Roteamento e Redirecionamento (Hardening)
- **Eliminar Rotas Globais**: Forçar o redirecionamento de qualquer acesso a `/portal` ou `/auth?tab=client` para a página inicial ou para a barbearia detectada (se possível).
- **Consolidar /$slug/portal**: Tornar esta a única rota oficial para clientes. Atualizar o `ClientLoginForm` para garantir que o redirecionamento pós-login sempre inclua o `$slug`.
- **Botão de Voltar Contextual**: No portal do cliente, o botão de voltar deve levar para a home da barbearia (`/$slug`) e não para a home global do Barbex.

### 2. Correção de Identidade e Banco de Dados
- **Padronização de Colunas**: Substituir todas as referências a `auth_user_id` por `user_id` na tabela `customers`.
- **Filtro de Tenant Estrito**: Todas as consultas ao portal devem incluir `eq("tenant_id", profile.tenant_id)` para evitar vazamento de dados entre barbearias.

### 3. Recuperação de Senha Premium
- **Fluxo Dinâmico**: No final do `reset-password`, buscar o perfil do usuário para determinar se ele é um cliente e qual o seu `slug`. Redirecionar para `/$slug/portal` se for um cliente, ou para `/auth` se for administrativo.

### 4. Interface e UX
- **Landing Page**: Adicionar botões claros "Acessar Portal do Cliente" na `/$slug` para facilitar o acesso direto.
- **Loading States**: Melhorar o feedback visual enquanto a sessão e o perfil são carregados no portal para evitar telas pretas.

## Detalhes Técnicos
- Arquivos afetados: `src/routes/$slug.portal.tsx`, `src/routes/auth.reset-password.tsx`, `src/components/public/auth/ClientLoginForm.tsx`, `src/routes/$slug.tsx`.
- Utilização de `window.location.href` em pontos críticos de login para garantir limpeza de estado de autenticação residual do navegador.
- Implementação de auditoria visual (hidden debug info) para rastrear redirecionamentos em tempo real se necessário.
