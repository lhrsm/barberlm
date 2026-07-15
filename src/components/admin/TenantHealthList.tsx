import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Heart, AlertTriangle, ArrowUpRight, MessageSquare, Calendar } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

interface HealthRow {
  tenant_id: string;
  business_name: string | null;
  plan: string | null;
  created_at: string;
  appointments_30d: number;
  last_appointment_at: string | null;
  days_since_activity: number | null;
  whatsapp_connected: boolean;
  open_tickets: number;
  health_score: number;
  risk_level: "critical" | "at_risk" | "watch" | "healthy";
}

const RISK_STYLE: Record<HealthRow["risk_level"], { label: string; className: string }> = {
  critical: { label: "Crítico", className: "bg-rose-500/20 text-rose-300 border-rose-500/40" },
  at_risk:  { label: "Em risco", className: "bg-orange-500/20 text-orange-300 border-orange-500/40" },
  watch:    { label: "Atenção", className: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
  healthy:  { label: "Saudável", className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
};

function scoreColor(score: number) {
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-amber-400";
  return "text-rose-400";
}

export function TenantHealthList() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-tenant-health"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_tenant_health", { p_limit: 20 });
      if (error) throw error;
      return (data as unknown as HealthRow[]) || [];
    },
    staleTime: 60_000,
  });

  return (
    <Card className="glass rounded-3xl border border-white/10 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-500/20 rounded-xl">
            <Heart className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold">Health Score por Barbearia</CardTitle>
            <p className="text-xs text-white/50 mt-0.5">Priorize contato com clientes em risco</p>
          </div>
        </div>
        <Badge className="bg-white/5 text-white/70 border-white/10 text-[10px]">
          Top 20 · piores primeiro
        </Badge>
      </CardHeader>
      <CardContent className="p-0 max-h-[560px] overflow-y-auto">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl bg-white/5" />
            ))}
          </div>
        ) : data && data.length > 0 ? (
          <div className="divide-y divide-white/5">
            {data.map((row) => {
              const risk = RISK_STYLE[row.risk_level] ?? RISK_STYLE.watch;
              return (
                <div
                  key={row.tenant_id}
                  className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors"
                >
                  <div className={cn("text-3xl font-black tracking-tighter w-14 text-center", scoreColor(row.health_score))}>
                    {row.health_score}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-white truncate">
                        {row.business_name || "Sem nome"}
                      </p>
                      <Badge className={cn("text-[9px] font-bold border", risk.className)}>
                        {risk.label}
                      </Badge>
                      {row.plan && (
                        <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold">
                          {row.plan}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-white/50">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {row.appointments_30d} em 30d
                      </span>
                      <span>
                        {row.days_since_activity == null
                          ? "sem atividade"
                          : `há ${row.days_since_activity}d`}
                      </span>
                      <span className={row.whatsapp_connected ? "text-emerald-400" : "text-rose-400"}>
                        WhatsApp {row.whatsapp_connected ? "ok" : "off"}
                      </span>
                      {row.open_tickets > 0 && (
                        <span className="flex items-center gap-1 text-amber-400">
                          <MessageSquare className="w-3 h-3" />
                          {row.open_tickets} ticket(s)
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white/60 hover:text-white hover:bg-white/10 gap-1"
                    onClick={() => {
                      sessionStorage.setItem("impersonated_tenant_id", row.tenant_id);
                      navigate({ to: "/dashboard" });
                    }}
                  >
                    Impersonar <ArrowUpRight className="w-3 h-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-white/50 text-sm flex flex-col items-center gap-2">
            <AlertTriangle className="w-6 h-6 opacity-40" />
            Nenhum tenant encontrado.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
