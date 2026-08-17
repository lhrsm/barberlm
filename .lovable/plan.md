# Plan - Barbex V2 - Etapa 7: Autenticação Reforçada (MFA/2FA)

Implementação de segurança de nível Enterprise com suporte a Multi-Fator de Autenticação (MFA), códigos de recuperação e Step-up Auth para proteção de rotas e ações sensíveis.

## User Review Required

> [!IMPORTANT]
> A implementação utiliza o mecanismo oficial do Supabase Auth para MFA (TOTP).

- O Super Admin e papéis privilegiados (Owner, Finance) serão incentivados/obrigados a usar MFA.
- Códigos de recuperação serão gerados durante a ativação para evitar perda de acesso.
- Ações críticas como alteração de e-mail e desativação de MFA exigirão reautenticação forte.

## Technical Details

### 1. Database & Security
- **Backup Codes**: Tabela `user_mfa_backup_codes` com hashing e RLS.
- **Audit Logs**: Registro de eventos `mfa_enabled`, `mfa_disabled`, `recovery_code_used` na tabela `security_activity_logs`.
- **RBAC Enforcement**: Lógica de verificação de papel para determinar obrigatoriedade de MFA.

### 2. Server-Side Logic (`src/lib/`)
- **auth-security.functions.ts**: Funções para `enrollMFA`, `verifyMFA`, `unenrollMFA`, `generateBackupCodes`.
- **auth-mfa.functions.ts**: Auxiliares para desafios de verificação e validação de códigos de recuperação.
- **auth-client.functions.ts**: Atualizado para detectar necessidade de MFA durante o login híbrido.

### 3. Frontend & UI (`src/components/security/`)
- **MFASettings.tsx**: Interface para gerenciar status de MFA e códigos de backup.
- **MFAVerificationGuard.tsx**: Componente reutilizável para bloquear acesso a rotas sensíveis até a verificação do segundo fator.
- **ClientLoginForm.tsx**: Integrado com o fluxo de MFA para clientes e usuários administrativos.

### 4. Routing Guards
- **Settings Security**: Proteção de acesso à página de segurança com `MFAVerificationGuard`.
- **Super Admin**: Planejamento para redirecionamento obrigatório caso o MFA não esteja configurado (Rollout Progressivo).

### 5. Notifications
- Alertas via **Resend** para ativação/desativação de MFA e uso de códigos de recuperação.
