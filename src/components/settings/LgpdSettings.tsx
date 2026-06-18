import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck, Download, Trash2, CheckCircle2, Clock, FileText, Cookie, AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface Consent {
  id: string;
  customer_id: string | null;
  ip: string | null;
  accepted_terms: boolean;
  accepted_privacy: boolean;
  allow_marketing: boolean;
  allow_notifications: boolean;
  source: string | null;
  accepted_at: string;
}

interface DeletionRequest {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  deletion_requested_at: string;
  deletion_status: string | null;
}

const RETENTION_KEY = "barbex_lgpd_retention_v1";

export function LgpdSettings() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [deletions, setDeletions] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [retention, setRetention] = useState<string>("indeterminate");
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setTenantId(user.id);

      try {
        const raw = localStorage.getItem(RETENTION_KEY + ":" + user.id);
        if (raw) setRetention(raw);
      } catch {}

      const [consentsRes, deletionsRes] = await Promise.all([
        supabase
          .from("privacy_consents")
          .select("id, customer_id, ip, accepted_terms, accepted_privacy, allow_marketing, allow_notifications, source, accepted_at")
          .eq("tenant_id", user.id)
          .order("accepted_at", { ascending: false })
          .limit(100),
        supabase
          .from("customers")
          .select("id, name, phone, email, deletion_requested_at, deletion_status")
          .eq("user_id", user.id)
          .not("deletion_requested_at", "is", null)
          .order("deletion_requested_at", { ascending: false }),
      ]);

      setConsents((consentsRes.data as Consent[]) || []);
      setDeletions((deletionsRes.data as DeletionRequest[]) || []);
      setLoading(false);
    })();
  }, []);

  const saveRetention = (value: string) => {
    setRetention(value);
    if (tenantId) {
      try { localStorage.setItem(RETENTION_KEY + ":" + tenantId, value); } catch {}
    }
    toast.success("Política de retenção salva.");
  };

  const approveDeletion = async (req: DeletionRequest) => {
    if (!window.confirm(`Anonimizar dados de "${req.name || "cliente"}"? Esta ação é irreversível. Histórico financeiro será mantido.`)) return;
    setProcessingId(req.id);
    const anonName = `Cliente anonimizado #${req.id.slice(0, 6)}`;
    const { error } = await supabase
      .from("customers")
      .update({
        name: anonName,
        phone: null,
        email: null,
        notes: null,
        avatar_url: null,
        birth_date: null,
        allow_marketing: false,
        allow_notifications: false,
        deletion_status: "anonymized",
      })
      .eq("id", req.id);
    setProcessingId(null);
    if (error) {
      toast.error("Falha ao anonimizar: " + error.message);
      return;
    }
    setDeletions((prev) => prev.filter((d) => d.id !== req.id));
    toast.success("Cliente anonimizado com sucesso.");
  };

  const rejectDeletion = async (req: DeletionRequest) => {
    if (!window.confirm("Rejeitar a solicitação de exclusão?")) return;
    const { error } = await supabase
      .from("customers")
      .update({ deletion_requested_at: null, deletion_status: "rejected" })
      .eq("id", req.id);
    if (error) {
      toast.error("Falha ao rejeitar.");
      return;
    }
    setDeletions((prev) => prev.filter((d) => d.id !== req.id));
    toast.success("Solicitação rejeitada.");
  };

  const exportConsents = () => {
    const blob = new Blob([JSON.stringify(consents, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `consentimentos-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Status geral */}
      <Card className="bg-[#0b0f17] border border-[#1f2937] text-white rounded-[20px] overflow-hidden">
        <CardHeader className="border-b border-[#1f2937]/50">
          <CardTitle className="flex items-center gap-2 text-xl font-black uppercase italic tracking-wider">
            <ShieldCheck className="text-[#F5C542] h-5 w-5" /> LGPD — Adequação
          </CardTitle>
          <CardDescription className="text-slate-400">
            Conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: FileText, label: "Política de Privacidade", to: "/privacy" },
            { icon: FileText, label: "Termos de Uso", to: "/terms" },
            { icon: Cookie, label: "Banner de Cookies", to: null, note: "Ativo no frontend" },
            { icon: Download, label: "Exportação de Dados", to: null, note: "Portal do cliente" },
            { icon: Trash2, label: "Exclusão de Dados", to: null, note: "Portal do cliente" },
            { icon: ShieldCheck, label: "Log de Consentimentos", to: null, note: "Abaixo" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-3 flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                <item.icon className="text-emerald-400 h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="text-[11px] text-white/50">
                  {item.note || (item.to && (
                    <Link to={item.to} target="_blank" className="text-emerald-300 hover:underline">
                      Abrir página
                    </Link>
                  ))}
                </p>
              </div>
              <CheckCircle2 className="text-emerald-400 h-4 w-4 mt-0.5 shrink-0" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Retenção */}
      <Card className="bg-[#0b0f17] border border-[#1f2937] text-white rounded-[20px] overflow-hidden">
        <CardHeader className="border-b border-[#1f2937]/50">
          <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-wider">
            <Clock className="text-[#F5C542] h-5 w-5" /> Retenção de Dados
          </CardTitle>
          <CardDescription className="text-slate-400">
            Período máximo de retenção de dados pessoais de clientes inativos.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Select value={retention} onValueChange={saveRetention}>
              <SelectTrigger className="sm:max-w-[260px] bg-[#05070d] border-[#1f2937] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1y">1 ano</SelectItem>
                <SelectItem value="2y">2 anos</SelectItem>
                <SelectItem value="5y">5 anos</SelectItem>
                <SelectItem value="indeterminate">Indeterminado</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-white/50">
              A política é registrada e usada como referência para limpezas e auditorias.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Solicitações de exclusão */}
      <Card className="bg-[#0b0f17] border border-[#1f2937] text-white rounded-[20px] overflow-hidden">
        <CardHeader className="border-b border-[#1f2937]/50 flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-wider">
              <Trash2 className="text-red-400 h-5 w-5" /> Solicitações de Exclusão
            </CardTitle>
            <CardDescription className="text-slate-400">
              Aprove para anonimizar (nome, telefone, e-mail). Dados financeiros são preservados.
            </CardDescription>
          </div>
          {deletions.length > 0 && (
            <Badge className="bg-red-500/20 text-red-300 border-red-500/30">{deletions.length} pendente(s)</Badge>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-white/50">Carregando…</p>
          ) : deletions.length === 0 ? (
            <p className="p-6 text-sm text-white/50">Nenhuma solicitação pendente.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {deletions.map((req) => (
                <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{req.name || "Sem nome"}</p>
                    <p className="text-xs text-white/50 truncate">
                      {req.phone || "—"} · {req.email || "—"}
                    </p>
                    <p className="text-[11px] text-white/40 mt-0.5">
                      Solicitado em {new Date(req.deletion_requested_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/15 text-white/70 hover:bg-white/5"
                      onClick={() => rejectDeletion(req)}
                    >
                      Rejeitar
                    </Button>
                    <Button
                      size="sm"
                      disabled={processingId === req.id}
                      className="bg-red-500/90 text-white hover:bg-red-500"
                      onClick={() => approveDeletion(req)}
                    >
                      <AlertTriangle size={14} className="mr-1.5" />
                      {processingId === req.id ? "Anonimizando…" : "Aprovar e anonimizar"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log de consentimentos */}
      <Card className="bg-[#0b0f17] border border-[#1f2937] text-white rounded-[20px] overflow-hidden">
        <CardHeader className="border-b border-[#1f2937]/50 flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-wider">
              <ShieldCheck className="text-[#F5C542] h-5 w-5" /> Log de Consentimentos
            </CardTitle>
            <CardDescription className="text-slate-400">
              Últimos 100 consentimentos registrados pelos clientes.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" className="border-white/15 text-white/80 hover:bg-white/5" onClick={exportConsents} disabled={consents.length === 0}>
            <Download size={14} className="mr-1.5" /> Exportar
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-white/50">Carregando…</p>
          ) : consents.length === 0 ? (
            <p className="p-6 text-sm text-white/50">Nenhum consentimento registrado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.03] text-white/60 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold">Data</th>
                    <th className="text-left px-4 py-2 font-semibold">Origem</th>
                    <th className="text-left px-4 py-2 font-semibold">Termos</th>
                    <th className="text-left px-4 py-2 font-semibold">Privacidade</th>
                    <th className="text-left px-4 py-2 font-semibold">Marketing</th>
                    <th className="text-left px-4 py-2 font-semibold">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {consents.map((c) => (
                    <tr key={c.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-2 whitespace-nowrap text-white/80">{new Date(c.accepted_at).toLocaleString("pt-BR")}</td>
                      <td className="px-4 py-2 text-white/60">{c.source || "—"}</td>
                      <td className="px-4 py-2">{c.accepted_terms ? <CheckCircle2 className="text-emerald-400 h-4 w-4" /> : <span className="text-white/30">—</span>}</td>
                      <td className="px-4 py-2">{c.accepted_privacy ? <CheckCircle2 className="text-emerald-400 h-4 w-4" /> : <span className="text-white/30">—</span>}</td>
                      <td className="px-4 py-2">{c.allow_marketing ? <CheckCircle2 className="text-emerald-400 h-4 w-4" /> : <span className="text-white/30">—</span>}</td>
                      <td className="px-4 py-2 text-white/40 text-xs">{c.ip || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
