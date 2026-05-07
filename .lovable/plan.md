The goal is to enhance the Products and Finances pages.

### 1. Products Page (src/routes/products.tsx)
- Add a new tab called "Faturamento" (Billing/Revenue).
- This tab will display a list of product sales, filtered to include only those that are NOT "cancelled" or "refunded".
- The existing "Histórico" tab already exists and shows everything; I will keep it but add the "Faturamento" tab as requested.

### 2. Finances Page (src/routes/finances.tsx)
- Add a new section or tab to group transactions by barber.
- Detail the total received by each barber.
- Calculate and show the commission breakdown:
    - How much the barber receives (based on `commission_rate` if they are not the owner).
    - How much stays with the barbershop.
- I'll need to fetch the `commission_rate` from the `barbers` table to perform these calculations accurately.

### Technical Details:
- I will modify `src/routes/products.tsx` to include the third tab in the `Tabs` component.
- I will modify `src/routes/finances.tsx` to add a "Resumo por Barbeiro" (Summary by Barber) section.
- I will use the `commission_rate` from the `barbers` table. If it's NULL or 0, it implies they might be the owner or have no commission (or I'll assume a default if not set, but the schema has a `commission_rate` field).

I will start by implementing the Products change, then move to Finances.
