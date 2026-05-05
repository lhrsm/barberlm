I will implement a feature to manage barber working hours, including:

1.  **Database Update**:
    *   Add a `working_hours` JSONB column to the `barbers` table. This will store the availability for each day of the week (e.g., `{"monday": {"enabled": true, "start": "08:00", "end": "14:00"}, ...}`).

2.  **UI Updates in `src/routes/barbers.tsx`**:
    *   Add a "Working Hours" section to both "Add" and "Edit" barber dialogs.
    *   Implement a user-friendly interface to toggle days and select start/end times.
    *   Update the `handleAddBarber` and `handleUpdateBarber` functions to persist this data.

3.  **Booking System Integration**:
    *   Update the logic that generates available time slots to respect these individual barber schedules. I'll need to find where time slots are currently generated (likely a utility or hook).

Technical details:
- Table: `public.barbers`
- Column: `working_hours` (JSONB, default: empty object or standard schedule)
- Default schedule: Monday-Friday, 09:00-19:00, Saturday 09:00-14:00.
