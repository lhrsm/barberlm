# Plan - Restore Customer Portal Dashboard

Restore the functional Customer Portal interface that existed before the recent focus on gamification, while preserving the new secure authentication and multi-tenancy architecture.

## User Review Required

> [!IMPORTANT]
> The gamification elements (Bronze Level, XP, Achievements) will be moved to a dedicated "Loyalty/Fidelidade" tab. The home screen will prioritize functional data like appointments, credits, and quick actions.

- Does the proposed restoration of the header (Avatar, Name, Shop Name, Greeting, Notifications, Logout) align with your expectation?
- Should the "Clube Barbex Pro" upgrade card be kept as a secondary element on the home screen or moved entirely to the loyalty section?

## Proposed Changes

### 1. Refactor Portal Layout (`src/routes/$slug.portal.tsx`)
- Restore the tabbed navigation as the primary interaction method.
- Update the home screen to prioritize the `NextAppointmentCard` and `PremiumDashboard` (functional cards) over the `LoyaltyTierProgress`.
- Ensure the header uses real user data from the `profiles` and `customers` tables.

### 2. Update Home Tab (`src/components/portal/premium/layout/HomeTab.tsx`)
- Reorder components:
    1. Greeting and Header (handled by parent or top of tab).
    2. `NextAppointmentCard` (Highlight).
    3. `QuickActions` (Agendar novo horário).
    4. `PremiumDashboard` (Cards for Credits, Cashback, etc.).
    5. Recent History summary.
- Move the heavy gamification components (`JourneyBarbex`, `HeroJornada`'s XP focus) to the `Loyalty` tab.

### 3. Navigation Hardening (`src/components/portal/premium/layout/PortalNavigation.tsx`)
- Ensure the navigation includes "Início", "Agendamentos", "Carteira/Financeiro", "Fidelidade", and "Perfil".
- Restore the mobile-friendly bottom navigation or top sticky bar that was functional previously.

### 4. Data Loading Adaptation
- Adapt existing queries in `$slug.portal.tsx` to ensure all fields required by the functional cards (credits, cashback_balance, loyalty_points) are correctly populated from the current schema.

## Technical Details

- **Identity**: Will continue to use `auth.uid()` and the `profiles` table to resolve the `customer_id` and `tenant_id`.
- **Isolation**: RLS remains active; no changes to database policies.
- **Component Reuse**: Reuse `AppointmentsTab.tsx`, `FinancesTab.tsx`, and `ProfileTab.tsx` which are already functional but currently hidden or secondary.
- **Visuals**: Maintain the "Gold Premium" aesthetic but with a functional layout focus.
- **F5 Resilience**: Keep the existing 50ms settling delay in `use-auth.ts` to prevent flash-of-unauthenticated-state.

## Constraints & Verification

- **Verification**: Will test login -> home -> view appointment -> view credits -> profile edit -> logout.
- **No Rollback**: No git checkout/reset will be used to avoid breaking the new auth system.
- **No Schema Changes**: All work will be done in the frontend/presentation layer.
