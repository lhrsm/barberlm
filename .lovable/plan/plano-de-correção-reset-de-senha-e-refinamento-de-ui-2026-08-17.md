# Plano de Correção: Reset de Senha e Refinamento de UI

Este plano visa corrigir a falha de renderização na rota `/auth/reset-password`, implementar a modal de recuperação de senha e refinar a estilização dos inputs na página de login, seguindo a identidade visual **Gold Premium Barbex**.

## 1. Correção de Roteamento e Renderização
- **Diagnóstico:** A rota `/auth/reset-password` está renderizando o componente de login porque `src/routes/auth.tsx` (rota pai) renderiza `AuthForm` diretamente, bloqueando o `Outlet` necessário para as rotas filhas.
- **Ações:**
  - Mover o conteúdo de `src/routes/auth.tsx` para `src/routes/auth.index.tsx` (ou ajustar o componente pai).
  - Garantir que `src/routes/auth.tsx` atue apenas como layout, contendo o `Outlet` para renderizar tanto o login quanto o reset de senha.
  - Remover redirecionamentos prematuros no `CustomerPortalGuard` ou middlewares que possam estar enviando o usuário de volta para `/auth` durante o processamento do token de recuperação.

## 2. Refinamento Visual dos Inputs (`/auth`)
- **Ações:**
  - Padronizar os inputs de E-mail e Senha no `AuthForm.tsx`.
  - Aplicar fundo escuro (grafite/transparente) com borda dourada no foco, eliminando o fundo cinza claro.
  - Implementar suporte a `autofill` do navegador para manter o tema escuro.
  - Substituir validações nativas do HTML (popups "Preencha este campo") por mensagens de erro controladas abaixo dos campos.

## 3. Implementação da Modal de Recuperação de Senha
- **Ações:**
  - Substituir o disparo direto do e-mail por uma modal premium solicitando o e-mail do usuário.
  - Adicionar estados de "Enviando" e "Sucesso" dentro da modal com feedback claro.
  - Garantir que o `redirectTo` no e-mail aponte corretamente para `/auth/reset-password`.

## 4. Estabilização do Fluxo de Reset (`/auth/reset-password`)
- **Ações:**
  - Remover o `setTimeout` fixo de 1.5s.
  - Utilizar o evento `PASSWORD_RECOVERY` do Supabase para transicionar estados da UI.
  - Implementar estados explícitos: `INITIALIZING`, `READY`, `SUCCESS`, `EXPIRED`.
  - Garantir que `updateUser` seja chamado apenas em sessões de recovery válidas para evitar contaminação de contas.

## Detalhes Técnicos
- **Arquivos Afetados:**
  - `src/routes/auth.tsx` (Roteamento/Layout)
  - `src/routes/auth.reset-password.tsx` (Lógica de Recovery)
  - `src/components/auth/AuthForm.tsx` (Modal de Reset e Estilização de Inputs)
  - `src/lib/auth-client.functions.ts` (Funções de Servidor)
- **Segurança:** Ocultação de tokens em logs e logs forenses mascarados com `[RESET_PASSWORD_TRACE]`.
