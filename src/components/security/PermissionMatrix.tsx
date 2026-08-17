import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, Check, Minus, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

const ROLES = ['admin', 'manager', 'receptionist', 'financial', 'professional'] as const;

export const PermissionMatrix: React.FC = () => {
  const { data: permissions } = useQuery({
    queryKey: ['matrix-permissions'],
    queryFn: async () => {
      const { data } = await supabase.from('permissions').select('*').order('category');
      return data || [];
    }
  });

  const { data: rolePermissions } = useQuery({
    queryKey: ['matrix-role-permissions'],
    queryFn: async () => {
      const { data } = await supabase.from('role_permissions').select('*');
      return data || [];
    }
  });

  const checkPermission = (role: string, permissionKey: string) => {
    return rolePermissions?.some(rp => rp.role === role && rp.permission_key === permissionKey);
  };

  const categories = [...new Set(permissions?.map(p => p.category))];

  return (
    <Card className="bg-black/40 border-gold/10 backdrop-blur-sm overflow-hidden">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-gold" />
          <CardTitle className="text-white">Matriz de Acesso Definitiva</CardTitle>
        </div>
        <CardDescription className="text-zinc-400">
          Visualização das permissões padrão por perfil de usuário.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Módulo / Recurso</th>
                {ROLES.map(role => (
                  <th key={role} className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-center text-zinc-300">
                    {role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map(category => (
                <React.Fragment key={category}>
                  <tr className="bg-white/5">
                    <td colSpan={ROLES.length + 1} className="py-2 px-4 text-[9px] font-black uppercase tracking-[0.2em] text-gold/60">
                      {category}
                    </td>
                  </tr>
                  {permissions?.filter(p => p.category === category).map(permission => (
                    <tr key={permission.key} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4">
                        <div className="text-xs font-bold text-white">{permission.name}</div>
                        <div className="text-[10px] text-zinc-500">{permission.key}</div>
                      </td>
                      {ROLES.map(role => {
                        const hasAccess = checkPermission(role, permission.key);
                        return (
                          <td key={role} className="py-3 px-4 text-center">
                            {hasAccess ? (
                              <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20 text-green-500">
                                <Check className="w-4 h-4" />
                              </div>
                            ) : (
                              <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 text-zinc-600">
                                <Minus className="w-3 h-3" />
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mt-8 p-4 rounded-2xl bg-gold/5 border border-gold/10 flex gap-3">
          <Info className="w-5 h-5 text-gold shrink-0" />
          <p className="text-[10px] text-zinc-400 leading-relaxed uppercase tracking-wider font-medium">
            O <span className="text-gold font-bold">SUPER ADMIN</span> possui acesso irrestrito a todas as funcionalidades do sistema, independentemente desta matriz. 
            Permissões customizadas por usuário podem ser aplicadas futuramente via overrides explícitos.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
