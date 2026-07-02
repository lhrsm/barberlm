import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhone } from "@/utils/phone";
import { toast } from "sonner";
import { Crown, CheckCircle2, Loader2, ShieldAlert, ArrowRight } from "lucide-react";
import { PhoneInput } from "react-international-phone";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useServerFn } from "@tanstack/react-start";
import { createCustomerSubscription } from "@/lib/payments/subscriptions.functions";

// Providers com checkout online funcional (via createCustomerSubscription).
// Os demais caem no fluxo manual (WhatsApp).
const ONLINE_CHECKOUT_PROVIDERS = new Set(["mercadopago"]);

interface Props {
  open: boolean;
  onClose: () => void;
  plan: any | null;
  tenantId: string;
  slug: string;
  defaultName?: string;
  defaultPhone?: string;
}

type Step = "form" | "duplicate" | "success" | "pending";

export function SubscribePlanModal({ open, onClose, plan, tenantId, slug, defaultName = "", defaultPhone = "" }: Props) {
  const startCheckout = useServerFn(createCustomerSubscription);
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptWhatsApp, setAcceptWhatsApp] = useState(true);
  const [acceptMarketing, setAcceptMarketing] = useState(false);
  const [gateway, setGateway] = useState<string | null>(null);
  const [existingCustomerId, setExistingCustomerId] = useState<string | null>(null);
  const [planServices, setPlanServices] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;
    setStep("form");
    setName(defaultName);
    setPhone(defaultPhone);
    setEmail("");
    setCpf("");
    setBirthDate("");
    setAcceptTerms(false);
    setAcceptPrivacy(false);
    setAcceptWhatsApp(true);
    setAcceptMarketing(false);
    setExistingCustomerId(null);
  }, [open, defaultName, defaultPhone]);

  // Load active gateway and plan services
  useEffect(() => {
    if (!open || !tenantId || !plan?.id) return;
    (async () => {
      const [gwRes, svcRes] = await Promise.all([
        supabase.from("payment_gateways").select("provider, is_active, is_default").eq("tenant_id", tenantId).eq("is_active", true).order("is_default", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("subscription_plan_services").select("service:services(id, name)").eq("plan_id", plan.id),
      ]);
      setGateway((gwRes.data as any)?.provider || null);
      setPlanServices(((svcRes.data || []) as any[]).map((r: any) => r.service).filter(Boolean));
    })();
  }, [open, tenantId, plan?.id]);

  // Lookup existing customer as user types phone
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!tenantId || !phone || phone.length < 10) { setExistingCustomerId(null); return; }
      const normalized = normalizePhone(phone);
      const { data } = await supabase
        .from("customers")
        .select("id, name, email")
        .eq("tenant_id", tenantId)
        .eq("phone", normalized)
        .maybeSingle();
      if (data) {
        setExistingCustomerId(data.id);
        if (!name && data.name) setName(data.name);
        if (!email && data.email) setEmail(data.email);
      } else {
        setExistingCustomerId(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [phone, tenantId]);

  if (!plan) return null;

  const firstBilling = new Date();
  const nextRenewal = addDays(firstBilling, 30);

  const submit = async () => {
    if (!name.trim()) return toast.error("Informe seu nome completo");
    if (!phone || phone.length < 10) return toast.error("Informe um WhatsApp válido");
    if (!email.trim() || !email.includes("@")) return toast.error("Informe um e-mail válido");
    if (!acceptTerms || !acceptPrivacy || !acceptWhatsApp) return toast.error("Você precisa aceitar os termos obrigatórios");

    setLoading(true);
    try {
      const normalizedPhone = normalizePhone(phone);
      let customerId = existingCustomerId;

      if (customerId) {
        // Check for existing active subscription
        const { data: activeSub } = await supabase
          .from("customer_subscriptions")
          .select("id, status")
          .eq("tenant_id", tenantId)
          .eq("customer_id", customerId)
          .in("status", ["active", "trialing", "past_due", "pending"])
          .maybeSingle();
        if (activeSub) {
          setStep("duplicate");
          setLoading(false);
          return;
        }
        // Update customer info
        await supabase.from("customers").update({
          name: name.trim(),
          email: email.trim(),
          birth_date: birthDate || null,
          allow_marketing: acceptMarketing,
          allow_notifications: acceptWhatsApp,
          privacy_accepted_at: new Date().toISOString(),
          terms_accepted_at: new Date().toISOString(),
        }).eq("id", customerId);
      } else {
        const { data: created, error } = await supabase.from("customers").insert({
          tenant_id: tenantId,
          name: name.trim(),
          phone: normalizedPhone,
          email: email.trim(),
          birth_date: birthDate || null,
          allow_marketing: acceptMarketing,
          allow_notifications: acceptWhatsApp,
          privacy_accepted_at: new Date().toISOString(),
          terms_accepted_at: new Date().toISOString(),
        } as any).select("id").single();
        if (error) throw error;
        customerId = created.id;
      }

      // Se o gateway ativo suporta checkout online → cria via server function
      // (valida cliente, cria preapproval no provider e redireciona).
      if (gateway && ONLINE_CHECKOUT_PROVIDERS.has(gateway)) {
        // Garante client_auth pra passar na validação do server fn
        try {
          const { data: existingAuth } = await supabase
            .from("client_auth")
            .select("customer_id")
            .eq("phone", normalizedPhone)
            .maybeSingle();
          if (!existingAuth) {
            await supabase.from("client_auth").insert({ phone: normalizedPhone, customer_id: customerId } as any);
          }
        } catch { /* non-fatal — server fn falhará se realmente inválido */ }

        const returnUrl = `${window.location.origin}/${slug}/portal?subscribed=1`;
        const result = await startCheckout({
          data: {
            tenantId,
            planId: plan.id,
            phone: normalizedPhone,
            email: email.trim(),
            returnUrl,
          },
        });

        if (result?.checkoutUrl) {
          // Redireciona pro checkout do provider (Mercado Pago hospedado)
          window.location.href = result.checkoutUrl;
          return;
        }
        throw new Error("Gateway não devolveu URL de checkout");
      }

      // Fluxo manual (sem gateway online): registra pending e avisa admin
      const now = new Date();
      const { error: subErr } = await supabase.from("customer_subscriptions").insert({
        tenant_id: tenantId,
        customer_id: customerId,
        plan_id: plan.id,
        status: "pending",
        payment_method: gateway || "manual",
        started_at: now.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: nextRenewal.toISOString(),
        next_billing_at: nextRenewal.toISOString(),
        auto_renew: true,
        metadata: {
          source: "public_frontend",
          cpf: cpf || null,
          gateway: gateway || null,
          consents: {
            terms: true,
            privacy: true,
            whatsapp: acceptWhatsApp,
            marketing: acceptMarketing,
          },
        },
      });
      if (subErr) throw subErr;

      try {
        await supabase.from("admin_notifications").insert({
          tenant_id: tenantId,
          type: "new_subscription_request",
          title: `Nova solicitação de assinatura: ${plan.name}`,
          message: `${name} solicitou o plano ${plan.name} (R$ ${Number(plan.monthly_price || 0).toFixed(2)}/mês). Confirme o pagamento para ativar.`,
          severity: "info",
        } as any);
      } catch { /* non-fatal */ }

      setStep(gateway ? "pending" : "success");
    } catch (err: any) {
      console.error("[SubscribePlanModal] error:", err);
      toast.error(err?.message || "Não foi possível processar sua assinatura");
    } finally {
      setLoading(false);
    }
  };

  const goToPortal = () => {
    onClose();
    window.location.href = `/${slug}/portal?phone=${encodeURIComponent(normalizePhone(phone))}`;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-gradient-to-br from-zinc-950 to-black border-2 border-[#D4AF37]/30 text-white p-0 max-h-[92vh] overflow-y-auto">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#D4AF37]/10">
          <div className="flex items-center gap-2 text-[#D4AF37] text-xs font-black uppercase tracking-[0.3em] mb-2">
            <Crown size={14} /> Clube Premium
          </div>
          <DialogTitle className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white">
            {step === "duplicate" ? "Você já é assinante" : step === "success" ? "Assinatura registrada!" : step === "pending" ? "Aguardando pagamento" : "Assinar Plano"}
          </DialogTitle>
          {step === "form" && (
            <p className="text-sm text-slate-400 mt-1">Informe seus dados para continuar com a assinatura.</p>
          )}
        </DialogHeader>

        <div className="px-6 py-5 space-y-5">
          {step === "form" && (
            <>
              {/* Plan summary */}
              <div className="rounded-2xl border border-[#D4AF37]/30 bg-gradient-to-br from-[#D4AF37]/10 to-transparent p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h4 className="text-xl font-black uppercase tracking-tight text-white">{plan.name}</h4>
                    {plan.description && <p className="text-xs text-slate-400 mt-1">{plan.description}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-3xl font-black text-[#D4AF37] leading-none">R$ {Number(plan.monthly_price || 0).toFixed(2)}</div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 mt-1">/mês</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {plan.max_uses_per_month != null && (
                    <div><span className="text-slate-500 block">Utilizações</span><span className="text-white font-bold">Até {plan.max_uses_per_month}/mês</span></div>
                  )}
                  <div><span className="text-slate-500 block">1ª cobrança</span><span className="text-white font-bold">{format(firstBilling, "dd/MM/yyyy", { locale: ptBR })}</span></div>
                  <div><span className="text-slate-500 block">Próxima renovação</span><span className="text-white font-bold">{format(nextRenewal, "dd/MM/yyyy", { locale: ptBR })}</span></div>
                  <div><span className="text-slate-500 block">Pagamento</span><span className="text-white font-bold capitalize">{gateway || "A combinar"}</span></div>
                </div>
                {planServices.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[#D4AF37]/10">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Serviços inclusos</div>
                    <div className="flex flex-wrap gap-1.5">
                      {planServices.map((s: any) => (
                        <span key={s.id} className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300">{s.name}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Form fields */}
              <div className="grid gap-3">
                <div>
                  <Label className="text-xs uppercase tracking-widest text-slate-400">Nome completo *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white/5 border-white/10 text-white mt-1 h-11" placeholder="Seu nome" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-widest text-slate-400">WhatsApp *</Label>
                  <div className="mt-1">
                    <PhoneInput defaultCountry="br" value={phone} onChange={setPhone} inputClassName="!w-full !h-11 !bg-white/5 !border-white/10 !text-white !rounded-md" countrySelectorStyleProps={{ buttonClassName: "!h-11 !bg-white/5 !border-white/10" }} />
                  </div>
                  {existingCustomerId && <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1"><CheckCircle2 size={12} /> Cliente identificado — vamos vincular à sua conta.</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs uppercase tracking-widest text-slate-400">E-mail *</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-white/5 border-white/10 text-white mt-1 h-11" placeholder="voce@email.com" />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-widest text-slate-400">CPF <span className="text-slate-600">(opcional)</span></Label>
                    <Input value={cpf} onChange={(e) => setCpf(e.target.value)} className="bg-white/5 border-white/10 text-white mt-1 h-11" placeholder="000.000.000-00" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-widest text-slate-400">Data de nascimento <span className="text-slate-600">(opcional)</span></Label>
                  <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="bg-white/5 border-white/10 text-white mt-1 h-11" />
                </div>
              </div>

              {/* Consents */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer">
                  <Checkbox checked={acceptTerms} onCheckedChange={(v) => setAcceptTerms(!!v)} className="mt-0.5 border-white/30" />
                  <span>Li e aceito os <a href="/terms" target="_blank" className="text-[#D4AF37] underline">Termos de Uso</a> *</span>
                </label>
                <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer">
                  <Checkbox checked={acceptPrivacy} onCheckedChange={(v) => setAcceptPrivacy(!!v)} className="mt-0.5 border-white/30" />
                  <span>Li e aceito a <a href="/privacy" target="_blank" className="text-[#D4AF37] underline">Política de Privacidade</a> *</span>
                </label>
                <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer">
                  <Checkbox checked={acceptWhatsApp} onCheckedChange={(v) => setAcceptWhatsApp(!!v)} className="mt-0.5 border-white/30" />
                  <span>Aceito receber mensagens operacionais sobre minha assinatura no WhatsApp *</span>
                </label>
                <label className="flex items-start gap-2 text-xs text-slate-400 cursor-pointer">
                  <Checkbox checked={acceptMarketing} onCheckedChange={(v) => setAcceptMarketing(!!v)} className="mt-0.5 border-white/30" />
                  <span>Aceito receber promoções e campanhas (opcional)</span>
                </label>
              </div>

              <div className="flex flex-col-reverse md:flex-row items-stretch md:items-center justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={onClose} disabled={loading} className="text-slate-400 hover:text-white">Cancelar</Button>
                <Button onClick={submit} disabled={loading} className="bg-[#D4AF37] text-black font-black uppercase tracking-wider hover:bg-[#D4AF37]/90 h-12 px-8">
                  {loading ? <><Loader2 size={16} className="animate-spin mr-2" /> Processando...</> : <>Continuar para pagamento <ArrowRight size={16} className="ml-2" /></>}
                </Button>
              </div>
            </>
          )}

          {step === "duplicate" && (
            <div className="text-center py-6 space-y-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <ShieldAlert className="text-amber-400" size={26} />
              </div>
              <p className="text-slate-300">Você já possui uma assinatura ativa nesta barbearia.</p>
              <div className="flex flex-col md:flex-row gap-2 justify-center">
                <Button onClick={goToPortal} className="bg-[#D4AF37] text-black font-black uppercase tracking-wider hover:bg-[#D4AF37]/90">Ver meu plano</Button>
                <Button variant="outline" onClick={onClose} className="border-white/10 text-white hover:bg-white/5">Fechar</Button>
              </div>
            </div>
          )}

          {(step === "success" || step === "pending") && (
            <div className="text-center py-6 space-y-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="text-emerald-400" size={26} />
              </div>
              <div>
                <p className="text-white font-bold text-lg">
                  {step === "pending" ? "Assinatura aguardando confirmação de pagamento" : "Assinatura registrada com sucesso!"}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  {step === "pending"
                    ? "A barbearia entrará em contato pelo WhatsApp para finalizar o pagamento. Seus benefícios serão liberados assim que confirmado."
                    : "A barbearia entrará em contato pelo WhatsApp para combinar a forma de pagamento e ativar seus benefícios."}
                </p>
              </div>
              <div className="flex flex-col md:flex-row gap-2 justify-center">
                <Button onClick={goToPortal} className="bg-[#D4AF37] text-black font-black uppercase tracking-wider hover:bg-[#D4AF37]/90">Ir para meu portal</Button>
                <Button variant="outline" onClick={onClose} className="border-white/10 text-white hover:bg-white/5">Fechar</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
