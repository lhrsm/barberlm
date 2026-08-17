# Plano de Implementação - Configuração Resend em Produção

Este plano detalha a ativação da integração com o Resend para envios transacionais, centralizando a lógica no backend e garantindo a segurança das credenciais.

## 1. Infraestrutura e Banco de Dados
- Tabela `email_logs` já criada para auditoria e rastreamento.
- Configuração de segredos no Lovable Cloud: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`.

## 2. Serviço Centralizado (Backend)
- Refatoração de `src/lib/resend.functions.ts` para:
  - Centralizar templates e assuntos.
  - Implementar `sendTransactionalEmail` com suporte a `email_logs`.
  - Manter compatibilidade com `sendVerificationCode`.

## 3. Conexão de Fluxos Existentes
- Atualizar `src/lib/auth-verification.functions.ts` para usar o novo serviço central.
- Atualizar `src/lib/team.functions.ts` (convites) para usar o novo serviço central.
- Garantir que alertas de MFA e segurança utilizem a mesma infraestrutura.

## 4. Interface Administrativa
- Atualizar `src/routes/integrations.tsx` para incluir o status real da integração Resend, incluindo a opção de teste de envio.

## Detalhes Técnicos
- Utilização de `fetch` para chamadas diretas à API do Resend no servidor (createServerFn).
- Templates em HTML com branding "Gold Premium" (Preto, Grafite, Dourado, Branco).
- Webhook seguro em `src/routes/api/public/resend-webhook.ts` para processar eventos de entrega, bounce e complaint.
- Rate limiting aplicado via `src/lib/rate-limit.server.ts` nos fluxos de verificação.

## Critérios de Aceite
- E-mails transacionais enviados com sucesso pelo domínio `notify.barbex.shop`.
- Nenhum segredo exposto no frontend.
- Logs de e-mail registrados corretamente no banco de dados.
- Webhooks atualizando o status dos logs.
