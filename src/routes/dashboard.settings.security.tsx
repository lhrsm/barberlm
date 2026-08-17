import { createFileRoute } from '@tanstack/react-router';
import { SecurityCentral } from '@/components/security/SecurityCentral';
import { MFAVerificationGuard } from '@/components/security/MFAVerificationGuard';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { listFactors } from '@/lib/auth-security.functions';

export const Route = createFileRoute('/dashboard/settings/security')({
  component: SecuritySettingsRoute,
});

function SecuritySettingsRoute() {
  const { role } = useAuth();
  const [needsMFA, setNeedsMFA] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  const privilegedRoles = ['super_admin', 'owner', 'admin', 'finance', 'manager'];

  useEffect(() => {
    const checkMFA = async () => {
      if (!privilegedRoles.includes(role || '')) {
        setIsVerified(true);
        setLoading(false);
        return;
      }

      try {
        const factors = await listFactors();
        const hasVerifiedFactor = factors.all?.some((f: any) => f.status === 'verified');
        
        if (hasVerifiedFactor) {
          setNeedsMFA(true);
        } else {
          setIsVerified(true);
        }
      } catch (e) {
        setIsVerified(true);
      } finally {
        setLoading(false);
      }
    };

    checkMFA();
  }, [role]);

  if (loading) return null;

  if (needsMFA && !isVerified) {
    return (
      <div className="min-h-screen bg-[#05070d] flex items-center justify-center p-6">
        <MFAVerificationGuard 
          onSuccess={() => setIsVerified(true)}
          title="Segurança Reforçada"
          description="Para acessar as configurações de segurança, confirme sua identidade."
        />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 overflow-y-auto h-full pb-20">
      <SecurityCentral />
    </div>
  );
}

