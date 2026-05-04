Vou implementar uma tela de agenda completa com visualização diária e semanal, blocos de horário e diferenciação por profissional.

### Objetivos:
- Implementar visualização por Dia e Semana na rota `/calendar`.
- Adicionar blocos de horário interativos (das 08:00 às 20:00).
- Diferenciar agendamentos por cores baseadas no profissional.
- Criar um botão flutuante para "Novo Agendamento" que abre um diálogo de cadastro.

### Alterações Técnicas:
1. **Novo Componente `CalendarHeader`**: Para navegação entre datas e troca de visualização (Dia/Semana).
2. **Novo Componente `AppointmentCard`**: Para exibir os detalhes do agendamento no grid.
3. **Novo Componente `AppointmentDialog`**: Formulário para criar novos agendamentos vinculando Cliente, Serviço e Profissional.
4. **Refatoração de `src/routes/calendar.tsx`**:
   - Buscar dados de `appointments`, `barbers`, `customers` e `services` do Supabase.
   - Implementar a lógica de renderização do grid de horários.
   - Gerenciar o estado de visualização atual.

### Detalhes da Interface:
- **Mobile-First**: A visualização semanal será adaptada ou simplificada em telas pequenas (scroll horizontal ou foco no dia selecionado).
- **Cores**: Cada profissional terá uma cor atribuída dinamicamente ou pré-definida no sistema para facilitar a identificação visual.
- **Interatividade**: Clique em um horário vazio para abrir o diálogo de novo agendamento pré-preenchido com aquele horário.

### Próximos Passos:
- Criar os componentes de UI necessários para o calendário.
- Integrar com as tabelas existentes no banco de dados.
- Validar a usabilidade em dispositivos móveis.