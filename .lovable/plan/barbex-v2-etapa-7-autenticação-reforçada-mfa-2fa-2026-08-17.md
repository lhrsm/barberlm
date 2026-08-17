# Barbex V2 - Etapa 7: Autenticação Reforçada (MFA/2FA)

Este plano detalha a implementação da Etapa 7, focada em adicionar uma camada extra de segurança para contas privilegiadas através de Multi-Factor Authentication (MFA), utilizando o mecanismo oficial do backend (Supabase Auth).

## 1. Banco de Dados (Supabase)
O Supabase Auth já possui suporte nativo para MFA via TOTP (Time-based One-Time Password). Utilizaremos a API nativa do `supabase.auth.mfa`.
Adicionalmente, criaremos uma tabela para códigos de recuperação (backup codes) que o Supabase não gerencia automaticamente na versão padrão.

- Criar tabela `user_mfa_backup_codes` com hash dos códigos e RLS.
- Registrar novos eventos em `security_activity_logs`.

## 2. Server Functions (`src/lib/auth-security.functions.ts`)
Implementar wrappers para a API de MFA do Supabase e gestão de backup codes:
- `enrollMFA`: Inicia o processo de registro (gera QR Code).
- `verifyMFA`: Valida o primeiro código para ativar o fator.
- `unenrollMFA`: Remove o fator (exigindo reautenticação).
- `generateBackupCodes`: Cria e armazena novos códigos de uso único.
- `getMFAStatus`: Retorna o nível de segurança da sessão atual (AAL - Authenticator Assurance Level).
- `listFactors`: Lista fatores configurados.

## 3. Componentes de UI (`src/components/security/`)
Evoluir a Central de Segurança:
- `MFASettings.tsx`: Nova seção na `SecurityCentral` exibindo status do 2FA.
- `MFASetupWizard.tsx`: Modal passo a passo para configuração (Instalação -> QR Code -> Validação -> Backup Codes).
- `MFACodeVerification.tsx`: Componente de desafio (input de 6 dígitos) para login e step-up.
- `BackupCodesDisplay.tsx`: Exibição segura e download dos códigos de recuperação.

## 4. Fluxo de Autenticação e Guards
- **Step-up Auth**: Ajustar rotas críticas (`/dashboard/usuarios`, `/dashboard/settings/security`) para exigir AAL2 (MFA verificado).
- **Login Redirect**: Se um usuário privilegiado (Super Admin, Owner, Manager) logar via AAL1 mas tiver MFA ativa, redirecionar para o desafio de 2FA.
- **Global Policy**: Criar lógica para identificar se a role do usuário exige MFA obrigatório.

## 5. Notificações (Resend)
- Disparar alertas de segurança para:
  - MFA ativado/desativado.
  - Tentativa de login com falha no segundo fator.
  - Uso de código de recuperação.

## Detalhes Técnicos
- **Supabase MFA**: Utilizar `supabase.auth.mfa.enroll()`, `verify()`, e `unenroll()`.
- **Níveis de Garantia**: Diferenciar entre `aal1` (apenas senha) e `aal2` (senha + MFA) nas políticas de acesso.
- **Segurança**: Nunca armazenar o secret do TOTP no banco de dados local; ele é gerido pelo Supabase Auth. Backup codes serão armazenados com hash robusto (mesma lógica de senhas).
- **Auditoria**: Cada ação de MFA gera um log na tabela `security_activity_logs`.
