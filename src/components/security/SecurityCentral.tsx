import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Mail, Lock, Smartphone, History, LogOut, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { getSecurityLogs, updatePassword, requestEmailChange, listSessions } from '@/lib/auth-security.functions';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MFASettings } from './MFASettings';



export const SecurityCentral: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const { data: logs, isLoading: loadingLogs } = useQuery({
    queryKey: ['security-logs'],
    queryFn: () => getSecurityLogs()
  });

  const { data: sessions } = useQuery({
    queryKey: ['user-sessions'],
    queryFn: () => listSessions()
  });

  const passwordMutation = useMutation({
    mutationFn: (pwd: string) => updatePassword({ data: { password: pwd } }),
    onSuccess: () => {
      toast.success('Senha atualizada com sucesso!');
      setNewPassword('');
      setConfirmPassword('');
      queryClient.invalidateQueries({ queryKey: ['security-logs'] });
    },
    onError: (error: any) => toast.error(error.message)
  });

  const emailMutation = useMutation({
    mutationFn: (email: string) => requestEmailChange({ data: { newEmail: email } }),
    onSuccess: (res) => {
      toast.success(res.message);
      setNewEmail('');
    },
    onError: (error: any) => toast.error(error.message)
  });

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    passwordMutation.mutate(newPassword);
  };

  const handleUpdateEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    emailMutation.mutate(newEmail);
  };

  const maskEmail = (email?: string) => {
    if (!email) return '';
    const [name, domain] = email.split('@');
    return `${name.slice(0, 3)}***@${domain}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-3 border-b border-gold/20 pb-4">
        <Shield className="w-8 h-8 text-gold" />
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Segurança da Conta</h1>
          <p className="text-gray-400 text-sm">Gerencie suas credenciais e sessões ativas.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Email Section */}
        <Card className="bg-black/40 border-gold/10 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-gold" />
              <CardTitle className="text-white">E-mail</CardTitle>
            </div>
            <CardDescription className="text-gray-400">
              O e-mail é usado para login e comunicações importantes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">E-mail Atual</p>
                <p className="text-white font-medium">{maskEmail(user?.email)}</p>
              </div>
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 flex gap-1">
                <CheckCircle2 className="w-3 h-3" /> Verificado
              </Badge>
            </div>

            <form onSubmit={handleUpdateEmail} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-gray-400">Novo E-mail</label>
                <Input 
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="exemplo@email.com"
                  className="bg-black/40 border-gold/20 text-white"
                  type="email"
                />
              </div>
              <Button 
                type="submit"
                disabled={emailMutation.isPending}
                className="w-full bg-gold hover:bg-gold/80 text-black font-bold"
              >
                {emailMutation.isPending ? 'Enviando...' : 'Alterar E-mail'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Password Section */}
        <Card className="bg-black/40 border-gold/10 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-gold" />
              <CardTitle className="text-white">Senha</CardTitle>
            </div>
            <CardDescription className="text-gray-400">
              Mantenha sua senha forte para maior segurança.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-1 relative">
                  <label className="text-xs text-gray-400">Nova Senha</label>
                  <Input 
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-black/40 border-gold/20 text-white pr-10"
                    placeholder="******"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-8 text-gray-500 hover:text-gold transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-400">Confirmar Nova Senha</label>
                  <Input 
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-black/40 border-gold/20 text-white"
                    placeholder="******"
                  />
                </div>
              </div>
              <Button 
                type="submit"
                disabled={passwordMutation.isPending}
                className="w-full bg-gold hover:bg-gold/80 text-black font-bold"
              >
                {passwordMutation.isPending ? 'Processando...' : 'Atualizar Senha'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* MFA Section */}
        <div className="md:col-span-2">
          <MFASettings />
        </div>

        {/* Sessions Section */}

        <Card className="bg-black/40 border-gold/10 backdrop-blur-sm md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-gold" />
              <CardTitle className="text-white">Sessões Ativas</CardTitle>
            </div>
            <CardDescription className="text-gray-400">
              Dispositivos que acessaram sua conta recentemente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sessions?.map((session: any) => (
                <div key={session.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center border border-gold/20">
                      <Smartphone className="text-gold w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{session.browser}</p>
                      <p className="text-xs text-gray-400">
                        {session.is_current ? 'Acesso agora' : `Visto em ${format(new Date(session.last_access), "dd/MM 'às' HH:mm", { locale: ptBR })}`}
                      </p>
                    </div>
                  </div>
                  {session.is_current ? (
                    <Badge className="bg-gold/20 text-gold border-gold/30">Atual</Badge>
                  ) : (
                    <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-2">
                      <LogOut className="w-4 h-4" /> Encerrar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Security Logs Section */}
        <Card className="bg-black/40 border-gold/10 backdrop-blur-sm md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-gold" />
              <CardTitle className="text-white">Atividades de Segurança</CardTitle>
            </div>
            <CardDescription className="text-gray-400">
              Histórico recente de ações importantes na sua conta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingLogs ? (
              <div className="text-center py-8 text-gray-500 italic">Carregando histórico...</div>
            ) : logs && logs.length > 0 ? (
              <div className="space-y-1">
                {logs.map((log: any) => (
                  <div key={log.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${log.event_type.includes('failed') ? 'bg-red-500' : 'bg-gold'}`} />
                      <div>
                        <p className="text-sm text-white font-medium">
                          {log.event_type === 'password_changed' && 'Senha alterada'}
                          {log.event_type === 'login_success' && 'Login realizado'}
                          {log.event_type === 'email_change_requested' && 'Troca de e-mail solicitada'}
                          {!['password_changed', 'login_success', 'email_change_requested'].includes(log.event_type) && log.event_type}
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    {log.metadata?.ip && (
                      <span className="text-[10px] text-gray-600 font-mono">{log.metadata.ip}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <AlertCircle className="w-12 h-12 mb-3 opacity-20" />
                <p>Nenhuma atividade suspeita registrada.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
