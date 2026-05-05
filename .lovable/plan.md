The user wants a button in the "Geral" (General) tab of the settings page to manually force a re-synchronization of their business data from the database. This is to ensure that their information (business name, URL/slug, address, and Google Maps embed) is up-to-date without needing to refresh the whole page.

I will implement this by:
1.  Adding a new state `isSyncing` in the `SettingsComponent` within `src/routes/settings.tsx` to handle the loading state of the manual synchronization.
2.  Creating a `handleForceSync` function that calls the existing `fetchProfile` function and provides feedback via a toast notification.
3.  Modifying the `CardHeader` of the "Informações do Negócio" section in the "Geral" tab to include a "Sincronizar" button with a refresh icon.
4.  Ensuring the button has an animation when syncing to provide visual feedback.

### Technical Details
- **File**: `src/routes/settings.tsx`
- **State**: `const [isSyncing, setIsSyncing] = useState(false);`
- **Icon**: Use the existing `RefreshCw` from `lucide-react`.
- **Logic**: The button will trigger `fetchProfile`, which already fetches the user profile from Supabase and updates the local `formData` state.

No other components or database migrations are required for this specific request.