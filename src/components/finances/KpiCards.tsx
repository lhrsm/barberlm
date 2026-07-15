import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Scissors,
  CircleDollarSign,
  Crown,
  TrendingUp,
  TrendingDown,
  Clock,
  Wallet,
  User,
  TicketPercent,
  History,
} from "lucide-react";

interface KpiCardsProps {
  summary: {
    servicesSold: number;
    realCashIncome: number;
    subscriptionCovered: number;
    subscriptionAppointments: number;
    subscriptionExtra: number;
    netRevenue: number;
    totalExpense: number;
    usedCredits: number;
    usedCashback: number;
    cashbackConceded: number;
    balance: number;
  };
  role: string | null | undefined;
  refundRequests: Array<{ status: string; amount: number | string }>;
  customerStats: { total_credits: number; total_cashback: number };
  appointments: Array<{ final_amount?: number | string; total_price?: number | string }>;
  dateFilter?: string | null;
}

export function KpiCards({
  summary,
  role,
  refundRequests,
  customerStats,
  appointments,
  dateFilter,
}: KpiCardsProps) {
  const requestedRefunds = (refundRequests || [])
    .filter((r) => r.status === "requested")
    .reduce((acc, r) => acc + (Number(r.amount) || 0), 0);

  const pendingPayments = appointments.reduce(
    (acc, a) => acc + (Number(a.final_amount || a.total_price) || 0),
    0
  );

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold">Serviços Vendidos</CardTitle>
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Scissors className="h-4 w-4 text-blue-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">R$ {summary.servicesSold.toFixed(2)}</div>
          <p className="text-[10px] text-muted-foreground font-medium mt-1">Valor cheio dos atendimentos concluídos (inclui parte coberta por assinatura)</p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold">Entrada em Caixa</CardTitle>
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <CircleDollarSign className="h-4 w-4 text-emerald-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-500">R$ {summary.realCashIncome.toFixed(2)}</div>
          <p className="text-[10px] text-muted-foreground font-medium mt-1">Dinheiro novo recebido (PIX/Cartão/Dinheiro) — não inclui valor coberto por assinatura</p>
        </CardContent>
      </Card>

      <Card className="bg-card border-amber-500/30 text-card-foreground shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold">Coberto por Assinatura</CardTitle>
          <div className="p-2 bg-amber-500/10 rounded-lg">
            <Crown className="h-4 w-4 text-amber-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-500">R$ {summary.subscriptionCovered.toFixed(2)}</div>
          <p className="text-[10px] text-muted-foreground font-medium mt-1">
            {summary.subscriptionAppointments} atendimento(s)
            {summary.subscriptionExtra > 0 && ` · + R$ ${summary.subscriptionExtra.toFixed(2)} extra cobrados`}
          </p>
        </CardContent>
      </Card>

      {role !== "barber" && (
        <>
          <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Receita Líquida</CardTitle>
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">R$ {summary.netRevenue.toFixed(2)}</div>
              <p className="text-[10px] text-muted-foreground font-medium mt-1">Caixa - Estornos Pagos - Créditos - Cashback</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Saídas (Estornos Pagos)</CardTitle>
              <div className="p-2 bg-red-500/10 rounded-lg">
                <TrendingDown className="h-4 w-4 text-red-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">R$ {summary.totalExpense.toFixed(2)}</div>
              <p className="text-[10px] text-muted-foreground font-medium mt-1">Estornos Pix concluídos</p>
            </CardContent>
          </Card>
        </>
      )}

      <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold">Saídas</CardTitle>
          <div className="p-2 bg-red-500/10 rounded-lg">
            <TrendingDown className="h-4 w-4 text-red-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-500">R$ {summary.totalExpense.toFixed(2)}</div>
          <p className="text-[10px] text-muted-foreground font-medium mt-1">Total de despesas e estornos pagos</p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold">Estornos Solicitados</CardTitle>
          <div className="p-2 bg-orange-500/10 rounded-lg">
            <Clock className="h-4 w-4 text-orange-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-500">R$ {requestedRefunds.toFixed(2)}</div>
          <p className="text-[10px] text-muted-foreground font-medium mt-1">Aguardando processamento</p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold">Créditos Concedidos</CardTitle>
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <Wallet className="h-4 w-4 text-purple-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-400">R$ {customerStats.total_credits.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          <p className="text-[10px] text-muted-foreground font-medium mt-1">Saldo acumulado por todos os clientes</p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold">Créditos Utilizados</CardTitle>
          <div className="p-2 bg-indigo-500/10 rounded-lg">
            <User className="h-4 w-4 text-indigo-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-indigo-400">R$ {summary.usedCredits.toFixed(2)}</div>
          <p className="text-[10px] text-muted-foreground font-medium mt-1">Abatidos em pagamentos</p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold">Cashback Concedido (Período)</CardTitle>
          <div className="p-2 bg-primary/10 rounded-lg">
            <TicketPercent className="h-4 w-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">R$ {summary.cashbackConceded.toFixed(2)}</div>
          <p className="text-[10px] text-muted-foreground font-medium mt-1">Gerado {dateFilter ? "no dia selecionado" : "no período"}</p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold">Cashback Total (Clientes)</CardTitle>
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Wallet className="h-4 w-4 text-emerald-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-500">R$ {customerStats.total_cashback.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          <p className="text-[10px] text-muted-foreground font-medium mt-1">Saldo acumulado por todos os clientes</p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold">Cashback Utilizado</CardTitle>
          <div className="p-2 bg-orange-500/10 rounded-lg">
            <History className="h-4 w-4 text-orange-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-400">R$ {summary.usedCashback.toFixed(2)}</div>
          <p className="text-[10px] text-muted-foreground font-medium mt-1">Abatidos em pagamentos</p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold">Saldo de Créditos</CardTitle>
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Wallet className="h-4 w-4 text-emerald-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-500">R$ {customerStats.total_credits.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          <p className="text-[10px] text-muted-foreground font-medium mt-1">Soma de todos os saldos atuais</p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold">Saldo de Cashback</CardTitle>
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Wallet className="h-4 w-4 text-emerald-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-500">R$ {customerStats.total_cashback.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          <p className="text-[10px] text-muted-foreground font-medium mt-1">Soma de todos os saldos atuais</p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold">Pagamentos Pendentes</CardTitle>
          <div className="p-2 bg-yellow-500/10 rounded-lg">
            <Clock className="h-4 w-4 text-yellow-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-500">R$ {pendingPayments.toFixed(2)}</div>
          <p className="text-[10px] text-muted-foreground font-medium mt-1">Agendamentos não concluídos</p>
        </CardContent>
      </Card>

      {role !== "barber" && (
        <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Saldo em Caixa</CardTitle>
            <div className="p-2 bg-primary/10 rounded-lg">
              <CircleDollarSign className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">R$ {summary.balance.toFixed(2)}</div>
            <p className="text-[10px] text-muted-foreground font-medium mt-1">Real em caixa (Entrada Líquida - Despesas)</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
