# Sua Jornada Barbex — Portal do Cliente

Substituir o topo atual do Portal por uma experiência premium baseada 100% em dados reais já existentes, componentizada e pronta para receber IA no futuro.

## Escopo (frontend + presentation apenas)

Sem novas tabelas, sem novas regras de negócio, sem alterações no banco. Usar apenas os dados já carregados em `src/routes/$slug.portal.tsx` (appointments, sales, customerData, mySubscription, loyaltyRewards, barbers, services, products, coupons).

## Novo layout do topo (aba Dashboard)

Ordem visual, substituindo `PremiumHeroCard` + blocos atuais:

1. **HeroJornada** — saudação dinâmica (Bom dia/tarde/noite + nome), "Bem-vindo à {barbearia}", título "Sua Jornada Barbex", botão *Novo Agendamento*, foto do cliente e badges rápidas (cliente desde, atendimentos, investido, economia, cashback, créditos, próxima renovação, próximo atendimento).
2. **AssistenteBarbex** — 3–4 frases geradas por regras a partir do histórico (cadência de corte/barba, economia, favorito). Fonte pronta para trocar por IA.
3. **JornadaCards** — recomendações contextuais (só aparecem quando fazem sentido): corte vencido, barba vencida, cashback, créditos, próximo nível, plano cobre, barbeiro favorito com horário, aniversário, cupom.
4. **QuickActions** — "O que deseja fazer hoje?" com botões: Agendar, Comprar produtos, Cashback, Créditos, Renovar, Alterar plano, Promoções.
5. **TimelineBarbex** — linha do tempo com primeiro atendimento, último, hoje, próximo, próxima renovação, próxima recompensa, último cashback/crédito, última compra.
6. **GamificacaoBarbex** — níveis Bronze/Prata/Ouro/Diamante/Black, badge, barra, benefícios, próxima categoria.
7. **ProfissionalFavorito** — detectado automaticamente (mais frequente), com foto/nome/estatísticas e CTA.
8. **EstatisticasPessoais** — grid compacto (atendimentos, investido, economia assinatura, economia cashback, produtos, tempo como cliente, barbeiro favorito, serviço favorito).
9. **AreaAssinantePremium** — só se `mySubscription` existir: plano, uso restante, serviços inclusos, economia, renovação, benefícios.
10. **ProdutosRecomendados** — baseado em `sales` e categorias já compradas, com selo "Recomendado para você".

Componentes existentes (`JourneyBarbex`, `JourneyInsights`, `PremiumDashboard`, `LoyaltyTierProgress`) permanecem disponíveis nas abas atuais; o topo do dashboard passa a usar os novos componentes acima.

## Arquitetura

Nova pasta `src/components/portal/premium/journey/`:

```text
journey/
  HeroJornada.tsx
  AssistenteBarbex.tsx
  JornadaCards.tsx           (usa recommendationEngine.ts existente)
  QuickActions.tsx
  TimelineBarbex.tsx
  GamificacaoBarbex.tsx
  ProfissionalFavorito.tsx
  EstatisticasPessoais.tsx
  AreaAssinantePremium.tsx
  ProdutosRecomendados.tsx
  SuaJornadaBarbex.tsx       (orquestrador — recebe todos os dados, faz cálculos memoizados uma vez, renderiza os cards acima)
  useJornadaData.ts          (hook puro: recebe dados brutos, devolve derivados memoizados — cadências, favoritos, agregados, tier)
```

- `useJornadaData` centraliza cálculos (favoritos, cadência média, economia, tier, próximas recomendações) para evitar recomputação por card.
- `recommendationEngine.ts` já existente é estendido com regras faltantes (aniversário, plano cobre, barbeiro favorito com horário) e passa a alimentar `JornadaCards`.
- Estrutura preparada para IA: `AssistenteBarbex` e `recommendationEngine` recebem `EngineInput` — no futuro basta trocar a implementação por uma chamada a `createServerFn` com Lovable AI, sem tocar na UI.

## Integração no portal

Em `src/routes/$slug.portal.tsx`, na aba dashboard, substituir o bloco inicial (Hero + Insights + Journey duplicados) por `<SuaJornadaBarbex ...props />`. Manter `NextAppointmentCard`, `MemberDashboard`, `PremiumDashboard`, `SubscriberPanel` nas posições atuais logo abaixo.

Eventos dos CTAs continuam via `window.dispatchEvent(new CustomEvent(...))` (já consumidos pelo portal): `OPEN_BOOKING_MODAL`, `OPEN_LOYALTY_MODAL`, `OPEN_PLAN_DETAILS_MODAL`, `OPEN_SUBSCRIBE_MODAL`, `OPEN_PRODUCTS_TAB`, `OPEN_REVIEW_MODAL`.

## Identidade visual

Preto fosco `#0A0A0A`, dourado `#D4AF37`/`#F5D061`, grafite `#1A1A1A`, branco, verde (`emerald-400`) só para positivos. Glassmorphism (`bg-white/[0.03] backdrop-blur-xl`), bordas douradas sutis, glow discreto, micro animações Framer Motion (fade + translateY), skeleton loading, hover elegante (`-translate-y-0.5` + shadow dourada).

## Performance

- Dados já vêm do portal em uma única passada; nenhum fetch novo.
- `useJornadaData` usa `useMemo` para todos os agregados.
- Cards fora do viewport inicial usam `motion` com `whileInView` para animar sob demanda.

## Fora de escopo agora (deixados para próxima iteração)

Galeria antes/depois, Plano de Cuidados detalhado, Lista de Desejos e Programa de Indicação completo — dependem de novas tabelas/uploads. Vou colocar placeholders visuais somente quando os dados já existirem; caso contrário, os cards não são renderizados (regra "só aparecem quando fazem sentido").
