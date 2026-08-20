import { useState } from "react";
import {
  ShieldCheck,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Smartphone,
  ShieldAlert,
  CheckCircle2,
  FileText,
  Eye,
  EyeOff,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SecurityTabProps {
  user: any;
  customerData: any;
  shopName?: string;
  onLogout: () => void;
}

export function SecurityTab({ user, customerData, shopName, onLogout }: SecurityTabProps) {
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("A nova senha deve conter no mínimo 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("A confirmação de senha não confere.");
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        if (error.message?.toLowerCase().includes("weak")) {
          throw new Error("Senha muito fraca. Utilize uma combinação mais segura.");
        }
        if (error.message?.toLowerCase().includes("same")) {
          throw new Error("A nova senha deve ser diferente da senha atual.");
        }
        throw error;
      }

      toast.success("Senha alterada com sucesso!", {
        description: "Sua conta está atualizada e protegida."
      });
      setIsPasswordModalOpen(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error("[SECURITY_PASSWORD_UPDATE_ERROR]", err);
      toast.error(err.message || "Erro ao atualizar senha. Tente novamente.");
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
      {/* Header da Central */}
      <div>
        <h2 className="text-2xl font-black text-white uppercase italic tracking-tight flex items-center gap-3">
          <ShieldCheck className="text-gold h-7 w-7" />
          Central de Segurança & Acesso
        </h2>
        <p className="text-sm text-zinc-400 mt-1">
          Gerencie o acesso à sua conta, dados protegidos e credenciais de login.
        </p>
      </div>

      {/* Grid Principal de Segurança */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card: Dados de Acesso */}
        <Card className="bg-gradient-to-br from-[#0e131f] via-[#090d14] to-black border border-white/10 rounded-3xl overflow-hidden shadow-xl">
          <CardHeader className="p-6 pb-4 border-b border-white/5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                <KeyRound className="text-gold h-5 w-5" />
                Dados da Conta
              </CardTitle>
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[9px] font-black uppercase tracking-widest">
                Conta Protegida
              </Badge>
            </div>
            <CardDescription className="text-xs text-zinc-400">
              Informações vinculadas à sua autenticação no sistema.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-gold/10 flex items-center justify-center text-gold">
                  <Mail size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">E-mail Cadastrado</p>
                  <p className="text-xs font-bold text-white truncate max-w-[200px] sm:max-w-none">
                    {user?.email || "Não informado"}
                  </p>
                </div>
              </div>
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-gold/10 flex items-center justify-center text-gold">
                  <Smartphone size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">WhatsApp / Telefone</p>
                  <p className="text-xs font-bold text-white">
                    {customerData?.phone || "Não informado"}
                  </p>
                </div>
              </div>
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Button
                onClick={() => setIsPasswordModalOpen(true)}
                className="w-full h-12 bg-gold hover:bg-gold/90 text-black font-black uppercase tracking-widest text-xs rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-gold/10"
              >
                <Lock size={15} />
                <span>Alterar Senha de Acesso</span>
              </Button>

              <Button
                variant="outline"
                onClick={onLogout}
                className="w-full h-11 border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 font-bold uppercase tracking-wider text-xs rounded-2xl transition-all flex items-center justify-center gap-2"
              >
                <LogOut size={15} />
                <span>Desconectar desta sessão</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card: Privacidade & Dados */}
        <Card className="bg-gradient-to-br from-[#0e131f] via-[#090d14] to-black border border-white/10 rounded-3xl overflow-hidden shadow-xl">
          <CardHeader className="p-6 pb-4 border-b border-white/5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="text-gold h-5 w-5" />
                Privacidade & Dados
              </CardTitle>
              <Badge className="bg-gold/15 text-gold border-gold/30 text-[9px] font-black uppercase tracking-widest">
                Privacidade
              </Badge>
            </div>
            <CardDescription className="text-xs text-zinc-400">
              Uso consciente e protegido dos seus dados de atendimento.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 space-y-3.5 text-xs text-zinc-300">
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1.5">
              <p className="font-bold text-white flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400" />
                Finalidade Exclusiva
              </p>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Suas informações de contato e agendamentos são utilizadas para confirmações, lembretes de horário e fidelidade na {shopName || 'barbearia'}.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1.5">
              <p className="font-bold text-white flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400" />
                Conexão Segura
              </p>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Toda comunicação com o portal é protegida por criptografia HTTPS e políticas de isolamento de banco de dados.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1.5">
              <p className="font-bold text-white flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400" />
                Privacidade do Cliente
              </p>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Você pode solicitar atualização de dados ou encerramento do seu perfil a qualquer momento junto ao estabelecimento.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recomendações e Dicas de Segurança */}
      <Card className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 md:p-8">
        <h3 className="text-sm font-black uppercase italic tracking-wider text-white mb-4 flex items-center gap-2">
          <ShieldAlert className="text-gold h-4 w-4" />
          Dicas de Segurança
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-zinc-400 leading-relaxed">
          <div className="flex gap-3">
            <div className="h-6 w-6 rounded-full bg-gold/10 text-gold font-black flex items-center justify-center shrink-0 text-[10px]">
              1
            </div>
            <p>
              <strong className="text-white font-bold">Proteja sua senha:</strong> A barbearia nunca solicitará sua senha de acesso por telefone ou mensagens.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="h-6 w-6 rounded-full bg-gold/10 text-gold font-black flex items-center justify-center shrink-0 text-[10px]">
              2
            </div>
            <p>
              <strong className="text-white font-bold">Acesso seguro:</strong> Utilize senhas com pelo menos 6 caracteres e evite usar a mesma senha de outros serviços.
            </p>
          </div>
        </div>
      </Card>

      {/* Modal de Alteração de Senha */}
      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        <DialogContent className="bg-[#0b0f17] border border-white/10 text-white max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase italic tracking-tight text-white flex items-center gap-2">
              <Lock className="text-gold h-5 w-5" />
              Criar Nova Senha
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Digite e confirme sua nova senha de acesso ao portal (mínimo de 6 caracteres).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdatePassword} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-zinc-300">Nova Senha</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-white/5 border-white/10 text-white rounded-xl pr-10 focus:border-gold/50"
                  required
                  disabled={updatingPassword}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-zinc-300">Confirmar Nova Senha</Label>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-white/5 border-white/10 text-white rounded-xl focus:border-gold/50"
                required
                disabled={updatingPassword}
              />
            </div>

            <DialogFooter className="pt-3 flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-zinc-400 hover:text-white rounded-xl"
                disabled={updatingPassword}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updatingPassword}
                className="bg-gold hover:bg-gold/90 text-black font-black uppercase tracking-wider rounded-xl"
              >
                {updatingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar Senha"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
