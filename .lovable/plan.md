# Plan: Barbex Booking Identity Overhaul (V2)

Devassa geral no fluxo de identificação do agendamento para garantir uma única fonte de verdade e eliminar inconsistências de estado.

## Proposed Changes

### 1. Identity Engine & State Machine
- Implement a centralized `resolveBookingIdentityState` logic in `src/routes/$slug.tsx`.
- Define a strict `BookingIdentityState` enum/type: `READY`, `NEEDS_NAME`, `NEEDS_EMAIL`, `NEEDS_VERIFICATION`, `NEEDS_PASSWORD`, `NEW_CUSTOMER`.
- Replace independent booleans (`showIdentityStep`, `needsAuthSetup`, etc.) with this single state resolution.

### 2. Strict Customer Resolution
- Refactor `findCustomer` to be the **absolute** source of identity.
- Enforce strict `tenant_id` + `normalized_phone` isolation.
- Remove redundant searches in `checkCustomerCashback` or other hooks; they must receive `customerId` as a prop/argument.

### 3. State Management & Hygiene
- Implement aggressive state clearing of all identity-related values (`customerId`, `name`, `balances`, `credits`) whenever the phone input changes.
- Add `requestId` and `AbortController` to the `findCustomer` effect to prevent race conditions.
- Ensure `customerName` in the UI strictly follows the resolved customer object from the database.

### 4. Step Transition Logic
- Standardize step mappings (1: Identification, 2: Services, 3: Professional, etc.).
- Ensure `READY` customers skip Step 1 identity setup atomically.
- Update `handlePhoneCheck` to act as a transition trigger, not a secondary source of truth.

### 5. UI/UX Refinement
- Restore the "Green Confirmation Card" visual style for identified customers.
- Ensure the card is only shown after resolution is complete and stable.

## Technical Details
- **File**: `src/routes/$slug.tsx` (Major refactoring of identity logic and step transitions).
- **File**: `src/components/public/booking/BookingAuthStep.tsx` (Verify it aligns with the state machine).
- **Trace**: Standardize instrumentation using `[BOOKING_CUSTOMER_STATE]`.

## Verification Plan
1. **Existing Ready Customer (Louis - 71996242196)**:
   - Should see "OLÁ, LOUIS! 👋" in a green card.
   - Click "Continuar" -> Go directly to Services.
   - No email/OTP/password prompt.
2. **Existing Legacy Customer (Carlos - 71988939385)**:
   - Should see "OLÁ, CARLOS! 👋" in a green card.
   - Should NOT ask for name.
   - Should ask for missing onboarding (Email -> OTP -> Password).
   - Subsequent bookings should skip onboarding.
3. **New Customer**:
   - Full onboarding (Name -> Email -> OTP -> Password).
   - Subsequent bookings should skip onboarding.
4. **Resilience**:
   - Verify F5/refresh behavior.
   - Verify phone number switching clears state correctly.
