Para implementar a estrutura de pagamentos com Stripe, seguiremos estes passos:

1. **Sincronização do Banco de Dados**: Atualizaremos a tabela `plans` para refletir os novos planos (Starter, Pro e Elite) e seus respectivos preços (19.90, 39.90 e 59.90), alinhando o banco de dados com o que já foi alterado na interface.
2. **Integração com Stripe**: 
    - Recomendo o uso do **Stripe via Lovable**, que é uma integração simplificada onde você não precisa configurar chaves de API manualmente ou lidar com Webhooks complexos.
    - Se você preferir usar sua própria conta Stripe (BYOK), precisaremos configurar as chaves de API e criar Edge Functions para lidar com os eventos de pagamento.
3. **Checkout e Portal**:
    - Substituiremos a lógica atual (que apenas atualiza o banco local) por uma chamada para criar uma sessão de Checkout do Stripe.
    - Adicionaremos um botão para o usuário gerenciar sua assinatura através do Portal do Cliente do Stripe.
4. **Fluxo de Webhook**: Configuraremos a atualização automática do plano do usuário assim que o pagamento for confirmado pelo Stripe.

**Decisão técnica necessária:**
Você deseja usar a integração simplificada do Lovable (mais rápida e sem configuração técnica) ou conectar sua própria conta do Stripe com suas chaves de API?

Para começar, vou primeiro atualizar os planos no banco de dados.

### Detalhes Técnicos
- Migração SQL para atualizar a tabela `plans`.
- Uso do hook `use-payments` ou integração direta com o Stripe via Edge Functions.
- Atualização do componente `SubscriptionComponent` para invocar o checkout.
