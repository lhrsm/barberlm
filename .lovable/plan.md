# Premium Dashboard UI/UX Refinement Plan

This plan outlines the visual and structural improvements for the Barbex administrative dashboard to reach a "Gold Premium" standard, focusing on visual hierarchy, space utilization, and consistent branding.

## User Review Required

> [!IMPORTANT]
> - **Branding priority**: The plan ensures the barbershop's identity is primary, while Barbex acts as a discreet platform signature.
> - **Layout changes**: We are moving to a more spacious grid (up to 4 columns on desktop) and repositioning the Insights panel to be a more useful side/bottom panel.
> - **Greetings**: The "Comandante" term will be replaced by the user's first name, with time-appropriate greetings (Bom dia, Boa tarde, Boa noite).

## Proposed Changes

### 1. Identity & Branding
- **Sidebar Logo**: Refine the barbershop logo display to use `object-fit: contain` on a transparent background, removing any checkerboard/white boxes.
- **Sidebar Identity**: Organize the top section with the logo, business name (semi-bold/bold), and a "Ver página pública" link with improved spacing.
- **Header**: Remove the "BARBEX" text next to the logo; maintain only the Barbex icon, slightly enlarged for better visibility.
- **Platform Signatures**: Replace redundant branding with a single "Powered by BARBEX" signature at the bottom of the sidebar.

### 2. Header & Greeting
- **Personalized Greetings**: Implement logic to use the authenticated user's first name.
- **Greeting Schedule**: 05:00-11:59 (Bom dia), 12:00-17:59 (Boa tarde), 18:00-04:59 (Boa noite).
- **Date Display**: Refine the locale-aware date string (pt-BR) below the greeting.

### 3. Layout & Space Utilization
- **Executive Vision Header**: Reorganize titles and subtitles for better hierarchy.
- **Grid Layout**: Implement a responsive grid for KPIs (4 columns on Large Desktop, 2x2 on Desktop/Tablet, 1 on Mobile).
- **Insights Panel**: Reposition to a 25-30% width sidebar on desktop (or below KPIs on mobile) with a refined design (icon, title, short description, action button).
- **Internal Testing Banner**: Compact the banner into a professional badge/mini-alert.

### 4. Components & Interactivity
- **KPI Cards**: Standardize padding, radius, and typography. Add context to comparison badges (e.g., "vs ontem").
- **Sidebar Items**: Refine active/hover states with subtle gold accents (gold/15 background, gold/50 border).
- **Typography**: Enforce "Gold Premium" typography (stylized for headers, highly legible for data/UI).
- **Color Palette**: Strict adherence to the semantic palette (Gold for highlights, White for primary text, Grey for secondary, Red for alerts, Green for success).

## Technical Details

- **Files to Modify**:
    - `src/components/layout/AppLayout.tsx`: Sidebar branding, navigation groups, Barbex signatures.
    - `src/components/dashboard/ExecutiveSummary.tsx`: Personalized greetings, KPI grid layout, metric card refinement.
    - `src/components/dashboard/views/AdminDashboardView.tsx`: Main layout structure (grid spans).
    - `src/components/dashboard/InsightsPanel.tsx`: Visual layout of insights (list items, actions).
    - `src/components/dashboard/DashboardShell.tsx`: Header/subtitle hierarchy.
    - `src/components/dashboard/MetricCard.tsx`: Badge context, typography, and glow effects.
    - `src/components/subscription/InternalTestingBanner.tsx`: Compact design implementation.
    - `src/components/ui/barbex-logo.tsx`: Support for symbol-only mode.
- **Responsive Logic**: Use Tailwind's grid-cols and flex-col/row modifiers to ensure perfect PWA/Mobile experience.
- **Data Fetching**: No changes to business logic; use existing `tenantProfile` and `auth` data.
