# Plan - Dashboard Header and Greeting Refinement

Refine the dashboard header and user greeting to match the "Gold Premium" standard, moving the salutation to the header and personalizing it for the authenticated user.

## Proposed Changes

### UI/UX Refinement
- **AppLayout.tsx**:
    - Increase Barbex logo size in the desktop header (height 48px-64px, `object-fit: contain`).
    - Implement a new identity block in the header containing:
        - Logo.
        - Time-based greeting (BOM DIA, BOA TARDE, BOA NOITE) + First Name (in Gold color).
        - Current date (e.g., "domingo, 16 de agosto").
    - Ensure vertical alignment and responsive behavior (side-by-side on desktop, stackable on mobile if needed).
    - Align notifications (Bell icon) to the right.

### Business Logic & Personalization
- **Greeting Logic**:
    - Implement the time-based greeting in `AppLayout.tsx` (using `America/Sao_Paulo` as default timezone).
    - Extract the user's first name from the authenticated profile/metadata, following the requested priority:
        1. `profile.full_name`
        2. `profile.name`
        3. `display_name`
        4. `user_metadata.full_name`
        5. `user_metadata.name`
        6. Email prefix (before `@`).
    - Always display in uppercase (visual only).
    - Remove all instances of hardcoded "COMANDANTE".
    - Handle loading states with Skeletons or simple "BOM DIA".

### Component Cleanup
- **ExecutiveSummary.tsx**:
    - Remove the redundant greeting block (H1 + Date) since it is moved to the header.
- **AdminDashboardView.tsx** / **ManagerDashboardView.tsx**:
    - Ensure clean start of content directly with KPIs/Filters.

## Technical Details

- **Timezone**: Use `Intl.DateTimeFormat` or a custom helper to handle `America/Sao_Paulo`.
- **Name Extraction**: Create a utility `getFirstName(name)` that splits by space and takes the first part.
- **Styling**: Use Tailwind CSS with existing design tokens (`text-gold`, `bg-[#0b0f17]`, etc.).
- **Logo Size**: Adjust `BarbexLogo` size prop or apply custom classes in the header container.
