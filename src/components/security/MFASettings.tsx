import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, ShieldCheck, ShieldAlert, Smartphone, QrCode, Key, Trash2, Loader2, CheckCircle2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { enrollMFA, verifyMFA, unenrollMFA, listFactors, getMFAStatus, generateBackupCodes, listBackupCodes } from '@/lib/auth-security.functions';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Download, RefreshCw } from 'lucide-react';


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
          <div className="space-y-6">
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

            <BackupCodesSection />
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

const BackupCodesSection: React.FC = () => {
  const queryClient = useQueryClient();
  const [showCodesModal, setShowCodesModal] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);

  const { data: backupCodes, isLoading } = useQuery({
    queryKey: ['mfa-backup-codes'],
    queryFn: () => listBackupCodes()
  });

  const generateMutation = useMutation({
    mutationFn: () => generateBackupCodes(),
    onSuccess: (codes) => {
      setGeneratedCodes(codes);
      setShowCodesModal(true);
      queryClient.invalidateQueries({ queryKey: ['mfa-backup-codes'] });
    },
    onError: (error: any) => toast.error(`Erro ao gerar códigos: ${error.message}`)
  });

  const downloadCodes = () => {
    const text = `CÓDIGOS DE RECUPERAÇÃO BARBEX\n\nGuarde em local seguro. Cada código pode ser usado apenas uma vez.\n\n${generatedCodes.join('\n')}`;
    const element = document.createElement("a");
    const file = new Blob([text], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = "barbex-backup-codes.txt";
    document.body.appendChild(element);
    element.click();
  };

  const hasCodes = backupCodes && backupCodes.length > 0;

  return (
    <div className="pt-6 border-t border-white/5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Key className="w-4 h-4 text-gold" />
            Códigos de Recuperação
          </h4>
          <p className="text-xs text-gray-500 mt-1">
            Use estes códigos para acessar sua conta caso perca seu dispositivo MFA.
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="border-gold/20 text-gold hover:bg-gold/10"
        >
          {generateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <RefreshCw className="w-3 h-3 mr-2" />}
          {hasCodes ? 'Regerar Códigos' : 'Gerar Códigos'}
        </Button>
      </div>

      {hasCodes && (
        <div className="p-3 bg-white/5 rounded-lg border border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <CheckCircle2 className="w-3 h-3 text-green-500" />
            Você possui códigos de recuperação ativos.
          </div>
          <Badge variant="outline" className="text-[10px] text-zinc-500 border-zinc-800 uppercase tracking-widest">
            {backupCodes.filter((c: any) => !c.used_at).length} Disponíveis
          </Badge>
        </div>
      )}

      <Dialog open={showCodesModal} onOpenChange={setShowCodesModal}>
        <DialogContent className="bg-[#0a0c14] border-gold/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase italic tracking-tighter">
              Códigos de <span className="text-gold">Recuperação</span>
            </DialogTitle>
            <DialogDescription className="text-red-400 font-bold">
              ATENÇÃO: Estes códigos serão exibidos apenas esta vez. Salve-os agora!
            </DialogDescription>
          </DialogHeader>

          <div className="bg-black/40 border border-gold/20 rounded-xl p-6 grid grid-cols-2 gap-4">
            {generatedCodes.map((code, idx) => (
              <div key={idx} className="font-mono text-center py-2 bg-white/5 rounded border border-white/10 text-zinc-200 tracking-wider">
                {code}
              </div>
            ))}
          </div>

          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={downloadCodes}
              className="flex-1 border-white/10 text-white hover:bg-white/5"
            >
              <Download className="w-4 h-4 mr-2" />
              Baixar TXT
            </Button>
            <Button 
              onClick={() => setShowCodesModal(false)}
              className="flex-1 bg-gold hover:bg-gold/80 text-black font-bold"
            >
              Salvar e Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

