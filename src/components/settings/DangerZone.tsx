import { useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/use-tenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const CONFIRM_PHRASE = "Tenho certeza que desejo limpar os dados de teste";

export function DangerZone() {
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [firstOpen, setFirstOpen] = useState(false);
  const [secondOpen, setSecondOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [loading, setLoading] = useState(false);

  const canConfirm = phrase.trim() === CONFIRM_PHRASE;

  const handleClear = async () => {
    if (!tenantId) {
      toast.error("Tenant não identificado");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("clear_barbershop_test_data" as any, {
        p_tenant_id: tenantId,
      });
      if (error) throw error;
      toast.success("Dados de teste limpos com sucesso!");
      setSecondOpen(false);
      setPhrase("");
      // Refresh everything
      await qc.invalidateQueries();
    } catch (err: any) {
      console.error("[DangerZone] clear failed", err);
      toast.error(err?.message || "Erro ao limpar dados de teste");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-950/40 to-[#0a0f1c] p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-red-500/15 p-2.5 border border-red-500/30">
          <AlertTriangle className="h-5 w-5 text-red-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white">Zona de Perigo</h3>
          <p className="text-sm text-slate-400 mt-1">
            Limpa <strong className="text-red-300">todos os dados operacionais</strong> desta barbearia
            (agendamentos, financeiro, cashback, créditos, fidelidade, comissões e consumo de assinaturas)
            para testes do zero.
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-black/40 border border-white/5 p-4 text-xs text-slate-400 space-y-2">
        <p className="text-green-400 font-semibold">✓ Mantidos:</p>
        <p>Clientes, assinantes, planos, serviços, barbeiros, configurações, módulos, integrações e chaves PIX/Stripe/Z-API.</p>
        <p className="text-red-400 font-semibold mt-2">✗ Removidos/Zerados:</p>
        <p>Agendamentos, transações, cashback, créditos, fidelidade, comissões, consumo de plano, histórico de uso.</p>
      </div>

      <Button
        variant="destructive"
        onClick={() => setFirstOpen(true)}
        className="w-full sm:w-auto gap-2 bg-red-600 hover:bg-red-700"
      >
        <Trash2 className="h-4 w-4" />
        Limpar dados de teste
      </Button>

      {/* First confirmation */}
      <AlertDialog open={firstOpen} onOpenChange={setFirstOpen}>
        <AlertDialogContent className="bg-[#0a0f1c] border-red-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Tem certeza?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Esta ação apagará <strong className="text-red-300">permanentemente</strong> todos os
              agendamentos, transações e histórico operacional desta barbearia.
              Clientes, assinaturas e configurações serão mantidos, mas todo o consumo será zerado.
              <br /><br />
              Esta ação <strong>não pode ser desfeita</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault();
                setFirstOpen(false);
                setTimeout(() => setSecondOpen(true), 150);
              }}
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Second confirmation - typed phrase */}
      <AlertDialog open={secondOpen} onOpenChange={(o) => { setSecondOpen(o); if (!o) setPhrase(""); }}>
        <AlertDialogContent className="bg-[#0a0f1c] border-red-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Confirmação final
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Para confirmar, digite exatamente a frase abaixo:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg bg-black/50 border border-red-500/20 p-3 font-mono text-sm text-red-300 select-all">
              {CONFIRM_PHRASE}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Digite a frase de confirmação</Label>
              <Input
                autoFocus
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                placeholder="Cole ou digite a frase acima"
                className="bg-black/40 border-white/10 text-white"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!canConfirm || loading}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-40"
              onClick={(e) => {
                e.preventDefault();
                handleClear();
              }}
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Limpando…</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-2" /> Limpar tudo</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
