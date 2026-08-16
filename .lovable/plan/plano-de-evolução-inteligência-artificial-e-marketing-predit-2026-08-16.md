# Plano de Evolução: Inteligência Artificial e Marketing Preditivo (Fases 2 e 3)

Este plano detalha a evolução da Engine de IA do Barbex, focando em análise de faturamento em tempo real e automação de disparos inteligentes.

## O que será construído

### 1. Análise Preditiva de Faturamento (Fase 2)
- Evolução da Engine para calcular o **Potencial de Receita Recuperável**.
- Implementação de métricas de saúde financeira no `MarketingAIAdvisor.tsx`.
- Visualização de "Ganhos Estimados" para cada recomendação de IA.

### 2. Automação de Disparos Inteligentes (Fase 3)
- Integração da IA com o motor de disparos via WhatsApp (Z-API).
- Sugestão de "Melhor Horário para Disparo" baseado no histórico do cliente.
- Sistema de A/B Testing automático sugerido pela IA.

### 3. Refinamento de UI "Elite Gold"
- Adição de gráficos de tendência preditiva no Hub de Marketing.
- Efeitos de brilho e glassmorphism avançados nos cards de recomendação.
- Feedback visual de "IA Processando" com animações sincronizadas.

## Detalhes Técnicos

- **Novos Endpoints:** `getRevenueProjections` e `optimizeCampaignTiming`.
- **Database:** Novas colunas em `campaign_logs` para rastrear conversão atribuída por IA.
- **Frontend:** Uso intensivo de `recharts` integrado com o tema Dark Gold.

## Impacto no Usuário
O Barbex deixará de ser apenas uma ferramenta de gestão para se tornar um **Chief Growth Officer (CGO) Virtual**, prevendo quedas de faturamento e agindo proativamente para evitá-las.
