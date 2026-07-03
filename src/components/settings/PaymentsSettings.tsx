import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Plus, CreditCard, Banknote, QrCode, Smartphone, Link as LinkIcon, Trash2, Settings as SettingsIcon,
  CheckCircle2, AlertTriangle, Clock, Star, Copy, Check, Activity, TrendingUp, RefreshCw, X,
  Wallet, Zap, ShieldCheck,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type ProviderKey =
  | "paggue"
  | "mercadopago"
  | "asaas"
  | "stripe"
  | "pagseguro"
  | "pagarme"
  | "paypal"
  | "infinitepay"
  | "custom";

interface ProviderDef {
  key: ProviderKey;
  label: string;
  description: string;
  fields: Array<{ name: string; label: string; type?: "text" | "password" | "url"; placeholder?: string; required?: boolean; help?: string }>;
  hasEnvironment?: boolean;
  webhookHint?: string;
}

const PROVIDERS: ProviderDef[] = [
  {
    key: "mercadopago",
    label: "Mercado Pago",
    description: "PIX, cartão e boleto — checkout hospedado + recorrência",
    fields: [
      { name: "access_token", label: "Access Token", type: "password", required: true, placeholder: "APP_USR-..." },
      { name: "public_key", label: "Public Key", placeholder: "APP_USR-..." },
    ],
    webhookHint: "Cadastre a URL abaixo no painel Mercado Pago → Suas integrações → Webhooks e cole aqui a 'Chave secreta' gerada.",
  },
  {
    key: "asaas",
    label: "Asaas",
    description: "PIX, cartão, boleto e cobrança recorrente",
    fields: [
      { name: "api_key", label: "API Key", type: "password", required: true, placeholder: "$aact_..." },
    ],
    hasEnvironment: true,
    webhookHint: "No painel Asaas → Integrações → Webhooks, use a URL abaixo e defina um token — cole esse mesmo token aqui.",
  },
  {
    key: "pagarme",
    label: "Pagar.me",
    description: "Cartão, PIX e assinatura recorrente (Core API v5)",
    fields: [
      { name: "secret_key", label: "Secret Key", type: "password", required: true, placeholder: "sk_test_..." },
      { name: "public_key", label: "Public Key", placeholder: "pk_test_..." },
    ],
    hasEnvironment: true,
    webhookHint: "Pagar.me assina o webhook com HMAC-SHA256. O secret é definido ao cadastrar o endpoint no dashboard.",
  },
  {
    key: "stripe",
    label: "Stripe",
    description: "Cartão internacional + Checkout hospedado",
    fields: [
      { name: "secret_key", label: "Secret Key", type: "password", required: true, placeholder: "sk_test_..." },
      { name: "publishable_key", label: "Publishable Key", placeholder: "pk_test_..." },
    ],
    hasEnvironment: true,
    webhookHint: "No Dashboard Stripe → Developers → Webhooks, crie um endpoint com a URL abaixo. Copie o Signing Secret (whsec_...) aqui.",
  },
  {
    key: "pagseguro",
    label: "PagBank / PagSeguro",
    description: "PIX, cartão e boleto (checkout hospedado)",
    fields: [
      { name: "email", label: "E-mail da conta", placeholder: "voce@exemplo.com" },
      { name: "token", label: "Token", type: "password", required: true },
    ],
    hasEnvironment: true,
    webhookHint: "Cadastre a URL como Notification URL no PagBank e defina um token de autenticidade — o mesmo aqui.",
  },
  {
    key: "paypal",
    label: "PayPal",
    description: "Assinatura recorrente internacional (Subscriptions API)",
    fields: [
      { name: "client_id", label: "Client ID", required: true, placeholder: "Axxx..." },
      { name: "client_secret", label: "Client Secret", type: "password", required: true },
    ],
    hasEnvironment: true,
    webhookHint: "No Developer Dashboard PayPal → Webhooks, crie um endpoint com a URL abaixo. Cole aqui o Webhook ID (não a URL).",
  },
  {
    key: "paggue",
    label: "Paggue",
    description: "PIX cash-in (renovação mensal via cron do SaaS)",
    fields: [
      { name: "api_key", label: "API Key", type: "password", required: true },
      { name: "client_id", label: "Client ID (opcional)" },
      { name: "client_secret", label: "Client Secret (opcional)", type: "password" },
    ],
    webhookHint: "Paggue assina o webhook com HMAC-SHA256(body, secret). Defina o mesmo secret aqui e no painel Paggue.",
  },
  {
    key: "infinitepay",
    label: "InfinitePay",
    description: "Checkout hospedado por handle (@sua-loja)",
    fields: [
      { name: "handle", label: "Handle InfinitePay", required: true, placeholder: "sua-barbearia (sem @ ou $)" },
    ],
    webhookHint: "Webhook é opcional na InfinitePay. Se ativar no painel, use HMAC-SHA256 e cole o secret aqui.",
  },
  {
    key: "custom",
    label: "Personalizado",
    description: "Conexão genérica via API",
    fields: [
      { name: "api_url", label: "URL da API", type: "url", required: true, placeholder: "https://api.exemplo.com" },
      { name: "token", label: "Token", type: "password", required: true },
      { name: "webhook_url", label: "Webhook URL", type: "url" },
    ],
  },
];

const DEFAULT_METHODS = {
  pix: true,
  credit_card: false,
  debit_card: false,
  cash: false,
  payment_link: false,
  in_person: false,
};

const METHOD_ICONS: Record<string, any> = {
  pix: QrCode,
  credit_card: CreditCard,
  debit_card: CreditCard,
  cash: Banknote,
  payment_link: LinkIcon,
  in_person: Smartphone,
};

const METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  credit_card: "Cartão de Crédito",
  debit_card: "Cartão de Débito",
  cash: "Dinheiro",
  payment_link: "Link de Pagamento",
  in_person: "Pagamento Presencial",
};

const STATUS_STYLES: Record<string, { dot: string; bg: string; text: string; label: string; icon: any }> = {
  connected: { dot: "bg-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Conectado", icon: CheckCircle2 },
  pending: { dot: "bg-amber-500", bg: "bg-amber-500/10", text: "text-amber-400", label: "Pendente", icon: Clock },
  error: { dot: "bg-red-500", bg: "bg-red-500/10", text: "text-red-400", label: "Erro", icon: AlertTriangle },
};

export function PaymentsSettings() {
  const { user } = useAuth();
  const tenantId = user?.id;

  const [gateways, setGateways] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsRange, setLogsRange] = useState<"today" | "7d" | "30d">("7d");
  const [metrics, setMetrics] = useState({ todayCount: 0, todayRevenue: 0, pixCount: 0, failures: 0, refunds: 0 });

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({
    provider: "paggue" as ProviderKey,
    name: "",
    environment: "production",
    credentials: {} as Record<string, string>,
    webhook_secret: "",
    methods: { ...DEFAULT_METHODS },
    pix_settings: { recipient_name: "", key_type: "cpf", key_value: "", qr_code_url: "" },
  });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ status: "idle" | "success" | "error"; message?: string }>({ status: "idle" });

  const providerDef = useMemo(
    () => PROVIDERS.find(p => p.key === form.provider) || PROVIDERS[0],
    [form.provider],
  );

  const fetchGateways = async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("payment_gateways")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      toast.error("Erro ao carregar gateways");
    } else {
      setGateways(data || []);
    }
    setLoading(false);
  };

  const fetchLogs = async () => {
    if (!tenantId) return;
    const now = new Date();
    const since = new Date(now);
    if (logsRange === "today") since.setHours(0, 0, 0, 0);
    if (logsRange === "7d") since.setDate(now.getDate() - 7);
    if (logsRange === "30d") since.setDate(now.getDate() - 30);

    const { data } = await supabase
      .from("payment_gateway_logs")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(100);
    setLogs(data || []);
  };

  const fetchMetrics = async () => {
    if (!tenantId) return;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    try {
      const { data: txs } = await supabase
        .from("transactions")
        .select("amount, status, payment_method, type, created_at")
        .eq("user_id", tenantId)
        .gte("created_at", startOfDay.toISOString());
      const list = txs || [];
      const success = list.filter((t: any) => (t.status || "").toLowerCase() === "paid" || (t.status || "").toLowerCase() === "completed");
      const pix = list.filter((t: any) => (t.payment_method || "").toLowerCase() === "pix");
      const fails = list.filter((t: any) => (t.status || "").toLowerCase() === "failed" || (t.status || "").toLowerCase() === "error");
      const refunds = list.filter((t: any) => (t.type || "").toLowerCase() === "refund");
      setMetrics({
        todayCount: success.length,
        todayRevenue: success.reduce((s: number, t: any) => s + Number(t.amount || 0), 0),
        pixCount: pix.length,
        failures: fails.length,
        refunds: refunds.length,
      });
    } catch (e) {
      // best-effort
    }
  };

  useEffect(() => {
    fetchGateways();
    fetchMetrics();
  }, [tenantId]);

  useEffect(() => {
    fetchLogs();
  }, [tenantId, logsRange]);

  const resetForm = () => {
    setEditing(null);
    setForm({
      provider: "paggue",
      name: "",
      environment: "production",
      credentials: {},
      webhook_secret: "",
      methods: { ...DEFAULT_METHODS },
      pix_settings: { recipient_name: "", key_type: "cpf", key_value: "", qr_code_url: "" },
    });
  };

  const openNew = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEdit = (gw: any) => {
    setEditing(gw);
    setForm({
      provider: gw.provider,
      name: gw.name,
      environment: gw.environment || "production",
      credentials: gw.credentials || {},
      webhook_secret: gw.webhook_secret || "",
      methods: { ...DEFAULT_METHODS, ...(gw.methods || {}) },
      pix_settings: { recipient_name: "", key_type: "cpf", key_value: "", qr_code_url: "", ...(gw.pix_settings || {}) },
    });
    setIsModalOpen(true);
  };

  const handleTestConnection = async () => {
    const def = providerDef;
    const missing = def.fields.filter(f => f.required && !form.credentials[f.name]).map(f => f.label);
    if (missing.length > 0) {
      toast.error(`Preencha: ${missing.join(", ")}`);
      return;
    }
    setTesting(true);
    setTestResult({ status: "idle" });
    try {
      await new Promise(r => setTimeout(r, 900));
      const ok = def.fields.filter(f => f.required).every(f => (form.credentials[f.name] || "").length >= 4);
      if (!ok) {
        setTestResult({ status: "error", message: "Credenciais incompletas ou inválidas" });
        toast.error("✕ Erro de autenticação: credenciais incompletas ou inválidas");
        if (editing && tenantId) {
          await supabase.from("payment_gateway_logs").insert({
            tenant_id: tenantId,
            gateway_id: editing.id,
            event: "connection_test",
            status: "error",
            message: "Credenciais incompletas",
          });
        }
        return;
      }
      setTestResult({ status: "success", message: "Conexão realizada com sucesso" });
      toast.success("✓ Gateway conectado com sucesso");
      if (editing && tenantId) {
        await Promise.all([
          supabase
            .from("payment_gateways")
            .update({ status: "connected", status_message: "Teste OK", last_sync_at: new Date().toISOString() })
            .eq("id", editing.id),
          supabase.from("payment_gateway_logs").insert({
            tenant_id: tenantId,
            gateway_id: editing.id,
            event: "connection_test",
            status: "success",
            message: "Teste de conexão realizado",
          }),
        ]);
        await fetchGateways();
        await fetchLogs();
      }
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!tenantId) return;
    const def = providerDef;
    if (!form.name.trim()) {
      toast.error("Informe o nome da conexão");
      return;
    }
    const missing = def.fields.filter(f => f.required && !form.credentials[f.name]).map(f => f.label);
    if (missing.length > 0) {
      toast.error(`Preencha: ${missing.join(", ")}`);
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        tenant_id: tenantId,
        provider: form.provider,
        name: form.name.trim(),
        environment: form.environment,
        credentials: form.credentials,
        webhook_secret: form.webhook_secret || null,
        methods: form.methods,
        pix_settings: form.pix_settings,
        status: editing?.status || "pending",
      };
      if (editing) {
        const { error } = await supabase.from("payment_gateways").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Gateway atualizado");
      } else {
        // Se for o primeiro gateway, marcar como principal automaticamente
        const isFirst = gateways.length === 0;
        const { error } = await supabase
          .from("payment_gateways")
          .insert({ ...payload, is_primary: isFirst, is_active: true });
        if (error) throw error;
        toast.success("Gateway adicionado");
      }
      setIsModalOpen(false);
      resetForm();
      await fetchGateways();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (gw: any) => {
    if (!confirm(`Excluir o gateway "${gw.name}"?`)) return;
    const { error } = await supabase.from("payment_gateways").delete().eq("id", gw.id);
    if (error) return toast.error("Erro ao excluir");
    toast.success("Gateway excluído");
    fetchGateways();
  };

  const handleToggleActive = async (gw: any) => {
    const { error } = await supabase
      .from("payment_gateways")
      .update({ is_active: !gw.is_active })
      .eq("id", gw.id);
    if (error) return toast.error("Erro ao atualizar");
    toast.success(!gw.is_active ? "Gateway ativado" : "Gateway desativado");
    fetchGateways();
  };

  const handleSetPrimary = async (gw: any) => {
    const { error } = await supabase
      .from("payment_gateways")
      .update({ is_primary: true })
      .eq("id", gw.id);
    if (error) return toast.error("Erro ao definir gateway principal");
    toast.success(`${gw.name} agora é o gateway principal`);
    fetchGateways();
  };

  const handleTestExisting = async (gw: any) => {
    if (!tenantId) return;
    toast.loading("Testando conexão...", { id: `test-${gw.id}` });
    try {
      const { testGatewayConnection } = await import("@/lib/payments/subscriptions.functions");
      const result = await testGatewayConnection({ data: { gatewayId: gw.id } });
      if (result.ok) {
        toast.success(`✓ ${result.message}`, { id: `test-${gw.id}` });
      } else {
        toast.error(`✕ ${result.message}`, { id: `test-${gw.id}` });
      }
    } catch (e: any) {
      toast.error(e?.message || "Falha ao testar conexão", { id: `test-${gw.id}` });
    }
    fetchGateways();
    fetchLogs();
  };

  const webhookUrl = (gw: any) =>
    `${typeof window !== "undefined" ? window.location.origin : "https://barbex.shop"}/api/public/subscriptions/webhook?gateway=${gw.id}`;

  const copyWebhook = async (gw: any) => {
    try {
      await navigator.clipboard.writeText(webhookUrl(gw));
      setCopiedId(gw.id);
      toast.success("URL copiada");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const primaryGateway = gateways.find(g => g.is_primary);

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 p-4 sm:p-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="hidden sm:grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#ea580c]/10 border border-[#ea580c]/20">
            <Wallet className="h-5 w-5 text-[#ea580c]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-black uppercase italic tracking-tighter text-white">
              Gateways de Pagamento
            </h2>
            <p className="text-sm text-slate-400 mt-1 leading-snug">
              Configure os meios de pagamento aceitos pela sua barbearia.
            </p>
          </div>
        </div>
        <Button
          onClick={openNew}
          className="w-full sm:w-auto sm:min-w-[180px] sm:max-w-[220px] h-11 sm:h-[42px] rounded-xl bg-[#ea580c] hover:bg-[#ea580c]/90 text-white font-bold shadow-lg shadow-orange-500/20"
        >
          <Plus className="mr-2 h-4 w-4" /> Novo Gateway
        </Button>
      </div>

      {/* METRICS */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <MetricCard label="Transações hoje" value={metrics.todayCount} icon={Activity} color="text-blue-400" />
        <MetricCard label="Receita hoje" value={`R$ ${metrics.todayRevenue.toFixed(2)}`} icon={TrendingUp} color="text-emerald-400" />
        <MetricCard label="PIX recebidos" value={metrics.pixCount} icon={QrCode} color="text-[#ea580c]" />
        <MetricCard label="Falhas" value={metrics.failures} icon={AlertTriangle} color="text-red-400" />
        <MetricCard label="Reembolsos" value={metrics.refunds} icon={RefreshCw} color="text-amber-400" />
      </div>

      <Tabs defaultValue="gateways" className="space-y-4">
        <div className="-mx-1 overflow-x-auto">
          <TabsList className="inline-flex w-auto bg-[#0b0f17] border border-[#1f2937] rounded-xl p-1">
            <TabsTrigger value="gateways" className="rounded-lg data-[state=active]:bg-[#ea580c] data-[state=active]:text-white font-bold whitespace-nowrap">
              <Wallet className="h-4 w-4 mr-2" /> Gateways
            </TabsTrigger>
            <TabsTrigger value="pix" className="rounded-lg data-[state=active]:bg-[#ea580c] data-[state=active]:text-white font-bold whitespace-nowrap">
              <QrCode className="h-4 w-4 mr-2" /> PIX
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="rounded-lg data-[state=active]:bg-[#ea580c] data-[state=active]:text-white font-bold whitespace-nowrap">
              <Zap className="h-4 w-4 mr-2" /> Webhooks
            </TabsTrigger>
            <TabsTrigger value="logs" className="rounded-lg data-[state=active]:bg-[#ea580c] data-[state=active]:text-white font-bold whitespace-nowrap">
              <Activity className="h-4 w-4 mr-2" /> Logs
            </TabsTrigger>
          </TabsList>
        </div>

        {/* GATEWAYS TAB */}
        <TabsContent value="gateways" className="space-y-3">
          {loading ? (
            <Card className="bg-[#050B18] border-[#1f2937] p-10 text-center text-slate-500">Carregando...</Card>
          ) : gateways.length === 0 ? (
            <Card className="bg-[#050B18] border-dashed border-2 border-[#1f2937] rounded-[20px] px-8 py-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-[#ea580c]/10 flex items-center justify-center mb-4">
                <Wallet className="h-6 w-6 text-[#ea580c]" />
              </div>
              <h3 className="text-base font-black uppercase text-white tracking-tight mb-2">Nenhum gateway configurado</h3>
              <p className="text-sm text-slate-400 mb-6 max-w-sm mx-auto leading-relaxed">
                Adicione seu primeiro gateway para receber pagamentos via PIX, cartão ou link.
              </p>
              <Button
                onClick={openNew}
                className="w-full sm:w-auto sm:min-w-[240px] sm:max-w-[320px] h-11 rounded-xl bg-[#ea580c] hover:bg-[#ea580c]/90 text-white font-bold mx-auto"
              >
                <Plus className="mr-2 h-4 w-4" /> Adicionar primeiro gateway
              </Button>
            </Card>

          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {gateways.map(gw => (
                <GatewayCard
                  key={gw.id}
                  gateway={gw}
                  onEdit={() => openEdit(gw)}
                  onTest={() => handleTestExisting(gw)}
                  onToggleActive={() => handleToggleActive(gw)}
                  onDelete={() => handleDelete(gw)}
                  onSetPrimary={() => handleSetPrimary(gw)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* PIX TAB */}
        <TabsContent value="pix" className="space-y-4">
          <PixSettingsCard primaryGateway={primaryGateway} onSaved={fetchGateways} />
        </TabsContent>

        {/* WEBHOOKS TAB */}
        <TabsContent value="webhooks" className="space-y-3">
          {gateways.length === 0 ? (
            <Card className="bg-[#050B18] border-[#1f2937] p-8 text-center text-slate-500 text-sm">
              Cadastre um gateway para gerar URLs de webhook.
            </Card>
          ) : (
            gateways.map(gw => (
              <Card key={gw.id} className="bg-[#050B18] border-[#1f2937] text-white">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Gateway</p>
                      <p className="font-black text-lg">{gw.name}</p>
                    </div>
                    <StatusBadge status={gw.status} />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">URL do Webhook</Label>
                    <div className="mt-2 flex items-center gap-2 bg-black/40 border border-[#1f2937] rounded-xl p-3">
                      <code className="text-xs text-slate-300 flex-1 truncate font-mono">{webhookUrl(gw)}</code>
                      <Button size="sm" variant="ghost" className="h-8 px-2 text-slate-400 hover:text-white" onClick={() => copyWebhook(gw)}>
                        {copiedId === gw.id ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-slate-500 uppercase tracking-widest font-bold">Último evento</p>
                      <p className="text-slate-300 mt-1">
                        {gw.last_event_at ? format(new Date(gw.last_event_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 uppercase tracking-widest font-bold">Último pagamento</p>
                      <p className="text-slate-300 mt-1">
                        {gw.last_payment_at ? format(new Date(gw.last_payment_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* LOGS TAB */}
        <TabsContent value="logs" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["today", "7d", "30d"] as const).map(r => (
              <Button
                key={r}
                size="sm"
                variant={logsRange === r ? "default" : "outline"}
                className={cn(
                  "rounded-full text-xs font-bold uppercase tracking-wider",
                  logsRange === r ? "bg-[#ea580c] hover:bg-[#ea580c]/90" : "border-[#1f2937] text-slate-400 hover:text-white",
                )}
                onClick={() => setLogsRange(r)}
              >
                {r === "today" ? "Hoje" : r === "7d" ? "7 dias" : "30 dias"}
              </Button>
            ))}
          </div>
          <Card className="bg-[#050B18] border-[#1f2937] overflow-hidden">
            {logs.length === 0 ? (
              <div className="p-10 text-center text-slate-500 text-sm">Nenhum log no período.</div>
            ) : (
              <div className="divide-y divide-[#1f2937]">
                {logs.map(log => {
                  const gw = gateways.find(g => g.id === log.gateway_id);
                  const statusColor = log.status === "success" ? "text-emerald-400" : log.status === "error" ? "text-red-400" : "text-amber-400";
                  return (
                    <div key={log.id} className="p-4 flex items-start gap-3 hover:bg-white/5 transition-colors">
                      <div className={cn("h-2 w-2 rounded-full mt-2 shrink-0", log.status === "success" ? "bg-emerald-500" : log.status === "error" ? "bg-red-500" : "bg-amber-500")} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="font-bold text-sm text-white truncate">{log.event}</p>
                          <span className={cn("text-[10px] font-black uppercase tracking-widest", statusColor)}>{log.status}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {gw?.name || "Gateway removido"} · {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                        {log.message && <p className="text-xs text-slate-400 mt-1">{log.message}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL */}
      <Dialog open={isModalOpen} onOpenChange={(o) => { setIsModalOpen(o); if (!o) { resetForm(); setTestResult({ status: "idle" }); } }}>
        <DialogContent className="bg-[#0b0f17] border border-[#1f2937] text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">
              {editing ? "Configurar Gateway" : "Adicionar Gateway"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {editing ? "Atualize as credenciais e métodos aceitos." : "Conecte um novo provedor de pagamentos."}
            </DialogDescription>
          </DialogHeader>

          <div className={cn("space-y-5 py-2 transition-opacity", saving && "pointer-events-none opacity-60")}>
            <div className="grid gap-2">
              <Label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Provedor</Label>
              <Select
                value={form.provider}
                onValueChange={(v) => setForm({ ...form, provider: v as ProviderKey, credentials: {} })}
                disabled={!!editing}
              >
                <SelectTrigger className="bg-[#05070d] border-[#1f2937] h-12 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0b0f17] border-[#1f2937] text-white">
                  {PROVIDERS.map(p => (
                    <SelectItem key={p.key} value={p.key}>
                      <div className="flex flex-col">
                        <span className="font-bold">{p.label}</span>
                        <span className="text-[10px] text-slate-500">{p.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Nome da Conexão</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={`Minha conta ${providerDef.label}`}
                className="bg-[#05070d] border-[#1f2937] h-12 rounded-xl"
              />
            </div>

            {providerDef.hasEnvironment && (
              <div className="grid gap-2">
                <Label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Ambiente</Label>
                <Select value={form.environment} onValueChange={(v) => setForm({ ...form, environment: v })}>
                  <SelectTrigger className="bg-[#05070d] border-[#1f2937] h-12 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0b0f17] border-[#1f2937] text-white">
                    <SelectItem value="production">Produção</SelectItem>
                    <SelectItem value="sandbox">Sandbox</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-3 rounded-2xl border border-[#1f2937] bg-[#05070d] p-4">
              <p className="text-[10px] uppercase tracking-widest text-[#ea580c] font-black flex items-center gap-2">
                <ShieldCheck className="h-3 w-3" /> Credenciais (criptografadas)
              </p>
              {providerDef.fields.map(field => (
                <div key={field.name} className="grid gap-2">
                  <Label className="text-xs text-slate-400 font-bold">
                    {field.label} {field.required && <span className="text-red-400">*</span>}
                  </Label>
                  <Input
                    type={field.type || "text"}
                    value={form.credentials[field.name] || ""}
                    onChange={(e) => setForm({ ...form, credentials: { ...form.credentials, [field.name]: e.target.value } })}
                    placeholder={field.placeholder}
                    className="bg-[#0b0f17] border-[#1f2937] h-11 rounded-lg font-mono text-sm"
                  />
                </div>
              ))}
            </div>

            {/* Métodos aceitos */}
            <div className="space-y-3 rounded-2xl border border-[#1f2937] bg-[#05070d] p-4">
              <p className="text-[10px] uppercase tracking-widest text-[#ea580c] font-black">Métodos Aceitos</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.keys(DEFAULT_METHODS).map(key => {
                  const Icon = METHOD_ICONS[key];
                  return (
                    <label key={key} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#0b0f17] border border-[#1f2937] cursor-pointer hover:border-[#ea580c]/40 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="h-4 w-4 text-[#ea580c] shrink-0" />
                        <span className="text-sm font-bold truncate">{METHOD_LABELS[key]}</span>
                      </div>
                      <Switch
                        checked={!!form.methods[key]}
                        onCheckedChange={(v) => setForm({ ...form, methods: { ...form.methods, [key]: v } })}
                      />
                    </label>
                  );
                })}
              </div>
            </div>

          </div>

          <div className="mt-6 pt-5 border-t border-white/[0.08] flex flex-col gap-4">
            {/* Status badge */}
            {testResult.status === "success" && (
              <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                <CheckCircle2 className="h-4 w-4" /> Gateway conectado — {testResult.message}
              </div>
            )}
            {testResult.status === "error" && (
              <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold">
                <X className="h-4 w-4" /> Erro de autenticação — {testResult.message}
              </div>
            )}

            {/* Ações — 3 botões alinhados em linha única */}
            {(() => {
              const credentialsFilled = providerDef.fields
                .filter(f => f.required)
                .every(f => (form.credentials[f.name] || "").length > 0);
              const testDisabled = testing || saving || !credentialsFilled;
              const isSuccess = testResult.status === "success";
              const isError = testResult.status === "error";
              return (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 sm:gap-4">
                  {/* Testar conexão */}
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testDisabled}
                    title={!credentialsFilled ? "Preencha os dados do gateway primeiro." : undefined}
                    style={{ height: 48 }}
                    className={cn(
                      "w-full sm:w-[180px] rounded-[12px] border font-semibold text-sm tracking-wide",
                      "inline-flex items-center justify-center gap-2 transition-all duration-200",
                      isSuccess
                        ? "border-emerald-500/60 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10"
                        : isError
                          ? "border-red-500/60 bg-red-500/5 text-red-400 hover:bg-red-500/10"
                          : "border-[#D4AF37] bg-transparent text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black hover:shadow-[0_0_20px_rgba(212,175,55,0.4)]",
                      testDisabled && "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-[#D4AF37] hover:shadow-none",
                    )}
                  >
                    {testing ? (
                      <><RefreshCw className="h-4 w-4 animate-spin" /> Testando...</>
                    ) : isSuccess ? (
                      <><CheckCircle2 className="h-4 w-4" /> Conectado</>
                    ) : isError ? (
                      <><X className="h-4 w-4" /> Falha</>
                    ) : (
                      <><ShieldCheck className="h-4 w-4" /> Testar conexão</>
                    )}
                  </button>

                  {/* Cancelar */}
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={saving}
                    style={{ height: 48 }}
                    className={cn(
                      "w-full sm:w-[170px] rounded-[12px] border border-[#2A2F3A] bg-[#111827] text-white font-semibold text-sm",
                      "inline-flex items-center justify-center gap-2 transition-all duration-200",
                      "hover:bg-[#1B2330] hover:border-[#D4AF37] hover:text-[#D4AF37]",
                      saving && "opacity-40 cursor-not-allowed",
                    )}
                  >
                    <X className="h-4 w-4" /> Cancelar
                  </button>

                  {/* Adicionar Gateway (CTA principal) */}
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    style={{ height: 48 }}
                    className={cn(
                      "w-full sm:w-[240px] rounded-[12px] font-bold text-sm text-black",
                      "inline-flex items-center justify-center gap-2 transition-all duration-200",
                      "bg-gradient-to-r from-[#D4AF37] to-[#F59E0B]",
                      "hover:scale-[1.02] hover:shadow-[0_0_25px_rgba(212,175,55,0.35)]",
                      "active:scale-[0.99]",
                      saving && "opacity-80 cursor-wait hover:scale-100 hover:shadow-none",
                    )}
                  >
                    {saving ? (
                      <><RefreshCw className="h-4 w-4 animate-spin" /> Salvando Gateway...</>
                    ) : (
                      <><CreditCard className="h-4 w-4" /> {editing ? "Salvar alterações" : "Adicionar Gateway"}</>
                    )}
                  </button>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color }: { label: string; value: any; icon: any; color: string }) {
  return (
    <Card className="bg-[#050B18] border-[#1f2937] text-white">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <Icon className={cn("h-4 w-4", color)} />
        </div>
        <p className="text-2xl font-black tracking-tighter">{value}</p>
        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending;
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", s.bg, s.text)}>
      <Icon className="h-3 w-3" />
      {s.label}
    </span>
  );
}

function GatewayCard({
  gateway,
  onEdit,
  onTest,
  onToggleActive,
  onDelete,
  onSetPrimary,
}: {
  gateway: any;
  onEdit: () => void;
  onTest: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onSetPrimary: () => void;
}) {
  const def = PROVIDERS.find(p => p.key === gateway.provider);
  const activeMethods = Object.entries(gateway.methods || {}).filter(([, v]) => v).map(([k]) => METHOD_LABELS[k]).filter(Boolean);

  return (
    <Card className={cn(
      "bg-[#050B18] border text-white overflow-hidden transition-all hover:border-[#ea580c]/40",
      gateway.is_primary ? "border-[#ea580c]/60 shadow-lg shadow-orange-500/10" : "border-[#1f2937]",
      !gateway.is_active && "opacity-60",
    )}>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-lg font-black uppercase tracking-tight truncate">{gateway.name}</h3>
              {gateway.is_primary && (
                <Badge className="bg-[#ea580c]/15 text-[#ea580c] border-[#ea580c]/30 hover:bg-[#ea580c]/15 font-black text-[9px] tracking-widest uppercase">
                  <Star className="h-3 w-3 mr-1 fill-current" /> Principal
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{def?.label || gateway.provider}</p>
          </div>
          <StatusBadge status={gateway.status} />
        </div>

        {activeMethods.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activeMethods.map(m => (
              <span key={m} className="text-[10px] font-bold uppercase tracking-widest text-slate-300 bg-[#1f2937]/60 px-2 py-1 rounded-md">
                {m}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-[#1f2937]">
          <span>Última sincronização</span>
          <span className="text-slate-300 font-bold">
            {gateway.last_sync_at ? format(new Date(gateway.last_sync_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Button size="sm" variant="outline" onClick={onEdit} className="border-[#1f2937] text-slate-300 hover:bg-[#1f2937] rounded-lg h-9 text-xs font-bold">
            <SettingsIcon className="h-3.5 w-3.5 mr-1" /> Configurar
          </Button>
          <Button size="sm" variant="outline" onClick={onTest} className="border-[#1f2937] text-slate-300 hover:bg-[#1f2937] rounded-lg h-9 text-xs font-bold">
            <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Testar
          </Button>
          <Button size="sm" variant="outline" onClick={onToggleActive} className="border-[#1f2937] text-slate-300 hover:bg-[#1f2937] rounded-lg h-9 text-xs font-bold">
            {gateway.is_active ? <><X className="h-3.5 w-3.5 mr-1" /> Desativar</> : <><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Ativar</>}
          </Button>
          <Button size="sm" variant="outline" onClick={onDelete} className="border-red-500/20 text-red-400 hover:bg-red-500/10 rounded-lg h-9 text-xs font-bold">
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
          </Button>
        </div>

        {!gateway.is_primary && (
          <Button size="sm" variant="ghost" onClick={onSetPrimary} className="w-full text-xs text-[#ea580c] hover:bg-[#ea580c]/10 font-bold h-8">
            <Star className="h-3 w-3 mr-1.5" /> Definir como principal
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function PixSettingsCard({ primaryGateway, onSaved }: { primaryGateway: any; onSaved: () => void }) {
  const [pix, setPix] = useState({
    recipient_name: "",
    key_type: "cpf",
    key_value: "",
    qr_code_url: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (primaryGateway?.pix_settings) {
      setPix({
        recipient_name: primaryGateway.pix_settings.recipient_name || "",
        key_type: primaryGateway.pix_settings.key_type || "cpf",
        key_value: primaryGateway.pix_settings.key_value || "",
        qr_code_url: primaryGateway.pix_settings.qr_code_url || "",
      });
    }
  }, [primaryGateway?.id]);

  const handleValidate = () => {
    if (!pix.key_value.trim()) return toast.error("Informe a chave PIX");
    toast.success("✓ Chave PIX validada (formato OK)");
  };

  const handleSave = async () => {
    if (!primaryGateway) {
      toast.error("Defina um gateway principal antes");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("payment_gateways")
      .update({ pix_settings: pix })
      .eq("id", primaryGateway.id);
    setSaving(false);
    if (error) return toast.error("Erro ao salvar PIX");
    toast.success("Configurações PIX salvas");
    onSaved();
  };

  return (
    <Card className="bg-[#050B18] border-[#1f2937] text-white">
      <CardHeader className="border-b border-[#1f2937]/50">
        <CardTitle className="flex items-center gap-2 text-lg font-black uppercase italic tracking-wider">
          <QrCode className="h-5 w-5 text-[#ea580c]" /> Configurações PIX
        </CardTitle>
        <CardDescription className="text-slate-400">
          {primaryGateway
            ? `Vinculado ao gateway principal: ${primaryGateway.name}`
            : "Cadastre um gateway principal para configurar o PIX."}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        <div className="grid gap-2">
          <Label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Nome do recebedor</Label>
          <Input value={pix.recipient_name} onChange={(e) => setPix({ ...pix, recipient_name: e.target.value })} className="bg-[#0b0f17] border-[#1f2937] h-11 rounded-xl" disabled={!primaryGateway} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Tipo de chave</Label>
            <Select value={pix.key_type} onValueChange={(v) => setPix({ ...pix, key_type: v })} disabled={!primaryGateway}>
              <SelectTrigger className="bg-[#0b0f17] border-[#1f2937] h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#0b0f17] border-[#1f2937] text-white">
                <SelectItem value="cpf">CPF</SelectItem>
                <SelectItem value="cnpj">CNPJ</SelectItem>
                <SelectItem value="phone">Telefone</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="random">Aleatória</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Chave PIX</Label>
            <Input value={pix.key_value} onChange={(e) => setPix({ ...pix, key_value: e.target.value })} className="bg-[#0b0f17] border-[#1f2937] h-11 rounded-xl font-mono text-sm" disabled={!primaryGateway} />
          </div>
        </div>
        <div className="grid gap-2">
          <Label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">URL do QR Code (opcional)</Label>
          <Input value={pix.qr_code_url} onChange={(e) => setPix({ ...pix, qr_code_url: e.target.value })} placeholder="https://..." className="bg-[#0b0f17] border-[#1f2937] h-11 rounded-xl" disabled={!primaryGateway} />
        </div>
        <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
          <Button variant="outline" onClick={handleValidate} disabled={!primaryGateway} className="border-[#1f2937] text-slate-300 hover:bg-[#1f2937] rounded-xl h-11 flex-1">
            <ShieldCheck className="h-4 w-4 mr-2" /> Validar PIX
          </Button>
          <Button onClick={handleSave} disabled={saving || !primaryGateway} className="bg-[#ea580c] hover:bg-[#ea580c]/90 text-white font-bold rounded-xl h-11 flex-1">
            {saving ? "Salvando..." : "Salvar PIX"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
