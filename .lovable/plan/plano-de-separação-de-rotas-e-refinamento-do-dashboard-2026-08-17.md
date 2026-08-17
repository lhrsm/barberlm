# Plano de Separação de Rotas e Refinamento do Dashboard

Este plano visa corrigir a sobreposição de conteúdo nas rotas do dashboard do Barbex, garantindo que `/dashboard`, `/dashboard/centro-de-comando`, `/dashboard/bi` e `/dashboard/assistente` sejam experiências independentes e especializadas, compartilhando apenas o layout e a identidade visual.

## 1. Auditoria e Correção da Arquitetura de Rotas

A causa raiz identificada é que `src/routes/dashboard.tsx` renderiza o conteúdo do dashboard principal diretamente, e como as subrotas são filhas dela no TanStack Router (pelo padrão de nomes), elas acabam herdando ou duplicando o layout/conteúdo se não houver um `<Outlet />` posicionado corretamente e o conteúdo específico movido para uma rota de índice.

### Mudanças Estruturais:
- Refatorar `src/routes/dashboard.tsx` para ser apenas um layout wrapper com `<Outlet />`.
- Criar `src/routes/dashboard.index.tsx` e mover para lá o conteúdo que hoje reside no arquivo pai (Visão Executiva).
- Garantir que as subrotas (`centro-de-comando`, `bi`, `assistente`) rendenrizem seus próprios componentes sem interferência do conteúdo da rota pai.

## 2. Refinamento das Páginas

### /dashboard (Visão Executiva)
- Foco em KPIs consolidados, resumo financeiro e insights gerenciais.
- Reutilização dos componentes `AdminDashboardView`, `ManagerDashboardView` e `FinanceDashboardView` baseados na role do usuário.

### /dashboard/centro-de-comando (Operação em Tempo Real)
- Foco na timeline da agenda, alertas operacionais (atrasos, pagamentos pendentes) e ações rápidas (Novo Agendamento, Walk-in).
- Interface otimizada para quem está "no front" da barbearia.

### /dashboard/bi (BI Executivo)
- Implementação de filtros de período (7 dias, 30 dias, 90 dias, Este ano, Personalizado).
- Seções analíticas: Receita, Clientes, Profissionais, Serviços, Agenda, Retenção.
- Visualização baseada em gráficos (recharts) e tabelas analíticas em vez de apenas cards.

### /dashboard/assistente (Assistente Inteligente)
- Interface conversacional premium.
- Sugestões de perguntas contextuais.
- Camada inteligente sobre os dados reais da operação (sem alucinações).

## 3. Navegação e Estado Ativo
- Atualizar `AppLayout.tsx` para detectar corretamente a rota ativa na sidebar e aplicar o estilo Gold Premium no item selecionado.
- Garantir navegação suave (SPA) entre as visões sem recarregar a página.

## Detalhes Técnicos

### Arquivos a serem modificados/criados:
- `src/routes/dashboard.tsx`: Transformar em layout puro com `<Outlet />`.
- `src/routes/dashboard.index.tsx`: Novo arquivo para a Visão Executiva.
- `src/routes/dashboard.bi.tsx`: Evolução com filtros e novas seções de análise.
- `src/routes/dashboard.assistente.tsx`: Refinamento da interface conversacional.
- `src/components/layout/AppLayout.tsx`: Correção do `active state` na sidebar.

### Invariantes Preservadas:
- Multi-tenant isolado por `tenant_id`.
- RLS do banco de dados.
- Integrações (Z-API, Stripe, etc).
- Regras de negócio de agendamento e financeiro.
