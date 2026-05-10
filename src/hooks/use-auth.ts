import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

export type UserRole = 'super_admin' | 'admin' | 'tenant_admin' | 'barber' | 'client';

interface Profile {
  id: string;
  role: UserRole;
  tenant_id: string | null;
  business_name: string | null;
  slug: string | null;
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
  try {
    const [{ data: profileData, error: profileError }, { data: roleData, error: roleError }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, role, tenant_id, business_name, slug")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (profileError) {
      console.error("[useAuth] Error fetching profile:", profileError);
    }

    if (roleError) {
      console.error("[useAuth] Error fetching user role:", roleError);
    }

    const resolvedRole = (roleData?.role as UserRole | null) ?? (profileData?.role as UserRole | null) ?? null;

    if (!profileData && !resolvedRole) {
      // Profile is created automatically by the handle_new_user trigger.
      // If for any reason it's still missing, we don't try to insert from
      // the client (RLS / role triggers can block it). Just leave profile null.
      console.warn("[useAuth] No auth profile data for user:", userId);
      setState({ profile: null });
      return null;
    }

    const normalizedProfile: Profile = {
      id: profileData?.id ?? userId,
      role: resolvedRole ?? "client",
      tenant_id: profileData?.tenant_id ?? null,
      business_name: profileData?.business_name ?? null,
      slug: profileData?.slug ?? null,
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
  supabase.auth.onAuthStateChange((event, session) => {
    setState({
      session,
      user: session?.user ?? null,
    });

    if (session?.user) {
      // Fire & forget — don't await inside the callback.
      fetchProfileData(session.user.id);
    } else {
      setState({ profile: null });
    }
  });

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
  // Initial state is the same on server and on the client's first render →
  // no hydration mismatch. We kick off initializeAuth() in useEffect so the
  // global state only flips to loading=true AFTER hydration is complete.
  const [state, setState] = useState({
    user: globalUser,
    session: globalSession,
    profile: globalProfile,
    loading: globalLoading,
  });

  useEffect(() => {
    const listener = (next: typeof state) => setState(next);
    listeners.add(listener);

    if (!initialized && typeof window !== 'undefined') {
      initializeAuth();
    } else {
      // Sync once in case state already moved on.
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

  return {
    user: state.user,
    session: state.session,
    profile: state.profile,
    role: state.profile?.role,
    loading: state.loading,
  };
}
