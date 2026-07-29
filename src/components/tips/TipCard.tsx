import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Copy, QrCode, Heart, CheckCircle2 } from "lucide-react";

interface TipCardProps {
  token: string;
  barberName?: string | null;
  barberAvatar?: string | null;
  pixKey?: string | null;
  serviceAmount?: number;
}

const PRESETS = [5, 10, 20];

export function TipCard({ token, barberName, barberAvatar, pixKey, serviceAmount }: TipCardProps) {
  const [amount, setAmount] = useState<number>(0);
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!pixKey) return null;

  const setPreset = (v: number) => setAmount(v);
  const setPct = (p: number) => {
    if (!serviceAmount) return;
    setAmount(Math.round(serviceAmount * (p / 100) * 100) / 100);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pixKey);
      toast.success("Chave PIX copiada!");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const register = async () => {
    if (amount <= 0) {
      toast.error("Escolha um valor");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("register_pix_tip", {
        _token: token,
        _amount: amount,
        _note: undefined,
      });
      if (error) throw error;
      const res = data as any;
      if (!res?.success) {
        toast.error(res?.error || "Não foi possível registrar a gorjeta");
        return;
      }
      setSent(true);
      toast.success("Obrigado pela gorjeta! 🎉");
    } catch (e: any) {
      toast.error(e.message || "Erro ao registrar");
    } finally {
      setSaving(false);
    }
  };

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(pixKey)}&size=220x220&bgcolor=05070d&color=D4AF37&margin=8`;

  return (
    <div className="rounded-2xl border border-gold/30 bg-gradient-to-br from-[#0b0f17] to-black p-5 space-y-5">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 border border-gold/40">
          <AvatarImage src={barberAvatar || undefined} />
          <AvatarFallback className="bg-gold/20 text-gold font-black">
            {(barberName || "B").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gold font-bold">Gorjeta digital</p>
          <p className="text-white font-black">Agradecer {barberName || "o barbeiro"}</p>
        </div>
      </div>

      {sent ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center space-y-2">
          <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
          <p className="text-white font-bold">Gorjeta registrada</p>
          <p className="text-xs text-gray-400">
            Envie R$ {amount.toFixed(2)} via PIX para a chave copiada. O barbeiro receberá a confirmação.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((v) => (
              <button key={v} onClick={() => setPreset(v)}
                className={`rounded-xl border py-2.5 text-sm font-bold transition ${
                  amount === v ? "bg-gold text-black border-gold" : "border-white/10 text-gray-300 hover:border-gold/50"
                }`}>
                R$ {v}
              </button>
            ))}
          </div>
          {serviceAmount ? (
            <div className="grid grid-cols-3 gap-2">
              {[10, 15, 20].map((p) => (
                <button key={p} onClick={() => setPct(p)}
                  className="rounded-xl border border-white/10 text-gray-300 py-2 text-xs font-bold hover:border-gold/50 transition">
                  {p}% do serviço
                </button>
              ))}
            </div>
          ) : null}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-white/60">Outro valor</label>
            <Input type="number" step="0.5" min={0} value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="bg-black border-gold/30 text-white mt-1" />
          </div>
        </>
      )}

      <div className="rounded-xl border border-gold/20 bg-black/60 p-4 space-y-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-gold">
          <QrCode className="h-3 w-3" /> Chave PIX
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 truncate text-sm text-white font-mono bg-black/60 border border-white/10 rounded-lg px-3 py-2">
            {pixKey}
          </div>
          <Button variant="outline" size="sm" onClick={copy}
            className="rounded-lg border-gold/50 text-gold hover:bg-gold/10">
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex justify-center">
          <img src={qrUrl} alt="QR PIX" width={180} height={180}
            className="rounded-xl border border-gold/30" />
        </div>
      </div>

      {!sent && (
        <Button onClick={register} disabled={saving || amount <= 0}
          className="w-full h-12 bg-gold hover:bg-[#B8962E] text-black font-black">
          <Heart className="h-4 w-4 mr-2" />
          {saving ? "Registrando..." : `Confirmar gorjeta de R$ ${amount.toFixed(2)}`}
        </Button>
      )}
    </div>
  );
}
