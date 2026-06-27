import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminListLgpdRequests, adminResolveLgpdRequest } from "@/lib/trust.functions";
import { Scale, Download, Trash2, Edit3, UserCheck, CheckCircle2, XCircle, Clock, Filter } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/lgpd")({
  component: AdminLgpd,
});

const TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  export: { label: "Exportação", icon: Download, color: "text-blue-400" },
  delete: { label: "Exclusão", icon: Trash2, color: "text-red-400" },
  anonymize: { label: "Anonimização", icon: UserCheck, color: "text-purple-400" },
  correction: { label: "Correção", icon: Edit3, color: "text-amber-400" },
};

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pendente", color: "bg-amber-500/15 border-amber-500/40 text-amber-300", icon: Clock },
  in_progress: { label: "Em andamento", color: "bg-blue-500/15 border-blue-500/40 text-blue-300", icon: Clock },
  done: { label: "Atendida", color: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300", icon: CheckCircle2 },
  rejected: { label: "Rejeitada", color: "bg-red-500/15 border-red-500/40 text-red-300", icon: XCircle },
};

function AdminLgpd() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-lgpd-requests", statusFilter, typeFilter],
    queryFn: () => adminListLgpdRequests({ data: { status: statusFilter || undefined, type: typeFilter || undefined } }),
  });

  const resolve = useMutation({
    mutationFn: (vars: { id: string; status: "done" | "rejected" | "in_progress"; response?: string }) =>
      adminResolveLgpdRequest({ data: vars }),
    onSuccess: () => {
      toast.success("Solicitação atualizada");
      qc.invalidateQueries({ queryKey: ["admin-lgpd-requests"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const items = data?.items ?? [];
  const counts = {
    pending: items.filter((i: any) => i.status === "pending").length,
    in_progress: items.filter((i: any) => i.status === "in_progress").length,
    done: items.filter((i: any) => i.status === "done").length,
    rejected: items.filter((i: any) => i.status === "rejected").length,
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Scale className="h-7 w-7 text-purple-400" />
        <div>
          <h1 className="text-2xl font-black">LGPD — Solicitações</h1>
          <p className="text-sm text-white/60">Atenda solicitações de exportação, exclusão, anonimização e correção.</p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Pendentes" value={counts.pending} accent="amber" />
        <Stat label="Em andamento" value={counts.in_progress} accent="blue" />
        <Stat label="Atendidas" value={counts.done} accent="emerald" />
        <Stat label="Rejeitadas" value={counts.rejected} accent="red" />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
        <Filter className="h-4 w-4 text-white/50" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">Todos os tipos</option>
          {Object.entries(TYPE_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] divide-y divide-white/5 overflow-hidden">
        {isLoading && <div className="p-6 text-white/60 text-sm">Carregando...</div>}
        {!isLoading && items.length === 0 && (
          <div className="p-10 text-center text-white/50 text-sm">Nenhuma solicitação encontrada.</div>
        )}
        {items.map((req: any) => {
          const t = TYPE_META[req.request_type] ?? { label: req.request_type, icon: Scale, color: "text-white" };
          const s = STATUS_META[req.status] ?? STATUS_META.pending;
          const Icon = t.icon;
          const StatusIcon = s.icon;
          return (
            <div key={req.id} className="p-4 flex flex-col md:flex-row gap-4 md:items-center">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`h-10 w-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center ${t.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{t.label}</p>
                  <p className="text-xs text-white/50 truncate">
                    {req.contact_email || req.customer_id || req.user_id || "anônimo"} • {new Date(req.created_at).toLocaleString("pt-BR")}
                  </p>
                  {req.notes && <p className="text-xs text-white/40 mt-1 truncate">{req.notes}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${s.color}`}>
                  <StatusIcon className="h-3 w-3" /> {s.label}
                </span>
                {req.status !== "done" && req.status !== "rejected" && (
                  <>
                    <button
                      onClick={() => resolve.mutate({ id: req.id, status: "done" })}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25"
                    >
                      Atender
                    </button>
                    <button
                      onClick={() => resolve.mutate({ id: req.id, status: "rejected" })}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/15 border border-red-500/40 text-red-300 hover:bg-red-500/25"
                    >
                      Rejeitar
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: "amber" | "blue" | "emerald" | "red" }) {
  const colors: Record<string, string> = {
    amber: "border-amber-500/40 from-amber-500/15",
    blue: "border-blue-500/40 from-blue-500/15",
    emerald: "border-emerald-500/40 from-emerald-500/15",
    red: "border-red-500/40 from-red-500/15",
  };
  return (
    <div className={`rounded-xl border bg-gradient-to-br to-transparent p-4 ${colors[accent]}`}>
      <p className="text-xs text-white/60 uppercase font-bold tracking-wider">{label}</p>
      <p className="text-3xl font-black mt-1">{value}</p>
    </div>
  );
}
