import React from 'react';
import { usePermissions, type PermissionKey } from '@/hooks/use-permissions';
import { Navigate, useLocation } from '@tanstack/react-router';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PermissionGuardProps {
  children: React.ReactNode;
  permission?: PermissionKey;
  permissions?: PermissionKey[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  redirect?: string;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  permission,
  permissions,
  requireAll = false,
  fallback,
  redirect
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading } = usePermissions();
  const location = useLocation();

  if (loading) {
    return null; // Or a loading spinner
  }

  let allowed = false;
  if (permission) {
    allowed = hasPermission(permission);
  } else if (permissions) {
    allowed = requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions);
  } else {
    allowed = true; // No permission required
  }

  if (!allowed) {
    if (redirect) {
      return <Navigate to={redirect as any} />;
    }

    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-black/40 border border-gold/10 rounded-3xl backdrop-blur-md">
        <div className="w-20 h-20 bg-gold/10 rounded-full flex items-center justify-center mb-6">
          <ShieldAlert className="w-10 h-10 text-gold" />
        </div>
        <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white mb-2">
          Acesso Restrito
        </h2>
        <p className="text-zinc-400 max-w-md mb-8">
          Sua conta não possui permissão para acessar esta funcionalidade. Entre em contato com o administrador se você acredita que isso é um erro.
        </p>
        <div className="flex gap-4">
          <Button 
            variant="outline" 
            onClick={() => window.history.back()}
            className="border-white/10 text-white hover:bg-white/5"
          >
            Voltar
          </Button>
          <Button 
            onClick={() => window.location.href = '/dashboard'}
            className="bg-gold hover:bg-gold/80 text-black font-bold"
          >
            Página Inicial
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
