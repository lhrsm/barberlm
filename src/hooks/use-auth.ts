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
  phone: string | null;
}

// Global state shared across useAuth instances.
let globalUser: User | null = null;
let globalSession: Session | null = null;
let globalProfile: Profile | null = null;
let globalLoading = false; 
if (typeof window === 'undefined') globalLoading = false; // Never loading during SSR to avoid blocking render
let initialized = false;
let initializationPromise: Promise<void> | null = null;
const listeners = new Set<(state: { user: User | null; session: Session | null; profile: Profile | null; loading: boolean }) => void>();



function emit() {
  const state = { user: globalUser, session: globalSession, profile: globalProfile, loading: globalLoading };
  listeners.forEach((l) => l(state));
}

function setState(partial: Partial<{ user: User | null; session: Session | null; profile: Profile | null; loading: boolean }>) {
  if (partial.user !== undefined) globalUser = partial.user;
  if (partial.session !== undefined) globalSession = partial.session;
  if (partial.profile !== undefined) globalProfile = partial.profile;
  if (partial.loading !== undefined) globalLoading = partial.loading;
  emit();
}

async function fetchProfileData(userId: string) {
  try {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, tenant_id, business_name, responsible_name, display_name, slug, email, identity_status, phone")
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
      slug: resolvedRole === 'client' ? null : (profileData?.slug ?? null),
      email: profileData?.email ?? null,
      identity_status: (profileData?.identity_status as IdentityStatus) ?? 'legacy',
      phone: profileData?.phone ?? null,
    };

    setState({ profile: normalizedProfile });
    return normalizedProfile;
  } catch (err) {
    console.error("[useAuth] fetchProfileData crash:", err);
    return null;
  }
}

async function initializeAuth() {
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    if (initialized) return;
    initialized = true;

    // INICIO: Hydration logic with explicit locking and profile synchronization
    setState({ loading: true });

    // 1. Subscribe to auth events
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[AUTH_TRACE] onAuthStateChange: ${event}`, { 
        hasSession: !!session,
        userId: session?.user?.id 
      });
      
      if (event === 'SIGNED_OUT') {
        setState({ session: null, user: null, profile: null, loading: false });
      } else if (event === 'USER_UPDATED' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          const isSameUser = globalProfile?.id === session.user.id;
          
          if (!isSameUser || event === 'SIGNED_IN') {
            setState({ session, user: session.user, loading: true });
            const profile = await fetchProfileData(session.user.id);
            if (!profile && event === 'SIGNED_IN') {
              // Retry once if profile not found immediately after sign in
              await new Promise(r => setTimeout(r, 500));
              await fetchProfileData(session.user.id);
            }
            setState({ loading: false });
          } else {
            setState({ session, user: session.user });
          }
        } else if (event !== 'INITIAL_SESSION') {
          setState({ session: null, user: null, profile: null, loading: false });
        }
      }
    });

    // 2. Initial hydration
    try {
      // Small delay to allow session persistence to settle (especially on F5)
      if (typeof window !== 'undefined') {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const { data: { session } } = await supabase.auth.getSession();
      console.log("[AUTH_TRACE] Initial getSession:", { hasSession: !!session });
      
      if (session?.user) {
        // Keep loading=true until profile is fetched
        setState({ session, user: session.user, loading: true });
        await fetchProfileData(session.user.id);
      } else {
        setState({ session: null, user: null, profile: null });
      }
    } catch (err) {
      console.error("[AUTH_TRACE] getSession error:", err);
      setState({ session: null, user: null, profile: null });
    } finally {
      setState({ loading: false });
      console.log("[AUTH_TRACE] Initialization complete", { 
        loading: globalLoading, 
        user: !!globalUser, 
        profile: !!globalProfile 
      });
    }
  })();

  return initializationPromise;
}


export function useAuth() {
  const [state, setLocalState] = useState({
    user: globalUser,
    session: globalSession,
    profile: globalProfile,
    loading: typeof window === 'undefined' ? false : (initialized ? globalLoading : true),
  });

  useEffect(() => {
    // Se já inicializou, sincroniza o estado local imediatamente
    if (initialized) {
      setLocalState({
        user: globalUser,
        session: globalSession,
        profile: globalProfile,
        loading: globalLoading,
      });
    }

    const listener = (next: typeof state) => {
      setLocalState(next);
    };
    listeners.add(listener);

    if (!initialized && typeof window !== 'undefined') {
      initializeAuth();
    }

    return () => {
      listeners.delete(listener);
    };
  }, []);


  const logout = async () => {
    // Captura o slug antes de sair para permitir o redirecionamento dinâmico
    const currentSlug = globalProfile?.role === 'client' ? null : globalProfile?.slug;
    await supabase.auth.signOut();
    setState({ session: null, user: null, profile: null, loading: false });
    
    // Se estivermos em um contexto de tenant, redirecionamos para a página da barbearia
    if (currentSlug && typeof window !== 'undefined') {
      // O AppLayout lidará com o redirecionamento se necessário, 
      // mas podemos forçar um aqui se for disparado manualmente.
      // navigate não está disponível no hook global, então deixamos para os componentes
    }
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

