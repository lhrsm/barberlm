---
name: scalability-audit-phase-1
description: Diagnóstico de Escalabilidade, Resiliência e Observabilidade - Fase 1
type: feature
---

# Auditoria de Arquitetura - Fase 1

## 1. Riscos e Gargalos Identificados

### Observabilidade
- **Gargalo**: Logs dispersos e inconsistentes (`console.log` no frontend e backend).
- **Risco**: Dificuldade em rastrear falhas multi-tenant sem um `correlation_id` unificado.
- **Solução**: Implementar `BX-Logger` (estruturado) e propagação de `x-correlation-id`.

### Escalabilidade & Banco
- **Gargalo**: Algumas consultas em `automation.ts` realizam múltiplos `select` encadeados sem transação ou cache.
- **Risco**: Concorrência em agendamentos simultâneos e overhead em horários de pico.
- **Solução**: Otimizar RPCs de disponibilidade e implementar locking/idempotência na Fase 2.

### Processamento
- **Gargalo**: Webhooks e automações possuem lógica de deduplicação manual que pode falhar em alta carga.
- **Risco**: Disparos duplicados de mensagens e processamento redundante.
- **Solução**: Padrão Outbox e filas robustas (Fase 3).

## 2. Estratégia de Implementação

- **FASE 1**: Estabelecer a base de observabilidade (Logs estruturados + Correlation ID).
- **FASE 2**: Garantir integridade com Idempotência em pagamentos e agendamentos.
- **FASE 3**: Migrar tarefas pesadas para o novo sistema de Filas/Jobs.
- **FASE 4+**: Otimização fina de infraestrutura e governança.

## 3. Próximos Passos (Imediato)
- Criar `src/lib/observability.ts` para logs estruturados.
- Injetar `correlation_id` no middleware do TanStack Start.
