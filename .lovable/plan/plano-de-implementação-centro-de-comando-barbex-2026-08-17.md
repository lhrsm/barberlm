# Plano de Implementação: Centro de Comando Barbex

O Centro de Comando será o cockpit operacional em tempo real da barbearia, consolidando dados de agenda, equipe, financeiro e alertas em uma interface premium "Gold Premium".

## Fases de Implementação

### 1. Infraestrutura e Roteamento
- Configurar a rota `/dashboard/centro-de-comando` em `src/routes/dashboard.centro-de-comando.tsx`.
- Garantir a integração com o layout global `AppLayout`.

### 2. Camada de Dados e Estado Operacional
- Reutilizar `useTenant` e `useAuth` para multi-tenancy e permissões.
- Criar hooks de consulta (ou reutilizar existentes) para buscar:
  - Atendimentos do dia (filtros por data).
  - Status dos profissionais.
  - Alertas operacionais (atrasos, pagamentos pendentes, estoque).
  - KPIs operacionais (atendimentos, faturamento, pendências).
- Implementar Supabase Realtime para atualizações instantâneas de agendamentos e status.

### 3. Interface Visual (UI/UX Gold Premium)
- **Cabeçalho:** Título "Centro de Comando", subtítulo, indicador de realtime e seletor de data.
- **Resumo (KPIs):** Cards compactos com dados reais de atendimentos, faturamento e pendências.
- **Agenda em Tempo Real:** Timeline vertical/lista dos atendimentos do dia com status e ações rápidas.
- **Destaque "Agora" & "Próximos":** Foco no operacional imediato.
- **Equipe:** Status atual de cada barbeiro (Livre, Em atendimento, Pausa).
- **Alertas (Atenção Necessária):** Lista de situações críticas com severidade.
- **Financeiro:** Resumo de pagamentos do dia e pendências.

### 4. Ações e Fluxos Operacionais
- Integrar botões de ação (Check-in, Iniciar, Concluir, Pagar) com as modais e RPCs existentes (`AppointmentModal`, `WalkinModal`, fluxos financeiros).
- Garantir que todas as ações registrem auditoria conforme o padrão do sistema.

### 5. Otimização e Mobile
- Implementar skeletons para carregamento.
- Ajustar responsividade para uso em tablets e smartphones (PWA).

## Detalhes Técnicos

- **Componentes Reutilizados:** `AppLayout`, `AppointmentModal`, `WalkinModal`, `BarbexLogo`, hooks de autenticação e tenant.
- **Realtime:** Subscrição na tabela `appointments` filtrada por `tenant_id`.
- **Performance:** Uso de query keys compartilhadas para evitar requisições redundantes.
- **Estilo:** Tailwind CSS com variáveis de tema (Gold, Zinc, Dark).

## Segurança (LGPD & RLS)
- Filtragem rigorosa por `tenant_id` via RLS.
- Permission gates para ocultar dados financeiros de profissionais sem permissão de gerente/admin.
