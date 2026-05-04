Vou reformular o diálogo de agendamento em `src/routes/calendar.tsx` para um fluxo de 4 passos, adicionando uma verificação de conflitos de horário antes de salvar.

### Passos do Fluxo:
1.  **Profissional e Serviço**: Escolher quem vai atender e o que será feito.
2.  **Data e Horário**: Selecionar o momento do atendimento (com feedback visual se estiver ocupado).
3.  **Cliente**: Identificar quem será atendido.
4.  **Resumo**: Revisar os dados antes de confirmar.

### Validação de Conflitos:
- Antes de permitir o avanço para o Passo 3 ou a finalização, o sistema consultará o Supabase para verificar se o profissional escolhido já possui um agendamento que se sobreponha ao horário selecionado (considerando a duração do serviço).

### Alterações Técnicas:
- **Estado de Step**: Adicionar `currentStep` ao estado do componente.
- **Lógica de Conflito**: Criar uma função `checkConflict` que valida a disponibilidade no banco de dados.
- **UI de Passos**: Substituir o formulário único por uma estrutura condicional baseada no `currentStep`.
- **Feedback Visual**: Exibir avisos claros caso o horário esteja ocupado.

### Experiência do Usuário:
- Navegação "Voltar" e "Próximo" entre os passos.
- Barra de progresso ou indicadores visuais do passo atual.
- Limpeza dos campos ao fechar o diálogo ou finalizar com sucesso.