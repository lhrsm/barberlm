I will refactor the landing page to create a premium, modern, and high-converting SaaS experience for BarberLM.

### Visual Strategy
- **Dark Mode Aesthetic**: The page will use a sophisticated dark theme by default (using `dark` class) to convey a premium "tech startup" feel.
- **Modern UI Elements**: I will implement soft gradients, glow effects (using CSS shadows and radial gradients), and glassmorphism (backdrop filters).
- **Responsive Layout**: Ensuring perfect display on all screen sizes, with optimized spacing for mobile.

### Sections Implementation
1.  **Header**: Premium glassmorphism navigation with a clear CTA.
2.  **Hero Section**: 
    - High-impact headline and subheadline.
    - Dual CTAs: "Começar agora" (Primary) and "Agendar demonstração" (Secondary).
    - Large system mockup with subtle floating animations and a glow background.
3.  **Metrics Bar**: Premium layout for social proof showing "+1.200 agendamentos", "+R$80 mil gerenciados", etc.
4.  **Problem Section**: "Você ainda perde clientes por..." highlighting pain points like disorganization and manual confirmations.
5.  **Solution Section**: Modern grid of cards with glassmorphism and custom icons for key features (Agenda, WhatsApp Auto, Cashback, etc.).
6.  **Pricing Section**: 
    - 3-tier paid-only pricing: Starter (R$19.90), Pro (R$39.90 - Highlighted), Elite (R$59.90).
    - Premium visuals for the "Pro" plan with a "MAIS POPULAR" badge and subtle glow.
    - Explicit mention of "Sem taxa por agendamento".
7.  **FAQ Section**: Modern accordion-style FAQ with smooth transitions.
8.  **Final CTA**: High-conversion footer section to drive sign-ups.

### Technical Details
- Use `lucide-react` for modern iconography.
- Implement custom CSS animations in `src/styles.css` for floating effects and smooth fades.
- Leverage Tailwind 4 features for the glassmorphism and gradient effects.
- Clean up the existing `src/routes/index.tsx` to remove the outdated sections and replace them with the new components.
