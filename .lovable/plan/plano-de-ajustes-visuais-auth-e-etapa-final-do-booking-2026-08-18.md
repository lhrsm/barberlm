# Plano de Ajustes Visuais - /auth e Etapa Final do Booking

Este plano detalha as alterações estritamente visuais para padronizar a interface Barbex Gold Premium nas páginas de autenticação e no fluxo final de agendamento.

## 1. Padronização da Página /auth (Administrativo)
*   **Inputs Dark Premium**:
    *   Corrigir o background para `#15171B` (ou equivalente do design system).
    *   Garantir contraste do texto (`#FFFFFF`) e placeholder (`rgba(255,255,255,0.35)`).
    *   Remover a mudança para fundo branco no estado `:focus`.
    *   **Autofill**: Forçar estilos via CSS para evitar que o navegador aplique fundo branco ou amarelo no preenchimento automático.
    *   **Senha**: Limpar redundância de ícones, mantendo apenas [Cadeado] [Input] [Olho], centralizados verticalmente.
    *   **Dimensões**: Padronizar `height` (58-64px desktop, 54-58px mobile) e `border-radius` (16-18px).
*   **Labels e Botões**:
    *   Labels em uppercase, semibold, cinza claro, com espaçamento adequado.
    *   **Botão Principal**: Refinar peso visual, altura de 56px, não ocupando necessariamente 100% da largura no desktop.
    *   **Acesso Cliente**: Transformar o link simples em um CTA secundário (border dourada discreta, fundo transparente).
*   **Layout e Responsividade**:
    *   Reduzir espaços verticais excessivos entre elementos.
    *   Garantir empilhamento correto e margens seguras no mobile/PWA.

## 2. Refinamento da Etapa Final do Booking (Confirmar e Pagar)
*   **Hierarquia de Botões**:
    *   **Desktop**: Botões lado a lado. Primário (Dourado/Preto) e Secundário (Outlined).
    *   **Mobile/PWA**: Botões empilhados (100% width), com gap de ~12px. Ordem: [Confirmar] -> [Alterar].
*   **Botão Voltar**:
    *   Transformar de um botão elevado em uma ação terciária discreta (`← Voltar`) com background transparente.
*   **Espaçamentos**:
    *   Reduzir margens do divisor acima do botão Voltar para aproximar a navegação do conteúdo.
    *   Garantir `safe-area-inset-bottom` para dispositivos móveis.

## Detalhes Técnicos
*   **Arquivos Afetados**: `src/components/auth/AuthForm.tsx`, `src/routes/auth.index.tsx`, `src/components/public/auth/ClientLoginForm.tsx`, `src/routes/$slug.tsx` (seção de checkout) e `src/styles.css` (para regras globais de autofill).
*   **Constraint**: Nenhuma alteração de lógica, RLS ou autenticação será realizada.
