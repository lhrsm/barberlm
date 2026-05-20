import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TenantChartsProps {
  tenantId: string;
}

export function TenantCharts({ tenantId }: TenantChartsProps) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["tenant-charts-data", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      // Fetch appointments for the last 30 days
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      
      const { data: appointments } = await supabase
        .from("appointments")
        .select("start_time, status, final_amount, total_price")
        .eq("user_id", tenantId)
        .gte("start_time", thirtyDaysAgo);

      // Process appointments by day (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), i);
        return format(date, "yyyy-MM-dd");
      }).reverse();

      const appointmentsByDay = last7Days.map((day) => {
        const count = appointments?.filter(
          (a) => format(new Date(a.start_time), "yyyy-MM-dd") === day
        ).length;
        return {
          day: format(new Date(day), "dd/MM", { locale: ptBR }),
          agendamentos: count || 0,
        };
      });

      // Process revenue by status (this month)
      const revenueByStatus = [
        {
          name: "Concluído",
          value: appointments
            ?.filter((a) => a.status === "completed")
            .reduce((acc, curr) => acc + (Number(curr.final_amount || curr.total_price) || 0), 0) || 0,
          color: "#10b981",
        },
        {
          name: "Agendado",
          value: appointments
            ?.filter((a) => a.status === "scheduled" || a.status === "confirmed")
            .reduce((acc, curr) => acc + (Number(curr.total_price) || 0), 0) || 0,
          color: "#3b82f6",
        },
        {
          name: "Cancelado",
          value: appointments
            ?.filter((a) => a.status === "cancelled")
            .reduce((acc, curr) => acc + (Number(curr.total_price) || 0), 0) || 0,
          color: "#ef4444",
        },
      ].filter(item => item.value > 0);

      // Revenue by professional
      const { data: barbers } = await supabase
        .from("barbers")
        .select("id, name")
        .eq("user_id", tenantId);

      const revenueByBarber = barbers?.map(barber => {
        const total = appointments
          ?.filter(a => a.barber_id === barber.id && a.status === 'completed')
          .reduce((acc, curr) => acc + (Number(curr.final_amount || curr.total_price) || 0), 0) || 0;
        return {
          name: barber.name,
          value: total
        };
      }).filter(b => b.value > 0) || [];

      return {
        appointmentsByDay,
        revenueByStatus: revenueByStatus.length > 0 ? revenueByStatus : [
          { name: "Sem dados", value: 1, color: "#cbd5e1" }
        ],
        revenueByBarber: revenueByBarber.length > 0 ? revenueByBarber : [
          { name: "Nenhum", value: 0 }
        ],
      };
    },
    enabled: !!tenantId,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-[350px] w-full" />
        <Skeleton className="h-[350px] w-full" />
      </div>
    );
  }

  const chartConfig = {
    agendamentos: {
      label: "Agendamentos",
      color: "hsl(var(--primary))",
    },
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Volume de Agendamentos</CardTitle>
            <CardDescription>Últimos 7 dias de atividade.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={stats?.appointmentsByDay}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="agendamentos"
                  fill="var(--color-agendamentos)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status Financeiro (30d)</CardTitle>
            <CardDescription>Distribuição de valores por status.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats?.revenueByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats?.revenueByStatus.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) =>
                      stats?.revenueByStatus[0]?.name === "Sem dados" ? "0" :
                      new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(value)
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-4 text-sm">
                {stats?.revenueByStatus.map((s: any) => (
                  <div key={s.name} className="flex items-center gap-1">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span>{s.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Faturamento por Profissional (Concluídos)</CardTitle>
            <CardDescription>Ranking de vendas nos últimos 30 dias.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={stats?.revenueByBarber}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    tickLine={false} 
                    axisLine={false} 
                    width={100}
                    fontSize={12}
                  />
                  <Tooltip 
                    formatter={(value: number) =>
                      new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(value)
                    }
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
