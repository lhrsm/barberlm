import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle, ShieldAlert, CheckCircle2, ArrowRight, Bell } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  count: number;
  action_label?: string;
  action_route?: string;
}

interface AlertsPayload {
  alerts: Alert[];
  total: number;
  critical_count: number;
  generated_at: string;
}

const SEVERITY_STYLE = {
  critical: {
    icon: ShieldAlert,
    iconColor: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    badgeClass: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    badgeLabel: "Crítico",
  },
  warning: {
    icon: AlertTriangle,
    iconColor: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    badgeLabel: "Atenção",
  },
  info: {
    icon: Bell,
    iconColor: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    badgeClass: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    badgeLabel: "Info",
  },
} as const;

export function AnomalyAlerts() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-anomaly-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_anomaly_alerts");
      if (error) throw error;
      return data as unknown as AlertsPayload;
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  if (isLoading) {
    return <Skeleton className="h-32 w-full rounded-3xl bg-white/5" />;
  }

  if (!data || data.total === 0) {
    return (
      <Card className="glass rounded-3xl border border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/20 rounded-2xl">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="font-bold text-white">Nenhuma anomalia detectada</p>
            <p className="text-xs text-white/50">
              Todos os sistemas operando dentro do esperado.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "glass rounded-3xl overflow-hidden border",
        data.critical_count > 0 ? "border-rose-500/30" : "border-amber-500/30"
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "p-2 rounded-xl",
              data.critical_count > 0 ? "bg-rose-500/20" : "bg-amber-500/20"
            )}
          >
            <AlertTriangle
              className={cn(
                "w-5 h-5",
                data.critical_count > 0 ? "text-rose-400" : "text-amber-400"
              )}
            />
          </div>
          <div>
            <CardTitle className="text-lg font-bold">Alertas de Anomalia</CardTitle>
            <p className="text-xs text-white/50 mt-0.5">
              {data.total} alerta(s) — {data.critical_count} crítico(s)
            </p>
          </div>
        </div>
        <Badge className="bg-white/5 text-white/70 border-white/10 text-[10px]">
          Atualiza a cada 5 min
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-white/5">
          {data.alerts.map((alert) => {
            const style = SEVERITY_STYLE[alert.severity] ?? SEVERITY_STYLE.warning;
            const Icon = style.icon;
            return (
              <div
                key={alert.id}
                className={cn("flex items-center gap-4 p-4 hover:bg-white/5 transition-colors", style.bg)}
              >
                <div className={cn("p-2 rounded-xl border", style.border, "bg-black/30")}>
                  <Icon className={cn("w-4 h-4", style.iconColor)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-bold text-white">{alert.title}</p>
                    <Badge className={cn("text-[9px] font-bold border", style.badgeClass)}>
                      {style.badgeLabel}
                    </Badge>
                  </div>
                  <p className="text-xs text-white/60">{alert.description}</p>
                </div>
                {alert.action_route && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-white/70 hover:text-white hover:bg-white/10 gap-1"
                    onClick={() => navigate({ to: alert.action_route! })}
                  >
                    {alert.action_label || "Abrir"}
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
