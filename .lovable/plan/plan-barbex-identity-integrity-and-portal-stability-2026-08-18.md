# Plan: Barbex Identity Integrity and Portal Stability

Address two critical issues: customer identity inconsistency in the booking flow and the portal "black screen" when switching tabs.

## 1. Identity Integrity (Problem A)
Fix the booking flow where searching for a phone number returns the wrong customer name (e.g., Luiz instead of Carlos) due to multi-tenant collisions and state leakage.

### Technical Details
- **Instrumentation**: Add `[CUSTOMER_IDENTITY_TRACE]` to `findCustomer` in `src/routes/$slug.tsx` to log raw phone, normalized phone, tenant ID, and state transitions.
- **State Isolation**: Ensure `setCustomerData(null)` and other identity states are cleared immediately when the phone number changes, preventing race conditions or stale data display.
- **Tenant Prioritization**: Refactor `findCustomer` to prioritize the current tenant (`lookupTenantId`). Remove the dangerous fallback that picks the first record from *any* tenant if no local match is found.
- **Identity Recovery Safety**: If a customer exists in another tenant, recover only the name for pre-filling, but ensure the `identity_status` and local shop data (cashback, etc.) are correctly initialized as a new local record if it doesn't exist in the current tenant.

## 2. Portal Stability (Problem B)
Fix the issue where the Customer Portal turns black when switching tabs or after a period of inactivity, persisting even after refresh.

### Technical Details
- **Instrumentation**: 
    - Add `[PORTAL_VISIBILITY_TRACE]` to `src/routes/$slug.portal.tsx` using `visibilitychange` listeners.
    - Add `[PORTAL_BOOT_TRACE]` to track session hydration, profile loading, and data fetching steps.
- **Resilient Rehydration**:
    - Update `useAuth` in `src/hooks/use-auth.ts` to handle `TOKEN_REFRESHED` events explicitly without clearing valid user states.
    - In `CustomerPortalPage`, ensure that if `data` is missing but a session exists, the component triggers a re-fetch instead of showing a blank/black screen.
- **UI Hardening**: Replace `return null` or empty dark backgrounds with explicit "Loading" or "Error" states that include a "Retry" button to re-initialize the portal session without requiring logout.

## 3. Verification
- **Automated Tests**: Use Playwright to verify:
    - Phone A (Louis) returns Louis.
    - Phone B (Carlos) returns Carlos.
    - Alternating numbers clears previous names.
    - Portal remains active after tab switching (simulated via `visibilitychange`).
- **Manual Audit**: Verify logs for `[CUSTOMER_IDENTITY_TRACE]` and `[PORTAL_VISIBILITY_TRACE]` to ensure correct execution flow.
