# Plano de Correção: Loop de Redirecionamento de Autenticação

## Problema
O sistema apresenta um loop de redirecionamento para `/auth?redirect=/lm/portal` após o login. Isso ocorre porque componentes de proteção (Guards) ou lógicas de redirecionamento baseadas em role estão sendo acionados antes que a sessão do Supabase ou o perfil do usuário estejam totalmente hidratados no estado global da aplicação.

## Diagnóstico
1. **Falta de Hydration:** O hook `useAuth` reporta `loading: false` antes de garantir que o perfil foi recuperado, ou os componentes não esperam pelo estado `loading`.
2. **Conflito de Providers:** O `AppLayout` possui lógica de redirecionamento interna que compete com proteções de rota.
3. **Navegação Imperativa:** O uso de `window.location.href` limpa o cache do React e força uma reinicialização completa, reintroduzindo a condição de corrida em cada carregamento.

## Ações de Hardening

### 1. Centralização do Trace [AUTH_REDIRECT_ORIGIN]
Adicionar instrumentação detalhada em todos os pontos identificados como geradores de redirecionamento para capturar o estado exato (Supabase Session vs Router Context).

### 2. Refinamento do useAuth
Garantir que `loading` permaneça `true` até que o perfil seja resolvido ou falte explicitamente.

### 3. Ajuste no AppLayout
Impedir que o `AppLayout` dispare `navigate` ou mude `window.location` enquanto o estado de autenticação ou tenant ainda estiver carregando.

### 4. Correção no ClientLoginForm
Substituir o redirecionamento forçado por uma navegação controlada que aguarda a sincronização completa do estado.

## Verificação Técnica
- Validar se `supabase.auth.getSession()` retorna true no momento do erro.
- Comparar se o Router Context está desalinhado com o estado do SDK.
- Testar persistência com F5 na conta real informada.

Este plano foca na estabilidade da identidade sem alterar fluxos de negócio ou máscaras de UI.
