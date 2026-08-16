# Plan: Fix Dashboard Identity and Greeting

The user reported two issues in the administrative dashboard:
1. The barbershop logo is not round (rounded).
2. The user greeting is showing an email-prefix-style name (e.g., "louis.menezes" instead of "LOUIS") and the domain was stripped incorrectly or the name resolution failed to pick the correct field.

## Changes

### 1. Rounded Logo in UI
- Update `AppLayout.tsx` to apply `rounded-full` to the barbershop logo containers (Sidebar and Mobile Header).
- Ensure the image itself uses `object-cover` and `rounded-full` to maintain a perfect circle.

### 2. Improved Greeting Logic
- Refine `getDisplayName` in `AppLayout.tsx` to better handle names.
- Priority: `authProfile.first_name` (if exists) > `full_name` first word > `display_name` > email fallback.
- Fix the logic that splits the email to ensure it doesn't just return a messy string.

### 3. Synchronization
- Ensure `ExecutiveSummary.tsx` (if it also shows names, though it seems clean now) is consistent.

## Technical Details
- CSS classes: Change `rounded-2xl` or no rounding to `rounded-full` on logo wrappers.
- Logic: Use a more robust `getDisplayName` helper that checks `authProfile?.first_name` first, as the `profiles` table usually has this field in Supabase-integrated Barbex projects.
