# Plano de Implementação - Barbex Etapa 3

Implementação do sistema de login consolidado para o Portal do Cliente, permitindo acesso via E-mail ou Telefone + Senha, incluindo fluxo de recuperação de acesso e migração de clientes legados.

## 1. Identidade e Autenticação
- **Utilitário de Identificação**: Criar `src/utils/auth-identifier.ts` para normalizar e detectar se a entrada é e-mail ou telefone.
- **Login Híbrido**: Desenvolver `src/lib/auth-client.functions.ts` para lidar com login via e-mail/senha e telefone/senha usando Supabase Auth.
- **Recuperação de Senha**: Implementar fluxo de "Esqueci minha senha" integrado ao Resend para envio de links de reset oficiais do Supabase.

## 2. Interface do Portal do Cliente
- **Nova Tela de Login**: Criar `src/components/public/auth/ClientLoginForm.tsx` com campos de identificador (e-mail/tel) e senha, seguindo o padrão Gold Premium.
- **Fluxo de Migração**: Detectar clientes com `auth_setup_status = 'legacy'` e direcioná-los para a configuração de conta (Etapa 2) antes de permitir o acesso privado.
- **Recuperação de Acesso**: Criar telas para solicitação de reset e definição de nova senha.

## 3. Segurança e Infraestrutura
- **Route Guards**: Atualizar a proteção de rotas do portal para validar a sessão e o vínculo do cliente com o tenant.
- **Rate Limiting**: Aplicar limites de tentativas no login e na recuperação de senha para prevenir ataques de força bruta.
- **Logs de Auditoria**: Registrar eventos de sucesso/falha de login e solicitações de recuperação no `security_audit_logs`.

## Detalhes Técnicos
- Utilização de `supabase.auth.signInWithPassword` para ambos os identificadores (telefone e e-mail).
- Normalização de telefone via `normalizePhoneNumber` (já existente no projeto).
- Resolução de `tenant_id` e `client_id` no pós-login para redirecionamento correto.
- Limpeza rigorosa de cache/queries no logout para evitar vazamento de dados entre sessões no mesmo dispositivo.
