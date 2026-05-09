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

// Global state to share between useAuth instances
let globalUser: User | null = null;
let globalSession: Session | null = null;
let globalProfile: Profile | null = null;
let globalLoading = true;
const listeners = new Set<(state: { user: User | null; session: Session | null; profile: Profile | null; loading: boolean }) => void>();

function updateGlobalState(newState: Partial<{ user: User | null; session: Session | null; profile: Profile | null; loading: boolean }>) {
  if ('user' in newState) globalUser = newState.user!;
  if ('session' in newState) globalSession = newState.session!;
  if ('profile' in newState) globalProfile = newState.profile!;
  if ('loading' in newState) globalLoading = newState.loading!;
  
  listeners.forEach(listener => listener({ 
    user: globalUser, 
    session: globalSession, 
    profile: globalProfile, 
    loading: globalLoading 
  }));
}

async function fetchProfileData(userId: string) {
  try {
    console.log("Fetching profile for user:", userId);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, role, tenant_id, business_name, slug")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching profile from DB:", error);
      // In case of error, we don't want to block the user if they have a session
      return null;
    }
    
    if (!data) {
      console.warn("No profile found for user:", userId, ". Creating default profile...");
      // Try to create a default profile if it doesn't exist
      const { data: newProfile, error: insertError } = await supabase
        .from("profiles")
        .insert({ id: userId, role: 'client' })
        .select()
        .single();
      
      if (insertError) {
        console.error("Failed to create fallback profile:", insertError);
        return null;
      }
      
      updateGlobalState({ profile: newProfile as Profile });
      return newProfile;
    }

    console.log("Profile fetched successfully for user:", userId, "Role:", data.role);
    updateGlobalState({ profile: data as Profile });
    return data;
  } catch (error) {
    console.error("Critical error in fetchProfileData:", error);
    return null;
  }
}

// Initialize global session
let initialized = false;
async function initializeAuth() {
  if (initialized) return;
  initialized = true;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    globalSession = session;
    globalUser = session?.user ?? null;
    
    if (session?.user) {
      console.log("Auth init: User found, fetching profile...");
      await fetchProfileData(session.user.id);
    }
    
    updateGlobalState({ loading: false });
  } catch (error) {
    console.error("Error getting initial session:", error);
    updateGlobalState({ loading: false });
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log("Auth state change event:", event, "User:", session?.user?.id);
    
    updateGlobalState({ 
      session, 
      user: session?.user ?? null,
      loading: session?.user ? true : false
    });

    if (session?.user) {
      await fetchProfileData(session.user.id);
    } else {
      updateGlobalState({ profile: null });
    }
    
    updateGlobalState({ loading: false });
  });
}

if (typeof window !== 'undefined') {
  initializeAuth();
}

export function useAuth() {
  const [state, setState] = useState({
    user: globalUser,
    session: globalSession,
    profile: globalProfile,
    loading: globalLoading
  });

  useEffect(() => {
    const listener = (newState: typeof state) => setState(newState);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return { 
    user: state.user, 
    session: state.session, 
    profile: state.profile, 
    role: state.profile?.role,
    loading: state.loading 
  };
}
