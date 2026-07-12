import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, MapPin, Loader2 } from "lucide-react";

export const Route = createFileRoute("/$slug/checkin")({
  component: CheckinPage,
  head: () => ({
    meta: [
      { title: "Check-in — Barbex" },
      { name: "description", content: "Faça seu check-in ao chegar na barbearia." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function CheckinPage() {
  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const token = search.get("t") || "";
  const [shop, setShop] = useState<any>(null);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<any>(null);

  useEffect(() => {
    (async () => {
      if (!token) { setLoading(false); return; }
      const { data } = await (supabase.rpc as any)("get_barbershop_by_checkin_token", { _token: token });
      setShop(data);
      setLoading(false);
    })();
  }, [token]);

  const handleCheckin = async () => {
    if (!phone.trim()) { toast.error("Informe seu telefone"); return; }
    setSubmitting(true);
    const { data, error } = await (supabase.rpc as any)("perform_qr_checkin", { _token: token, _phone: phone });
    setSubmitting(false);
    if (error) { toast.error("Erro ao fazer check-in"); return; }
    if (!data?.ok) {
      const msg = data?.error === "no_appointment_today" ? "Nenhum agendamento encontrado para hoje"
        : data?.error === "customer_not_found" ? "Cliente não encontrado. Confira o telefone."
        : "Não foi possível fazer o check-in.";
      toast.error(msg);
      return;
    }
    setDone(data);
    toast.success("Check-in confirmado!");
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }
  if (!shop) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-black text-white">
        <Card><CardContent className="p-8 text-center">QR Code inválido ou expirado.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: `linear-gradient(135deg, #000, ${shop.primary_color || "#D4AF37"}22)` }}>
      <Card className="w-full max-w-md border-2" style={{ borderColor: shop.primary_color || "#D4AF37" }}>
        <CardHeader className="text-center">
          {shop.logo_url && <img src={shop.logo_url} alt={shop.business_name} className="w-20 h-20 mx-auto rounded-full object-cover mb-3" />}
          <CardTitle className="text-2xl">{shop.business_name}</CardTitle>
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-1"><MapPin className="w-3 h-3" /> Check-in de chegada</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {done ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-16 h-16 mx-auto mb-3" style={{ color: shop.primary_color || "#D4AF37" }} />
              <h2 className="text-xl font-bold">Check-in confirmado!</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Seu horário: {new Date(done.start_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-xs text-muted-foreground mt-4">Aguarde ser chamado. Bom atendimento!</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-center text-muted-foreground">Informe seu telefone cadastrado para confirmar seu agendamento de hoje.</p>
              <Input placeholder="(11) 99999-9999" value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" />
              <Button onClick={handleCheckin} disabled={submitting} className="w-full" style={{ background: shop.primary_color || "#D4AF37", color: "#000" }}>
                {submitting ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                Fazer Check-in
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
