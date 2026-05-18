import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

interface ProfessionalSession {
  barber_id: string;
  phone: string;
  name: string;
  role: 'barber';
  tenant_id?: string;
}

interface ProfessionalAuthContextType {
  session: ProfessionalSession | null;
  loading: boolean;
  login: (sessionData: ProfessionalSession) => void;
  logout: () => void;
}

const ProfessionalAuthContext = createContext<ProfessionalAuthContextType | undefined>(undefined);

export function ProfessionalAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ProfessionalSession | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const savedSession = localStorage.getItem('barber_session');
    if (savedSession) {
      try {
        setSession(JSON.parse(savedSession));
      } catch (e) {
        localStorage.removeItem('barber_session');
      }
    }
    setLoading(false);
  }, []);

  const login = (sessionData: ProfessionalSession) => {
    localStorage.setItem('barber_session', JSON.stringify(sessionData));
    setSession(sessionData);
  };

  const logout = () => {
    localStorage.removeItem('barber_session');
    setSession(null);
    navigate({ to: "/auth" });
  };

  return (
    <ProfessionalAuthContext.Provider value={{ session, loading, login, logout }}>
      {children}
    </ProfessionalAuthContext.Provider>
  );
}

export function useProfessionalAuth() {
  const context = useContext(ProfessionalAuthContext);
  if (context === undefined) {
    throw new Error("useProfessionalAuth must be used within a ProfessionalAuthProvider");
  }
  return context;
}
