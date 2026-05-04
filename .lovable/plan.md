Vou criar uma Landing Page (página de vendas) profissional e moderna para o BarberSaaS, movendo o Dashboard atual para uma rota interna e definindo a rota raiz (`/`) para a página de vendas.

### Objetivos:
- Criar uma página de vendas persuasiva na rota `/`.
- Mover o Dashboard atual para `/dashboard`.
- Adicionar seções essenciais: Hero, Funcionalidades, Preços (Subscription), Depoimentos e FAQ.
- Garantir que a página seja totalmente responsiva e focada em conversão.

### Alterações Técnicas:
1.  **Refatoração de Rotas**:
    - Mover o conteúdo de `src/routes/index.tsx` (Dashboard) para uma nova rota `src/routes/dashboard.tsx`.
    - Criar a nova Landing Page em `src/routes/index.tsx`.
2.  **Novo Componente `LandingLayout`**: Para a página de vendas (sem a sidebar do sistema interno).
3.  **Implementação da Landing Page**:
    - **Seção Hero**: Título impactante, descrição e botão de CTA (Chamada para Ação).
    - **Funcionalidades**: Grid exibindo Agenda, Gestão de Clientes, Financeiro e Multi-tenant.
    - **Preços**: Exibição dos planos Grátis e Pro (baseado no que já implementamos).
    - **Rodapé**: Links úteis e informações de contato.

### Experiência do Usuário:
- Se o usuário já estiver logado, ele será redirecionado automaticamente para o `/dashboard`.
- Design limpo com cores que transmitem confiança e modernidade (focado no público de barbearias).
- CTAs claros para "Começar Agora Gratuitamente".

### Próximos Passos:
- Mover o Dashboard para `src/routes/dashboard.tsx`.
- Implementar a nova Landing Page em `src/routes/index.tsx`.
- Ajustar links de navegação para apontar para as novas rotas.