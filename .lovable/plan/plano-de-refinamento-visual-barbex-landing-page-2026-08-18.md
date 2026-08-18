# Plano de Refinamento Visual — Barbex Landing Page

Refinamento completo da landing page pública para alinhamento com os padrões Gold Premium, focando em proporções, header, logo, espaçamentos e responsividade, sem alterações funcionais.

## Alterações Propostas

### 1. Header e Logo
- **BarbexLogo**: Ajustar definições de tamanho para evitar cortes. Reduzir a altura da logo no estado "lg" para ser proporcional ao header.
- **Navbar**: Reduzir a altura total do header (72-80px). Garantir alinhamento vertical central de todos os elementos (logo, menu, CTA).
- **Responsive Logo**: Definir larguras responsivas específicas (Desktop: 120-150px, Tablet: 110-135px, Mobile: 90-115px).

### 2. Hero Section
- **Espaçamento**: Reduzir paddings excessivos para tornar a primeira dobra mais compacta.
- **Tipografia**: Ajustar `line-height` da headline e `max-width` do subtítulo para melhor legibilidade.
- **CTAs**: Padronizar botões (Primary Gold, Secondary Outline) com mesma altura e radius.

### 3. Seções e Containers
- **Padding Global**: Reduzir espaçamentos verticais entre seções (Desktop: 80-112px, Tablet: 64-80px, Mobile: 48-64px).
- **Largura**: Padronizar containers (`max-width: 1280px`) para evitar áreas vazias laterais excessivas.
- **Cards**: Uniformizar paddings, bordas douradas e sombras em todos os cards da página (Benefícios, Recursos, LGPD).

### 4. Mockups e Imagens
- **SystemMockup**: Refinar escala e sombras do dashboard. Ajustar largura máxima para ~1100px.
- **LandingImage**: Garantir `object-fit: cover` e radius consistente em todas as imagens de barbearia.

### 5. Refinamento de Seções Específicas
- **"Onde a tradição encontra o futuro"**: Compactar a seção, reduzindo o bloco escuro vazio.
- **Financeiro & BI**: Aumentar a presença visual dos gráficos e mockups.
- **FAQ**: Ajustar largura e espaçamentos internos para um visual mais limpo.
- **Footer**: Padronizar logo e alinhamento de colunas.

## Detalhes Técnicos
- Uso de classes utilitárias do Tailwind CSS.
- Preservação total de `framer-motion` para animações leves.
- Ajustes finos no arquivo `src/routes/index.tsx` e componentes `src/components/public/*`.
- Manutenção da paleta de cores (#D4AF37 Gold) e temas escuros.

---
*Nenhuma funcionalidade de banco de dados, autenticação ou lógica de negócio será alterada.*