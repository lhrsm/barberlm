# Plano de Correção: Reset de Senha e UI/UX Auth Premium

Este plano visa resolver o erro de roteamento que impedia a visualização da página de redefinição de senha, além de aprimorar a experiência do usuário com modais premium e inputs refinados.

## Alterações Realizadas

### 1. Arquitetura de Roteamento
- **Layout Fixo**: Refatoração de `src/routes/auth.tsx` para atuar como um layout pai robusto.
- **Nova Rota Index**: Criação de `src/routes/auth.index.tsx` para abrigar a lógica de login administrativo e portal do cliente, permitindo que sub-rotas como `/auth/reset-password` sejam renderizadas no `Outlet`.

### 2. Fluxo de Recuperação (Forgot Password)
- **Modal Premium**: Substituição do alerta simples por um `Dialog` elegante em `AuthForm.tsx` para solicitação de e-mail.
- **Blindagem de Inputs**: Removido o comportamento nativo de validação HTML ("Preencha este campo") em favor de mensagens controladas e estilos consistentemente escuros (Barbex Gold).

### 3. Redefinição de Senha (Reset Password)
- **State Machine**: A página `src/routes/auth.reset-password.tsx` agora utiliza `onAuthStateChange` para detectar o evento `PASSWORD_RECOVERY`, eliminando a necessidade de `setTimeout` frágeis.
- **Visual Enterprise**: Interface Gold Premium com feedback visual de força de senha e estados claros de sucesso/erro/expiração.
- **Segurança**: Garantido que o `updateUser` utilize a sessão de recuperação injetada pelo Supabase.

### 4. Limpeza e Build
- **Remoção de Conflitos**: Exclusão definitiva de arquivos `.js` residuais que causavam erros de compilação no deploy de produção.

## Detalhes Técnicos
- Uso de `framer-motion` para transições suaves entre estados de autenticação.
- Padronização de tokens de cor Gold Premium (`#D4AF37`) e fundos ultra-dark (`#05070d`).
- Suporte a `autofill` customizado via CSS para evitar flashes brancos em campos escuros.

O sistema agora oferece um fluxo contínuo e seguro tanto para administradores quanto para clientes.
