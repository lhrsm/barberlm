The user is confirmed to be logged in as `louisdabahia@gmail.com`, and the database correctly associates this email with profile ID `c54ac1ac-49be-4505-b7a4-d257ed023f08`, which has the "Pró" plan and all business data populated. However, the app is showing a "Grátis" plan and failing to load profile data, even with the manual sync button.

The "Erro ao carregar informações" message in Settings and "Erro ao atualizar plano" in Subscription suggest that either:
1.  **Auth token issues**: The session might be stale or invalid, preventing proper database reads despite RLS being set to "true".
2.  **App state mismatch**: The `useAuth` hook might be returning a different user ID than expected, or `supabase.auth.getUser()` is failing on the client.
3.  **Local Storage/Cache**: There might be a persistent state issue in the browser's local storage for the Supabase session.

I have already verified that the database record is correct and even re-forced an update. Now I will modify the code to be more resilient and provide better feedback to isolate if this is a connection/auth problem.

### Technical Steps
1.  **Enhance `useAuth` hook**: Ensure it provides the most up-to-date user data and handle session refresh if needed.
2.  **Modify `fetchProfile` in `src/routes/settings.tsx`**:
    - Change from `maybeSingle()` to a standard `select().eq()` with a limit to catch if multiple records exist (unlikely but good for debug).
    - Add explicit error logging of the `error` object from Supabase (including message and code).
    - Check if the Supabase URL and Key are being loaded correctly in the browser.
3.  **Modify `SubscriptionComponent` in `src/routes/subscription.tsx`**:
    - Add better error logging for the plan update failure.
4.  **Add a "Logout & Clear" utility**: Since the user mentions things "disappeared" or "changed", a fresh login is the best way to clear session issues.

### Diagnostic Tooling
I will add a temporary "Auth Debug" section to the Settings page that shows the current `user.id` and `auth.role` as seen by the browser, so the user can see if it matches the expected ID (`c54ac1ac-...`).

**Note to user**: The most effective immediate fix is often to log out and log back in to refresh the secure connection to the database.