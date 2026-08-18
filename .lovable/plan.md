# Plan - Mobile/PWA "Testar Grátis" Modal Refinement

Refinement of the "Testar Grátis" (RegisterWizard) modal to fix input visibility issues, improve mobile/PWA responsiveness, and standardize visual states (Gold Premium).

## User Review Required

> [!IMPORTANT]
> - The registration logic, database, and auth flows will remain untouched.
> - The fix for "invisible text" involves standardizing input colors during focus and autofill.
> - Mobile layout will switch to a vertical stack for action buttons to prevent horizontal compression.

## Proposed Changes

### UI/UX Refinement

#### Input Styling & Visibility (`src/components/ui/input.tsx`)
- Standardize colors:
    - **Default**: Dark graphite background, white text, light gray placeholder.
    - **Focus**: Pure white background, `#111111` text, `#6B7280` placeholder, gold border.
    - **Autofill**: Force white background and `#111111` text to prevent "white on white" visibility issues.
- Set minimum font-size to `16px` to prevent automatic zoom on iOS Safari.

#### RegisterWizard Modal (`src/components/auth/RegisterWizard.tsx`)
- **Responsiveness**:
    - Expand modal width on mobile (`calc(100vw - 24px)`).
    - Implement `max-height: calc(100dvh - safe-area)` with vertical scroll.
    - Respect `env(safe-area-inset-bottom)` for PWA compatibility.
- **Form Layout**:
    - Standardize spacing between labels and inputs (8px label gap, 20-24px field gap).
    - Update icons to switch colors based on input state (light when dark, dark when white).
- **Actions**:
    - On mobile: Stack "PRÓXIMO PASSO" (primary, 100% width) and "CANCELAR" (secondary/text, 100% width) vertically.
    - On desktop/tablet: Maintain side-by-side layout.
    - Standardize primary button height (52-56px) and radius (12-16px).

### Technical Details
- Use Tailwind's `[&:-webkit-autofill]` utilities for robust autofill styling.
- Apply dynamic CSS classes in `RegisterWizard.tsx` to handle icon and text color inversion during focus.
- Add `pb-[env(safe-area-inset-bottom)]` to the modal footer.

## Verification Plan

### Automated Tests
- Run Playwright script to:
    1. Open "Testar Grátis" modal.
    2. Input text in all fields and verify visibility (focus/blur).
    3. Simulate mobile viewports (375px, 390px, 430px) to verify button stacking and safe area.
    4. Check for horizontal overflow.

### Manual Verification
- Visual inspection of the Gold Premium styling in the preview.
- Verify that clicking "CANCELAR" correctly closes the wizard.
- Verify that "PRÓXIMO PASSO" progresses through the steps.
