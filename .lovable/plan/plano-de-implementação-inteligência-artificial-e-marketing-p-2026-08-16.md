# Plano de Implementação: Inteligência Artificial e Marketing Preditivo (Fase 1)

Este plano detalha a implementação da sugestão 1: **Inteligência Artificial aplicada ao Marketing**, focando em análise preditiva de faturamento e recomendações automáticas de campanhas.

## O que será construído

### 1. Camada de Inteligência Preditiva (Backend)
- Implementação de uma Engine de Recomendações que analisa:
  - Taxa de Churn (clientes que pararam de vir).
  - Saúde do Estoque (produtos com baixo giro).
  - Oportunidades de Fidelização (clientes próximos de subir de nível).
  - Ociosidade da Agenda.
- Novo Server Function `getPredictiveRecommendations` para processar esses dados com lógica de score de impacto.

### 2. Interface "Marketing AI Advisor" (Frontend)
- Criação do componente `MarketingAIAdvisor.tsx` no Marketing Hub.
- Visual Premium com cards animados, indicadores de "Impacto" e "Score de Confiança".
- Ações rápidas integradas que direcionam o usuário diretamente para a criação da campanha sugerida.

### 3. Integração no Dashboard
- Substituição do "Radar de Oportunidades" estático por recomendações dinâmicas geradas pela IA.
- Adição de micro-interações Gold Premium para destacar as recomendações de "Alto Impacto".

## Detalhes Técnicos

- **Tecnologias:** TanStack Start Server Functions, Lucide Icons, Framer Motion para animações fluidas.
- **Lógica de Score:** Algoritmo ponderado que prioriza ações com maior potencial de ROI imediato.
- **Localização:** `src/components/marketing-hub/MarketingAIAdvisor.tsx` e `src/lib/marketing-ai.functions.ts`.

## Impacto no Usuário
O gestor da barbearia não precisará mais "pensar" no que fazer; a plataforma analisará os dados e dirá: "Você tem 15 clientes inativos, clique aqui para enviar um cupom de 15% e recuperar R$ 1.200,00 em receita estimada".
