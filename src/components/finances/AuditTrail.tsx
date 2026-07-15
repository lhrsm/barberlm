import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { RefreshCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export function AuditTrail({ refundId }: { refundId: string }) {
  const [audits, setAudits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAudits() {
      const { data } = await supabase
        .from("refund_audits")
        .select("*")
        .eq("refund_id", refundId)
        .order("created_at", { ascending: false });
      setAudits(data || []);
      setLoading(false);
    }
    fetchAudits();
  }, [refundId]);

  if (loading)
    return (
      <div className="flex justify-center p-4">
        <RefreshCcw className="animate-spin h-5 w-5 text-primary" />
      </div>
    );

  return (
    <div className="space-y-4">
      {audits.length === 0 ? (
        <p className="text-zinc-500 text-sm italic text-center">Nenhum registro de auditoria encontrado.</p>
      ) : (
        audits.map((audit) => (
          <div key={audit.id} className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50 relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-[9px] font-black uppercase tracking-widest",
                  audit.new_status === "requested"
                    ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                    : audit.new_status === "approved"
                      ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                      : audit.new_status === "completed"
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        : "bg-red-500/10 text-red-500 border-red-500/20",
                )}
              >
                {audit.new_status}
              </Badge>
              <span className="text-[10px] text-zinc-500 font-medium">
                {format(new Date(audit.created_at), "dd/MM HH:mm")}
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-zinc-300">
                <span className="text-zinc-500 uppercase text-[9px] font-black mr-1 tracking-tighter">Alterado por:</span>
                {audit.changed_by_type === "admin" ? "Administrador" : "Sistema"}
              </p>
              {audit.old_status && (
                <p className="text-[10px] text-zinc-500">
                  Status anterior: <span className="line-through">{audit.old_status}</span>
                </p>
              )}
              {audit.changes && Object.keys(audit.changes).length > 0 && (
                <div className="mt-2 pt-2 border-t border-zinc-800/50">
                  <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">Modificações</p>
                  {Object.entries(audit.changes).map(([field, vals]: [string, any]) => (
                    <p key={field} className="text-[10px] text-zinc-400">
                      <span className="capitalize">{field}</span>:{" "}
                      {typeof vals.old !== "undefined" ? `${vals.old} → ` : ""}
                      {vals.new}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
