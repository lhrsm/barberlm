import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  createAdminVoucher,
  applyAdminVoucher,
  revokeAdminVoucher,
  listAdminVouchers,
  listAdminVoucherAuditLogs,
} from "@/lib/admin-vouchers.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Ticket, Plus, Play, Ban, Loader2, ShieldCheck, History } from "lucide-react";
import { DefaultRouteError, DefaultRouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/admin/vouchers")({
  component: AdminVouchersPage,
  head: () => ({
    meta: [
      { title: "Vouchers Administrativos — Barbex Admin" },
      { name: "description", content: "Gestão de vouchers internos de teste do Barbex." },
    ],
  }),
  errorComponent: DefaultRouteError,
  notFoundComponent: DefaultRouteNotFound,
});

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft: "bg-white/10 text-white/70",
    pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
    active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    failed: "bg-red-500/20 text-red-300 border-red-500/40",
    revoked: "bg-white/5 text-white/50 line-through",
    expired: "bg-white/5 text-white/50",
  };
  return <Badge className={map[status] || "bg-white/10"}>{status}</Badge>;
}

function AdminVouchersPage() {
  const listFn = useServerFn(listAdminVouchers);
  const createFn = useServerFn(createAdminVoucher);
  const applyFn = useServerFn(applyAdminVoucher);
  const revokeFn = useServerFn(revokeAdminVoucher);
  const auditFn = useServerFn(listAdminVoucherAuditLogs);

  const [loading, setLoading] = useState(true);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [tenants, setTenants] = useState<Array<{ id: string; business_name: string }>>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditVoucher, setAuditVoucher] = useState<any | null>(null);

  // form
  const [form, setForm] = useState({
    name: "Ambiente Interno de Testes Barbex",
    specificTenantId: "",
    durationType: "forever" as "forever" | "until_date",
    expiresAt: "",
    environment: "sandbox" as "sandbox" | "live",
  });

  async function refresh() {
    setLoading(true);
    const res = await listFn({});
    if ("ok" in res && res.ok) setVouchers(res.vouchers);
    else toast.error((res as any).error || "Falha ao listar");
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    supabase
      .from("profiles")
      .select("id, business_name")
      .order("business_name")
      .limit(500)
      .then(({ data }) => setTenants((data as any[]) || []));
  }, []);

  async function handleCreate() {
    if (!form.specificTenantId) {
      toast.error("Selecione a barbearia beneficiária");
      return;
    }
    setBusy("create");
    try {
      const res = await createFn({
        data: {
          name: form.name,
          specificTenantId: form.specificTenantId,
          durationType: form.durationType,
          expiresAt: form.durationType === "until_date" ? form.expiresAt : null,
          discountPercentage: 100,
          includesAllAddons: true,
        },
      });
      if ("ok" in res && res.ok) {
        toast.success("Voucher criado. Aplique para ativar no Stripe.");
        setOpenCreate(false);
        refresh();
      } else {
        toast.error((res as any).error);
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleApply(voucherId: string, env: "sandbox" | "live") {
    setBusy(voucherId);
    try {
      const res = await applyFn({ data: { voucherId, environment: env } });
      if ("ok" in res && res.ok) {
        toast.success(`Voucher aplicado (${env}).`);
        refresh();
      } else {
        toast.error((res as any).error);
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleRevoke(voucherId: string) {
    const reason = window.prompt("Motivo da revogação?") || undefined;
    setBusy(voucherId);
    try {
      const res = await revokeFn({ data: { voucherId, reason } });
      if ("ok" in res && res.ok) {
        toast.success("Voucher revogado.");
        refresh();
      } else {
        toast.error((res as any).error);
      }
    } finally {
      setBusy(null);
    }
  }

  async function openAudit(v: any) {
    setAuditVoucher(v);
    setAuditOpen(true);
    setAuditLoading(true);
    setAuditLogs([]);
    try {
      const res = await auditFn({ data: { voucherId: v.id, limit: 200 } });
      if ("ok" in res && res.ok) setAuditLogs(res.logs);
      else toast.error((res as any).error || "Falha ao carregar histórico");
    } finally {
      setAuditLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Ticket className="w-6 h-6 text-purple-400" /> Vouchers Administrativos
          </h1>
          <p className="text-sm text-white/60 mt-1">
            Ambiente interno de testes — 100% de desconto no plano e todos os add-ons.
          </p>
        </div>
        <Button
          size="sm"
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 h-9 px-3 text-sm"
          onClick={() => setOpenCreate(true)}
        >
          <Plus className="w-4 h-4 mr-2" /> Novo Voucher
        </Button>
      </div>

      <Card className="bg-black/40 border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Vouchers emitidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-white/60 py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          ) : vouchers.length === 0 ? (
            <p className="text-white/50 text-sm py-8 text-center">Nenhum voucher emitido ainda.</p>
          ) : (
            <div className="space-y-3">
              {vouchers.map((v) => {
                const tenant = tenants.find((t) => t.id === v.specific_tenant_id);
                const hasSandboxCoupon = !!v.stripe_coupon_id_test;
                const hasLiveCoupon = !!v.stripe_coupon_id_live;
                return (
                  <div
                    key={v.id}
                    className="p-4 rounded-xl border border-white/10 bg-white/5 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white truncate">{v.name}</span>
                        {statusBadge(v.status)}
                        <Badge variant="outline" className="text-xs border-white/20 text-white/70">
                          {v.discount_percentage}% • {v.duration_type}
                        </Badge>
                      </div>
                      <div className="text-xs text-white/50 mt-1">
                        Tenant: {tenant?.business_name || v.specific_tenant_id?.slice(0, 8) + "…"}
                        {" • "}
                        Stripe: {hasSandboxCoupon ? "sandbox ✓" : "sandbox ✗"} / {hasLiveCoupon ? "live ✓" : "live ✗"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {v.status !== "revoked" && v.status !== "active" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-white/20 text-white"
                            disabled={!hasSandboxCoupon || busy === v.id}
                            onClick={() => handleApply(v.id, "sandbox")}
                          >
                            <Play className="w-3 h-3 mr-1" /> Sandbox
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-white/20 text-white"
                            disabled={!hasLiveCoupon || busy === v.id}
                            onClick={() => handleApply(v.id, "live")}
                          >
                            <Play className="w-3 h-3 mr-1" /> Live
                          </Button>
                        </>
                      )}
                      {v.status !== "revoked" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-300 hover:bg-red-500/10"
                          disabled={busy === v.id}
                          onClick={() => handleRevoke(v.id)}
                        >
                          <Ban className="w-3 h-3 mr-1" /> Revogar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-white/70 hover:bg-white/10"
                        onClick={() => openAudit(v)}
                      >
                        <History className="w-3 h-3 mr-1" /> Histórico
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AUDIT DIALOG */}
      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="bg-neutral-900 border-white/10 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-4 h-4 text-purple-400" />
              Histórico do voucher
              {auditVoucher && (
                <span className="text-white/50 text-sm font-normal">— {auditVoucher.name}</span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {auditLoading ? (
              <div className="flex items-center gap-2 text-white/60 py-8 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
              </div>
            ) : auditLogs.length === 0 ? (
              <p className="text-white/50 text-sm py-8 text-center">Nenhum registro de auditoria.</p>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="p-3 rounded-lg border border-white/10 bg-white/5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Badge className="bg-purple-500/20 text-purple-200 border-purple-500/40 text-xs">
                      {log.action}
                    </Badge>
                    <span className="text-xs text-white/50">
                      {new Date(log.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  {log.reason && (
                    <p className="text-xs text-white/70 mt-2">Motivo: {log.reason}</p>
                  )}
                  {log.new_values && (
                    <pre className="text-[10px] text-white/50 mt-2 bg-black/40 rounded p-2 overflow-x-auto">
{JSON.stringify(log.new_values, null, 2)}
                    </pre>
                  )}
                  <p className="text-[10px] text-white/40 mt-1">
                    Ator: {String(log.actor_user_id || "").slice(0, 8)}…
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>


      {/* CREATE DIALOG */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="bg-neutral-900 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Novo Voucher Interno</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-black/40 border-white/10"
              />
            </div>
            <div>
              <Label>Barbearia beneficiária</Label>
              <Select
                value={form.specificTenantId}
                onValueChange={(v) => setForm({ ...form, specificTenantId: v })}
              >
                <SelectTrigger className="bg-black/40 border-white/10">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-neutral-900 border-white/10 text-white max-h-72">
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.business_name || t.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Duração</Label>
              <Select
                value={form.durationType}
                onValueChange={(v: any) => setForm({ ...form, durationType: v })}
              >
                <SelectTrigger className="bg-black/40 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-neutral-900 border-white/10 text-white">
                  <SelectItem value="forever">Para sempre</SelectItem>
                  <SelectItem value="until_date">Até data específica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.durationType === "until_date" && (
              <div>
                <Label>Expira em</Label>
                <Input
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  className="bg-black/40 border-white/10"
                />
              </div>
            )}
            <p className="text-xs text-white/50">
              Cupons de 100% off serão criados no Stripe (sandbox e live). Aplique depois de criar para
              vincular à assinatura ativa do tenant.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenCreate(false)}>Cancelar</Button>
            <Button
              className="bg-gradient-to-r from-purple-600 to-pink-600"
              onClick={handleCreate}
              disabled={busy === "create"}
            >
              {busy === "create" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar Voucher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
