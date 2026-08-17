# Refinamento UI/UX Premium — Fluxo de Agendamento e Modais

Este plano foca exclusivamente na melhoria estética e de usabilidade (UI/UX) das modais de agendamento e autenticação de cliente, seguindo a estética "Gold Premium" do Barbex, garantindo compacidade e responsividade sem alterar a lógica de negócio ou autenticação.

## 🛠️ Alterações Estruturais e Visuais

### 1. Componentes de Autenticação Pública
- **`BookingAuthStep.tsx`**:
    - Padronização de larguras (min-width adaptativo).
    - Refatoração do passo de Verificação para usar 6 células individuais de OTP (apresentação visual via `InputOTP`).
    - Redução de espaços vazios verticais (layout compacto).
    - Melhoria nos estados dos requisitos de senha (visual em tempo real).
    - Padronização de inputs (altura e contraste).
- **`ClientLoginForm.tsx`**:
    - Ajuste de espaçamentos e alinhamentos.
    - Melhoria na responsividade para telas pequenas (375px a 430px).
    - Refinamento do contraste dos inputs e botões.

### 2. Modais de Agendamento (Fluxo Público)
- **`src/routes/$slug.tsx`**:
    - Refatoração do layout da modal principal de agendamento.
    - Implementação de `grid` responsivo para a etapa de **Produtos Adicionais** (3 colunas no desktop, 2 no tablet, 1-2 no mobile).
    - Padronização dos Cards de Produto (altura consistente, object-fit nas imagens, botões alinhados).
    - Ajuste do rodapé na etapa de **Pagamento** (alinhamento dos botões "Voltar", "Alterar" e "Pagar").
    - Implementação de scroll interno na área de conteúdo (header e footer fixos).

### 3. Modais Administrativas
- **`AppointmentModal.tsx`**:
    - Aplicação dos mesmos padrões de compacidade e design "Gold Premium".
    - Revisão de inputs e seletores para evitar "grafite pesado" em fundos claros.

## 🎨 Design System "Gold Premium"
- **Inputs**: Altura entre 52-58px, focus ring dourado sutil, background neutro.
- **Botões**:
    - Primário: Black/Graphite com texto branco, hover dourado.
    - Secundário: Transparente com borda, texto escuro.
- **Modais**: Border radius de 24-32px (desktop) e 20-24px (mobile). Máximo de 85vh de altura.
- **Tipografia**: Títulos em itálico forte (Barbex style), labels de 12-13px.

## 🧪 Validação
- Teste completo do fluxo: E-mail -> OTP -> Senha -> Conclusão.
- Verificação de responsividade em 375px, 768px, 1024px e 1920px.
- Garantia de que nenhuma lógica de backend, validação ou autenticação foi tocada.
- Verificação do comportamento do teclado mobile (scroll adaptativo).
