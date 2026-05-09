import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

export type UserRole = 'super_admin' | 'tenant_admin' | 'barber' | 'client';

interface Profile {
  id: string;
  role: UserRole;
  tenant_id: string | null;
  business_name: string | null;
  slug: string | null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchProfile(userId: string) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, role, tenant_id, business_name, slug")
          .eq("id", userId)
          .maybeSingle();

        if (error) throw error;
        if (mounted) {
          setProfile(data as Profile);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    }

    async function getInitialSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            await fetchProfile(session.user.id);
          }
          setLoading(false);
        }
      } catch (error) {
        console.error("Error getting initial session:", error);
        if (mounted) setLoading(false);
      }
    }

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { 
    user, 
    session, 
    profile, 
    role: profile?.role,
    loading 
  };
}
