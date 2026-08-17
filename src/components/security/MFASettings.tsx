import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, ShieldCheck, ShieldAlert, Smartphone, QrCode, Key, Trash2, Loader2, CheckCircle2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { enrollMFA, verifyMFA, unenrollMFA, listFactors, getMFAStatus } from '@/lib/auth-security.functions';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const MFASettings: React.FC = () => {
  const queryClient = useQueryClient();
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollData, setEnrollData] = useState<any>(null);
  const [otpCode, setOtpCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const { data: factors, isLoading: loadingFactors } = useQuery({
    queryKey: ['mfa-factors'],
    queryFn: () => listFactors()
  });

  const { data: mfaStatus } = useQuery({
    queryKey: ['mfa-status'],
    queryFn: () => getMFAStatus()
  });

  const enrollMutation = useMutation({
    mutationFn: () => enrollMFA(),
    onSuccess: (data) => {
      setEnrollData(data);
      setShowEnrollModal(true);
    },
    onError: (error: any) => toast.error(`Erro ao iniciar MFA: ${error.message}`)
  });

  const verifyMutation = useMutation({
    mutationFn: (code: string) => verifyMFA({ data: { factorId: enrollData.id, code } }),
    onSuccess: () => {
      toast.success('Autenticação em duas etapas ativada com sucesso!');
      setShowEnrollModal(false);
      setEnrollData(null);
      setOtpCode('');
      queryClient.invalidateQueries({ queryKey: ['mfa-factors'] });
      queryClient.invalidateQueries({ queryKey: ['mfa-status'] });
      queryClient.invalidateQueries({ queryKey: ['security-logs'] });
    },
    onError: (error: any) => {
      toast.error(`Código inválido: ${error.message}`);
      setIsVerifying(false);
    }
  });

  const unenrollMutation = useMutation({
    mutationFn: (factorId: string) => unenrollMFA({ data: { factorId } }),
    onSuccess: () => {
      toast.success('MFA desativado.');
      queryClient.invalidateQueries({ queryKey: ['mfa-factors'] });
      queryClient.invalidateQueries({ queryKey: ['mfa-status'] });
      queryClient.invalidateQueries({ queryKey: ['security-logs'] });
    },
    onError: (error: any) => toast.error(error.message)
  });

  const handleVerify = () => {
    if (otpCode.length !== 6) {
      toast.error('O código deve ter 6 dígitos.');
      return;
    }
    setIsVerifying(true);
    verifyMutation.mutate(otpCode);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Chave copiada!');
  };

  const activeFactors = factors?.all?.filter((f: any) => f.status === 'verified') || [];
  const isMFAEnabled = activeFactors.length > 0;

  return (
    <Card className="bg-black/40 border-gold/10 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-gold" />
            <CardTitle className="text-white">Autenticação em Duas Etapas (MFA)</CardTitle>
          </div>
          {isMFAEnabled ? (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Ativado</Badge>
          ) : (
            <Badge variant="outline" className="text-gray-500 border-gray-800">Desativado</Badge>
          )}
        </div>
        <CardDescription className="text-gray-400">
          Adicione uma camada extra de segurança usando um aplicativo autenticador (Google Authenticator, Authy, etc).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loadingFactors ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 text-gold animate-spin" />
          </div>
        ) : isMFAEnabled ? (
          <div className="space-y-4">
            {activeFactors.map((factor: any) => (
              <div key={factor.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-gold/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gold/10 rounded-lg">
                    <ShieldCheck className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Aplicativo Autenticador</p>
                    <p className="text-xs text-gray-500">Configurado via TOTP</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => unenrollMutation.mutate(factor.id)}
                  disabled={unenrollMutation.isPending}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Desativar
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
            <div className="p-4 bg-white/5 rounded-full border border-white/10">
              <ShieldAlert className="w-10 h-10 text-gray-600" />
            </div>
            <div className="max-w-sm">
              <p className="text-sm text-gray-400 mb-4">
                Sua conta está protegida apenas por senha. Recomendamos ativar o MFA para proteger dados sensíveis.
              </p>
              <Button 
                onClick={() => enrollMutation.mutate()}
                disabled={enrollMutation.isPending}
                className="bg-gold hover:bg-gold/80 text-black font-bold w-full"
              >
                {enrollMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
                Configurar MFA
              </Button>
            </div>
          </div>
        )}

        {/* Enrollment Modal */}
        <Dialog open={showEnrollModal} onOpenChange={setShowEnrollModal}>
          <DialogContent className="bg-[#0a0c14] border-gold/20 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase italic tracking-tighter">
                Configurar <span className="text-gold">MFA</span>
              </DialogTitle>
              <DialogDescription className="text-zinc-400">
                Siga os passos abaixo para ativar a proteção em duas etapas.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-gold uppercase tracking-widest">
                  <span className="w-6 h-6 rounded-full bg-gold text-black flex items-center justify-center text-[10px]">1</span>
                  Escaneie o QR Code
                </div>
                <p className="text-xs text-zinc-500">
                  Abra seu aplicativo de autenticação e escaneie o código abaixo.
                </p>
                <div className="bg-white p-4 rounded-xl inline-block mx-auto flex justify-center">
                   {enrollData?.totp?.qr_code && (
                     <img 
                       src={enrollData.totp.qr_code} 
                       alt="MFA QR Code" 
                       className="w-48 h-48"
                     />
                   )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-gold uppercase tracking-widest">
                  <span className="w-6 h-6 rounded-full bg-gold text-black flex items-center justify-center text-[10px]">2</span>
                  Ou insira a chave manual
                </div>
                <div className="flex gap-2">
                  <code className="flex-1 p-2 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-zinc-300 break-all">
                    {enrollData?.totp?.secret}
                  </code>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => copyToClipboard(enrollData?.totp?.secret)}
                    className="border-white/10 hover:bg-white/5"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-white/5">
                <div className="flex items-center gap-2 text-sm font-bold text-gold uppercase tracking-widest">
                  <span className="w-6 h-6 rounded-full bg-gold text-black flex items-center justify-center text-[10px]">3</span>
                  Confirme o código
                </div>
                <Input 
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000 000"
                  className="bg-white/5 border-gold/30 text-center text-2xl tracking-[0.5em] font-black h-14"
                  maxLength={6}
                />
              </div>
            </div>

            <DialogFooter>
              <Button 
                variant="ghost" 
                onClick={() => setShowEnrollModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleVerify}
                disabled={isVerifying || otpCode.length !== 6}
                className="bg-gold hover:bg-gold/80 text-black font-bold px-8"
              >
                {isVerifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Ativar Agora
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
