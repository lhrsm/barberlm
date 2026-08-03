import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getBIAnalytics } from "@/lib/bi.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Calendar, 
  Wallet, 
  Package, 
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  BarChart,
  Bar,
  Cell
} from "recharts";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/dashboard/bi")({
  component: BusinessIntelligencePage,
});

function BusinessIntelligencePage() {
  const [dateRange, setDateRange] = React.useState({
    start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    end: format(endOfMonth(new Date()), "yyyy-MM-dd")
  });

  const analyticsQuery = useQuery({
    queryKey: ["bi-analytics", dateRange],
    queryFn: () => getBIAnalytics({ 
      data: {
        start_date: dateRange.start, 
        end_date: dateRange.end,
        compare_start_date: format(subDays(new Date(dateRange.start), 30), "yyyy-MM-dd"),
        compare_end_date: format(subDays(new Date(dateRange.end), 30), "yyyy-MM-dd")
      }
    }),
  });

  const analytics = analyticsQuery.data;

  if (analyticsQuery.isLoading) {
    return (
      <div className="flex flex-col gap-8 p-6 bg-background/50 min-h-screen items-center justify-center">
        <p className="text-gold-DEFAULT animate-pulse font-black uppercase tracking-tighter">Processando BI...</p>
      </div>
    );
  }

  if (!analytics) return null;

  const brl = (v: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="flex flex-col gap-8 p-6 bg-background/50 min-h-screen">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-gold-DEFAULT via-gold-light to-gold-DEFAULT bg-clip-text text-transparent">
            BI Executivo
          </h1>
          <p className="text-muted-foreground">Análise histórica e estratégica da sua barbearia.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="border-gold-DEFAULT/20">
            <Filter className="w-4 h-4 mr-2" />
            Filtros Avançados
          </Button>
          <Button variant="outline" size="sm" className="border-gold-DEFAULT/20">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </header>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-background/40 border border-gold-DEFAULT/10 p-1">
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="w-4 h-4" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="finance" className="gap-2">
            <Wallet className="w-4 h-4" /> Financeiro
          </TabsTrigger>
          <TabsTrigger value="agenda" className="gap-2">
            <Calendar className="w-4 h-4" /> Agenda
          </TabsTrigger>
          <TabsTrigger value="customers" className="gap-2">
            <Users className="w-4 h-4" /> Clientes
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2">
            <Package className="w-4 h-4" /> Produtos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Executive Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard 
              title="Receita Líquida" 
              value={brl(analytics.current.totals.income)} 
              trend={12.5} 
              icon={TrendingUp}
            />
            <MetricCard 
              title="Ticket Médio" 
              value={brl(analytics.current.totals.ticketAverage)} 
              trend={-2.4} 
              icon={PieChart}
            />
            <MetricCard 
              title="Atendimentos" 
              value={analytics.current.totals.servedCount} 
              trend={8.1} 
              icon={Calendar}
            />
            <MetricCard 
              title="Venda de Produtos" 
              value={brl(analytics.current.totals.productsRevenue)} 
              trend={15.2} 
              icon={Package}
            />
          </div>

          {/* Main Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-background/40 backdrop-blur-sm border-gold-DEFAULT/10">
              <CardHeader>
                <CardTitle className="text-lg">Evolução do Faturamento</CardTitle>
                <CardDescription>Receita diária no período selecionado</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.current.series || []}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D4AF37" opacity={0.1} vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#888" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(v) => format(new Date(v), "dd/MM", { locale: ptBR })}
                    />
                    <YAxis 
                      stroke="#888" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(v: number) => `R$ ${v}`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111', border: '1px solid #D4AF37', borderRadius: '8px' }}
                      labelFormatter={(v) => format(new Date(v), "PPP", { locale: ptBR })}
                      formatter={(v: any) => [brl(v), "Receita"]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="income" 
                      stroke="#D4AF37" 
                      fillOpacity={1} 
                      fill="url(#colorRev)" 
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-background/40 backdrop-blur-sm border-gold-DEFAULT/10">
              <CardHeader>
                <CardTitle className="text-lg">Distribuição por Profissional</CardTitle>
                <CardDescription>Faturamento por barbeiro no período</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.current.breakdowns.byBarber || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D4AF37" opacity={0.1} vertical={false} />
                    <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      cursor={{ fill: '#D4AF37', opacity: 0.05 }}
                      contentStyle={{ backgroundColor: '#111', border: '1px solid #D4AF37', borderRadius: '8px' }}
                      formatter={(v: any) => [brl(v), "Receita"]}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {analytics.current.breakdowns.byBarber?.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "#D4AF37" : "#B08D26"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="finance" className="p-12 text-center border border-dashed border-gold-DEFAULT/20 rounded-xl">
          <Wallet className="w-12 h-12 text-gold-DEFAULT/20 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Relatórios Financeiros Avançados</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Em breve: DRE Completa, Fluxo de Caixa Projetado e Análise de Margem de Contribuição.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({ title, value, trend, icon: Icon }: any) {
  const isPositive = trend >= 0;
  
  return (
    <Card className="bg-background/40 backdrop-blur-sm border-gold-DEFAULT/10 hover:border-gold-DEFAULT/30 transition-all">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium opacity-70">{title}</CardTitle>
        <div className="w-8 h-8 rounded-full bg-gold-DEFAULT/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-gold-DEFAULT" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center gap-1 mt-1">
          {isPositive ? (
            <ArrowUpRight className="w-3 h-3 text-green-500" />
          ) : (
            <ArrowDownRight className="w-3 h-3 text-red-500" />
          )}
          <span className={`text-xs font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {Math.abs(trend)}%
          </span>
          <span className="text-[10px] text-muted-foreground ml-1">vs mês anterior</span>
        </div>
      </CardContent>
    </Card>
  );
}
