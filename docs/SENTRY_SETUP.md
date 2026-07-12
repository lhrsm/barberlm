# Sentry — Setup de Monitoramento de Erros

O Barbex já tem uma tela `/admin/errors` para logs internos, mas Sentry cobre:

- Stack traces detalhados de erros de produção (client e SSR)
- Session replay do usuário no momento do erro
- Alertas por email/Slack em picos de erro
- Performance monitoring (LCP, INP, TTFB)

## Passo a passo

### 1. Criar conta e projeto

1. Acesse [sentry.io](https://sentry.io) e crie conta gratuita (plano Developer
   cobre até 5k errors/mês — suficiente para começar).
2. Crie um projeto do tipo **React** — Sentry gera um **DSN** (Data Source Name).
3. Guarde o DSN.

### 2. Guardar DSN como secret

Peça ao agente Lovable:
> "Salve `VITE_SENTRY_DSN` com o valor `<seu-dsn>`"

O agente vai usar `add_secret` para guardar de forma segura. Como o valor
começa com `VITE_`, ele fica disponível no cliente (o DSN é público por
design — Sentry usa políticas server-side para prevenir spam).

### 3. Instalar o SDK

```bash
bun add @sentry/react
```

### 4. Inicializar no cliente

Editar `src/router.tsx` (ou `src/main.tsx`), adicionar no topo:

```typescript
import * as Sentry from "@sentry/react";

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,        // 10% das transações
    replaysSessionSampleRate: 0.0, // 0% em sessões normais
    replaysOnErrorSampleRate: 1.0, // 100% quando dá erro
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
  });
}
```

### 5. Alertas recomendados

No painel Sentry → Alerts:

- **New Issue** → email imediato
- **Error rate > 10/min** → email + Slack
- **Regression** (issue que voltou) → email
- Excluir ruídos: `ResizeObserver loop`, `Non-Error promise rejection captured`.

### 6. Depois de 30 dias

Reavalie:
- Se ficar acima de 5k errors/mês → upgrade para Team ($26/mês)
- Se ruído dominar → ajustar `beforeSend` para filtrar
