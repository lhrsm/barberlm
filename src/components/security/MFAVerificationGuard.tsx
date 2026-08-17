import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Shield, Key, Loader2, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { getMFAChallenge, verifyMFAChallenge, verifyBackupCode } from '@/lib/auth-mfa.functions';
import { listFactors } from '@/lib/auth-security.functions';

interface MFAVerificationGuardProps {
  onSuccess: () => void;
  onCancel?: () => void;
  title?: string;
  description?: string;
}

export const MFAVerificationGuard: React.FC<MFAVerificationGuardProps> = ({ 
  onSuccess, 
  onCancel,
  title = "Verificação Necessária",
  description = "Sua conta possui proteção adicional. Insira o código do seu aplicativo autenticador."
}) => {
  const [step, setStep] = useState<'factor_select' | 'challenge' | 'backup_code'>('challenge');
  const [factors, setFactors] = useState<any[]>([]);
  const [selectedFactor, setSelectedFactor] = useState<any>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const factorsData = await listFactors();
        const activeFactors = factorsData.all?.filter((f: any) => f.status === 'verified') || [];
        setFactors(activeFactors);
        
        if (activeFactors.length === 0) {
          // No MFA active, proceed
          onSuccess();
        } else {
          setSelectedFactor(activeFactors[0]);
          startChallenge(activeFactors[0].id);
        }
      } catch (error) {
        console.error("MFA Init error:", error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const challengeMutation = useMutation({
    mutationFn: (factorId: string) => getMFAChallenge({ data: { factorId } }),
    onSuccess: (challenge) => {
      setChallengeId(challenge.id);
    },
    onError: (error: any) => toast.error(`Erro ao gerar desafio: ${error.message}`)
  });

  const verifyMutation = useMutation({
    mutationFn: () => verifyMFAChallenge({ 
      data: { 
        factorId: selectedFactor.id, 
        challengeId: challengeId!, 
        code 
      } 
    }),
    onSuccess: () => {
      toast.success("Verificado com sucesso!");
      onSuccess();
    },
    onError: (error: any) => toast.error("Código incorreto. Tente novamente.")
  });

  const backupMutation = useMutation({
    mutationFn: (backupCode: string) => verifyBackupCode({ data: { code: backupCode } }),
    onSuccess: () => {
      toast.success("Recuperado com sucesso!");
      onSuccess();
    },
    onError: (error: any) => toast.error(error.message)
  });

  const startChallenge = (factorId: string) => {
    challengeMutation.mutate(factorId);
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 'challenge') {
      verifyMutation.mutate();
    } else {
      backupMutation.mutate(code);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="w-8 h-8 text-gold animate-spin" />
        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Validando Segurança...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md w-full mx-auto p-8 bg-[#0a0c14] border border-gold/20 rounded-[32px] shadow-2xl animate-in fade-in zoom-in duration-300">
      <div className="text-center space-y-4 mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20">
          {step === 'backup_code' ? <Key className="text-gold w-8 h-8" /> : <Shield className="text-gold w-8 h-8" />}
        </div>
        <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">
          {step === 'backup_code' ? 'Código de ' : ''}
          <span className="text-gold">{step === 'backup_code' ? 'Recuperação' : title}</span>
        </h2>
        <p className="text-zinc-400 text-sm font-medium">
          {step === 'backup_code' 
            ? "Insira um dos seus códigos de 8 caracteres salvos anteriormente." 
            : description}
        </p>
      </div>

      <form onSubmit={handleVerify} className="space-y-6">
        <div className="space-y-2">
          <Input 
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={step === 'backup_code' ? "ABCDEFGH" : "000 000"}
            className="h-16 bg-white/5 border-gold/30 text-center text-2xl tracking-[0.5em] font-black focus-visible:ring-gold/30 rounded-2xl"
            autoFocus
            maxLength={step === 'backup_code' ? 8 : 6}
          />
        </div>

        <Button 
          type="submit"
          disabled={verifyMutation.isPending || backupMutation.isPending || (step === 'challenge' && code.length !== 6) || (step === 'backup_code' && code.length !== 8)}
          className="w-full h-14 bg-gold hover:bg-gold/80 text-black font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-gold/10 transition-all active:scale-[0.98]"
        >
          {verifyMutation.isPending || backupMutation.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <>
              Confirmar
              <ArrowRight className="ml-2 w-5 h-5" />
            </>
          )}
        </Button>

        <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
          {step === 'challenge' ? (
            <button 
              type="button"
              onClick={() => { setStep('backup_code'); setCode(''); }}
              className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-gold transition-colors text-center"
            >
              Não tenho acesso ao autenticador
            </button>
          ) : (
            <button 
              type="button"
              onClick={() => { setStep('challenge'); setCode(''); }}
              className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-gold transition-colors text-center"
            >
              Voltar para o autenticador
            </button>
          )}
          
          {onCancel && (
            <button 
              type="button"
              onClick={onCancel}
              className="text-[10px] font-black uppercase tracking-widest text-red-500/50 hover:text-red-500 transition-colors text-center"
            >
              Cancelar e Sair
            </button>
          )}
        </div>
      </form>

      {challengeMutation.isPending && (
        <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-zinc-600 font-bold uppercase tracking-tighter">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Gerando novo desafio...
        </div>
      )}
    </div>
  );
};
