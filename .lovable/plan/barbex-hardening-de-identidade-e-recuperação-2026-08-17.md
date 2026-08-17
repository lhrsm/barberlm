# Barbex — Hardening de Identidade e Recuperação

Este plano executa a restauração visual e funcional da página de autenticação e do fluxo de recuperação de senha conforme a Lovable Master Instruction — Barbex v2.

## Ajustes Visuais (/auth)

1.  **Logo & Branding**:
    *   Corrigir o container da logo em `src/routes/auth.tsx` para evitar clipping.
    *   Remover o texto "BARBEX" duplicado no cabeçalho.
    *   Ajustar margens e largura responsiva da logo (Desktop: ~200px, Mobile: ~130px).
2.  **Card de Login**:
    *   Ajustar largura do card para 430–480px em desktop.
    *   Padronizar inputs de E-mail e Senha.
3.  **Campo de Senha Premium**:
    *   Implementar input refinado com ícone de cadeado (esquerda) e olho (direita).
    *   Estilizar com fundo grafite claro, bordas douradas no foco e raio de 14px.

## Recuperação de Senha (Parte B)

1.  **Correção do redirectTo**:
    *   Alterar `redirectTo` em `AuthForm.tsx` e `ClientLoginForm.tsx` para `${origin}/auth/reset-password`.
2.  **Refatoração do Server Function**:
    *   Atualizar `requestPasswordReset` em `src/lib/auth-client.functions.ts` para aceitar `identifier` (e-mail ou telefone) e `redirectTo`.
    *   Garantir que o e-mail transacional seja enviado corretamente via Supabase.
3.  **Rota de Reset**:
    *   Aprimorar `src/routes/auth.reset-password.tsx` para lidar corretamente com a sessão de recuperação.
    *   Garantir que a senha seja atualizada apenas para o usuário autenticado via recovery token.
4.  **Feedback & Segurança**:
    *   Adicionar telas de Sucesso (Premium) e Erro (Link Expirado) na página de reset.
    *   Registrar logs técnicos `[RESET_PASSWORD_TRACE]` (sem dados sensíveis).

## Detalhes Técnicos

*   **Arquivos Afetados**:
    *   `src/routes/auth.tsx` (UI)
    *   `src/components/auth/AuthForm.tsx` (redirectTo)
    *   `src/components/public/auth/ClientLoginForm.tsx` (redirectTo)
    *   `src/lib/auth-client.functions.ts` (Logic)
    *   `src/routes/auth.reset-password.tsx` (Flow)
*   **Segurança**: Uso estrito de `supabase.auth.updateUser` dentro do contexto de sessão de recuperação.
