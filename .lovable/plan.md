Vou transformar o Dashboard atual em um painel de métricas dinâmico que separa dados por períodos (Diário e Mensal), proporcionando uma visão mais clara do desempenho da barbearia.

### Melhorias no Dashboard:
1.  **Novas Métricas**:
    - **Faturamento Diário e Mensal**: Calculado com base nas transações do período.
    - **Agendamentos**: Total do dia e total do mês.
    - **Ticket Médio**: Receita total dividida pelo número de atendimentos concluídos.
2.  **Visualização**:
    - Adicionar um seletor de período (Hoje / Este Mês) para as métricas principais.
    - Implementar um gráfico simples (utilizando componentes de UI existentes ou CSS) para mostrar a evolução dos atendimentos nos últimos dias.
3.  **Métricas de Conversão**:
    - Clientes novos no mês vs. recorrentes.
4.  **Ações Rápidas**:
    - Manter e organizar os botões de atalho para as principais funções do sistema.

### Alterações Técnicas:
- **Lógica de Filtro**: Implementar filtros de data (startOfDay, startOfMonth) nas queries do Supabase em `src/routes/index.tsx`.
- **Estado do Painel**: Adicionar estados para as métricas diárias e mensais de forma independente.
- **Interface**: Utilizar `Tabs` para alternar entre a visão diária e mensal nas métricas de performance.

### Experiência do Usuário:
- Cards com indicadores de crescimento (ex: "+10% em relação ao mês anterior" se houver dados).
- Layout responsivo que prioriza as métricas mais importantes em telas pequenas.