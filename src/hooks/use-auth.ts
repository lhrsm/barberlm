import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

export type UserRole = 'super_admin' | 'admin' | 'tenant_admin' | 'manager' | 'receptionist' | 'financial' | 'cashier' | 'professional' | 'client' | 'reception' | 'finance' | 'barber';

export type IdentityStatus = 'legacy' | 'pending' | 'completed';

interface Profile {
  id: string;
  role: UserRole;
  tenant_id: string | null;
  business_name: string | null;
  full_name: string | null;
  responsible_name: string | null;
  display_name: string | null;
  slug: string | null;
  email: string | null;
  identity_status: IdentityStatus;
}

// Global state shared across useAuth instances.
// IMPORTANT: initial values MUST be identical on server and client to avoid
// hydration mismatches. We start with loading=false / null user, and switch to
// loading=true only AFTER hydration when initializeAuth runs in a useEffect.
let globalUser: User | null = null;
let globalSession: Session | null = null;
let globalProfile: Profile | null = null;
let globalLoading = false;
let initialized = false;
const listeners = new Set<(state: { user: User | null; session: Session | null; profile: Profile | null; loading: boolean }) => void>();

function emit() {
  listeners.forEach((l) =>
    l({ user: globalUser, session: globalSession, profile: globalProfile, loading: globalLoading })
  );
}

function setState(partial: Partial<{ user: User | null; session: Session | null; profile: Profile | null; loading: boolean }>) {
  if ('user' in partial) globalUser = partial.user!;
  if ('session' in partial) globalSession = partial.session!;
  if ('profile' in partial) globalProfile = partial.profile!;
  if ('loading' in partial) globalLoading = partial.loading!;
  emit();
}

async function fetchProfileData(userId: string) {
  console.log('[AUTH_PROFILE_FETCH_START]', { userId, timestamp: Date.now() });
  try {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, tenant_id, business_name, responsible_name, display_name, slug, email, identity_status")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("[useAuth] Error fetching profile:", profileError);
    }

    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (roleError) {
      console.error("[useAuth] Error fetching user role:", roleError);
    }

    const resolvedRole = (roleData?.role as UserRole | null) ?? (profileData?.role as UserRole | null) ?? null;

    if (!profileData && !resolvedRole) {
      console.warn("[useAuth] No auth profile data for user:", userId);
      setState({ profile: null });
      return null;
    }

    const normalizedProfile: Profile = {
      id: profileData?.id ?? userId,
      role: resolvedRole ?? "client",
      tenant_id: profileData?.tenant_id ?? null,
      business_name: profileData?.business_name ?? null,
      full_name: profileData?.responsible_name ?? null,
      responsible_name: profileData?.responsible_name ?? null,
      display_name: profileData?.display_name ?? null,
      slug: profileData?.slug ?? null,
      email: profileData?.email ?? null,
      identity_status: (profileData?.identity_status as IdentityStatus) ?? 'legacy',
    };

    setState({ profile: normalizedProfile });
    return normalizedProfile;
  } catch (err) {
    console.error("[useAuth] fetchProfileData crash:", err);
    return null;
  }
}

function initializeAuth() {
  if (initialized) return;
  initialized = true;

  setState({ loading: true });

  // 1. Subscribe FIRST so we don't miss events during getSession().
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.warn('[AUTH_STATE_TRACE]', event, {
        userId: session?.user?.id,
        sessionExists: !!session,
        timestamp: Date.now()
      });

      if (event === 'SIGNED_OUT') {
        console.warn('[AUTH_SIGNOUT_TRACE]', {
          source: 'onAuthStateChange',
          reason: 'SIGNED_OUT event',
          pathname: typeof window !== 'undefined' ? window.location.pathname : 'server',
          userId: globalUser?.id
        });
        setState({ session: null, user: null, profile: null });
      } else if (event === 'USER_UPDATED' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          console.warn('[AUTH_STATE_TRACE]', 'User session established, fetching profile...');
          setState({
            session,
            user: session.user,
          });
          await fetchProfileData(session.user.id);
        } else if (event !== 'INITIAL_SESSION') {
          // Only clear if it's a real event without a user
          setState({ session: null, user: null, profile: null });
        }
      }
    });

  // Listen for custom profile update events
  if (typeof window !== 'undefined') {
    window.addEventListener('profile-updated', async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await fetchProfileData(session.user.id);
      }
    });
  }


  // 2. Then hydrate the existing session from storage.
  supabase.auth
    .getSession()
    .then(async ({ data: { session } }) => {
      setState({ session, user: session?.user ?? null });
      if (session?.user) {
        await fetchProfileData(session.user.id);
      }
    })
    .catch((err) => console.error("[useAuth] getSession error:", err))
    .finally(() => setState({ loading: false }));
}

export function useAuth() {
  const [state, setLocalState] = useState({
    user: globalUser,
    session: globalSession,
    profile: globalProfile,
    loading: globalLoading,
  });

  useEffect(() => {
    const listener = (next: typeof state) => setLocalState(next);
    listeners.add(listener);

    if (!initialized && typeof window !== 'undefined') {
      initializeAuth();
    } else {
      listener({
        user: globalUser,
        session: globalSession,
        profile: globalProfile,
        loading: globalLoading,
      });
    }

    return () => {
      listeners.delete(listener);
    };
  }, []);

  const logout = async () => {
    console.warn('[AUTH_SIGNOUT_TRACE]', {
      source: 'useAuth.logout',
      pathname: window.location.pathname,
      timestamp: Date.now()
    });
    await supabase.auth.signOut();
    setState({ session: null, user: null, profile: null });
  };

  return {
    user: state.user,
    session: state.session,
    profile: state.profile,
    role: state.profile?.role,
    loading: state.loading,
    logout,
  };
}
