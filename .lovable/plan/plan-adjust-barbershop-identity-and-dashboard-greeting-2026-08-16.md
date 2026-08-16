# Plan: Adjust Barbershop Identity and Dashboard Greeting

This plan outlines the changes to display the barbershop's own logo in the sidebar and personalize the dashboard greeting with the user's first name and time-appropriate message.

## User-facing changes

- **Barbershop Logo**: The sidebar will now display the barbershop's custom logo if available, falling back to the Barbex logo. Logos will be displayed in a consistent area using `object-fit: contain` to prevent distortion.
- **Personalized Greeting**: The dashboard greeting "BOM DIA, COMANDANTE" will be replaced with a time-appropriate greeting (Bom dia/Boa tarde/Boa noite) followed by the user's first name (e.g., "BOM DIA, LOUIS").

## Technical details

### 1. Adjust Barbershop Identity in `AppLayout.tsx`
- **Data Source**: The `tenantProfile` from `useTenant` hook already contains `logo_url`.
- **Logic**:
  - Implement a fallback sequence: `tenantProfile.logo_url` -> `tenantProfile.barbershop_logo_url` -> Barbex default logo.
  - Wrap the logo in a fixed-size container with `flex items-center justify-center`.
  - Apply `object-fit: contain` to the `img` tag.
  - Ensure consistent spacing even if the logo is missing.

### 2. Personalize Dashboard Greeting in `ExecutiveSummary.tsx`
- **Data Source**: The `name` prop passed to `ExecutiveSummary` (sourced from `authProfile.full_name` or similar in `dashboard.tsx`).
- **Greeting Logic**:
  - Refactor `greeting()` function to use the correct time ranges:
    - 05:00–11:59: "Bom dia"
    - 12:00–17:59: "Boa tarde"
    - 18:00–04:59: "Boa noite"
  - Extract the first name using `name.split(' ')[0]`.
  - Ensure transformation to uppercase is visual (CSS `uppercase`).
  - Add a loading state check to avoid "UNDEFINED" or "NULL".

### 3. Data Flow in `dashboard.tsx`
- Ensure `authProfile.full_name` or `authUser.user_metadata.full_name` is passed as the `name` prop to `ExecutiveSummary`.
- Add skeleton or conditional rendering for the greeting area while `authLoading` is true.

## Constraints & Considerations
- No changes to business logic, landing page, or permissions.
- Maintain existing multitenancy isolation.
- Ensure responsiveness across all viewports.
- Preservation of original logo aspect ratios.
