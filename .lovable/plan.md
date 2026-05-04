Vou implementar um sistema de planos para o BarberSaaS, permitindo diferenciar os recursos disponíveis para contas gratuitas e pagas.

### Definição dos Planos:
1.  **Plano Grátis (Free)**:
    - Limite de 1 Profissional (Barbeiro).
    - Limite de 5 Serviços cadastrados.
    - Limite de 30 Agendamentos por mês.
2.  **Plano Pro**:
    - Recursos ilimitados.

### Alterações Técnicas:
1.  **Banco de Dados**:
    - Adicionar a coluna `plan` na tabela `profiles` com valor padrão 'free'.
2.  **Lógica de Limitação**:
    - Criar um hook `usePlanLimits` para verificar se o usuário atingiu o limite de seu plano atual antes de permitir novas criações.
3.  **Nova Rota `/subscription`**:
    - Uma página para o usuário visualizar seu plano atual, ver os limites e simular o upgrade para o plano Pro.
4.  **Integração na UI**:
    - **Barbeiros**: Bloquear o botão "Novo Barbeiro" se já houver 1 cadastrado no plano Free.
    - **Serviços**: Bloquear o botão "Novo Serviço" se já houver 5 cadastrados no plano Free.
    - **Agenda**: Bloquear novos agendamentos se o limite mensal de 30 for atingido no plano Free.
    - **Dashboard**: Exibir um alerta ou progresso de uso dos limites do plano.

### Experiência do Usuário:
- Mensagens amigáveis explicando o motivo do bloqueio e convidando para o upgrade.
- Visualização clara do consumo de recursos (ex: "Você usou 8/30 agendamentos este mês").

### Próximos Passos:
- Executar migração SQL para adicionar a coluna de plano.
- Implementar a página de Gerenciamento de Assinatura.
- Atualizar as telas de cadastro (Barbeiros, Serviços, Agenda) com a lógica de restrição.