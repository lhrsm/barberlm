As requested, I will implement the following changes:

### 1. Business Logic Improvements
- **Auto-Credits for Expired PIX Appointments**: Modify the `checkAutoCancellation` logic to automatically detect if an appointment was paid via PIX but expired without being completed. In such cases, the value will be converted into credits for the customer.
- **Credit Consumption**: Update the appointment completion and creation logic to correctly deduct credits when used.
- **Loyalty System**: 
    - Loyalty points will only be incremented upon appointment completion.
    - Payments made with credits will be explicitly detailed in the history.

### 2. Admin Dashboard (Barber Panel)
- **Status Filter**: Add a filter to allow the administrator to view appointments by status (Scheduled, Completed, Cancelled).
- **Service Completion**: Ensure the "Complete" button is clearly visible and correctly updates the status and financial records (excluding revenue for credit/cashback payments).

### 3. Client Portal
- **Loyalty Display**: Add a "Loyalty" (Fidelidade) field showing progress towards 10 services.
- **Loyalty Reward**: Upon reaching 10 services, a button will appear to request credits equal to the value of the most expensive service in the barbershop.

### 4. Data Corrections
- **Sync Issues**: Investigate and fix the discrepancy where active appointments are showing up even after being "deleted" (likely a status vs deletion mismatch).
- **Financial Sync**: Adjust the financial records for May 6th/7th to ensure they reflect actual completed services and payments.

Technical Details:
- Updates to `src/routes/dashboard.tsx` (Admin filters, completion logic).
- Updates to `src/routes/$slug.portal.tsx` (Loyalty UI, Reward button, auto-credit logic).
- Supabase triggers/functions or edge logic to handle credit conversion for expired PIX payments.
- SQL cleanup for mismatched appointments.
