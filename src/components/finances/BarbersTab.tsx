import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PayCommissionDialog } from "@/components/commissions/PayCommissionDialog";

type BarberPeriodRange = { start: string | null; end: string | null };

type Props = {
  tenantId: string;
  barbers: any[];
  barberCommissionSummaries: Record<string, any>;
  transactions: any[];
  barberPeriodPreset: string;
  setBarberPeriodPreset: (v: string) => void;
  barberCustomStart: string;
  setBarberCustomStart: (v: string) => void;
  barberCustomEnd: string;
  setBarberCustomEnd: (v: string) => void;
  barberPeriodRange: BarberPeriodRange;
  inBarberRange: (date?: string | null) => boolean;
  onCommissionPaid: () => void;
};

export function BarbersTab({
  tenantId,
  barbers,
  barberCommissionSummaries,
  transactions,
  barberPeriodPreset,
  setBarberPeriodPreset,
  barberCustomStart,
  setBarberCustomStart,
  barberCustomEnd,
  setBarberCustomEnd,
  barberPeriodRange,
  inBarberRange,
  onCommissionPaid,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-card p-4 border border-border rounded-xl text-foreground">
        <div className="space-y-2">
          <Label>Período</Label>
          <Select value={barberPeriodPreset} onValueChange={setBarberPeriodPreset}>
            <SelectTrigger className="w-[200px] h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="yesterday">Ontem</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mês</SelectItem>
              <SelectItem value="prev_month">Mês anterior</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
              <SelectItem value="all">Todas as Datas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {barberPeriodPreset === "custom" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="barber-start">Data inicial</Label>
              <input id="barber-start" type="date" value={barberCustomStart}
                onChange={(e) => setBarberCustomStart(e.target.value)}
                className="flex h-10 w-[170px] rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="barber-end">Data final</Label>
              <input id="barber-end" type="date" value={barberCustomEnd}
                onChange={(e) => setBarberCustomEnd(e.target.value)}
                className="flex h-10 w-[170px] rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" />
            </div>
          </>
        )}
        {barberPeriodRange.start && (
          <div className="text-xs text-muted-foreground self-center">
            {barberPeriodRange.start === barberPeriodRange.end
              ? `Em ${barberPeriodRange.start}`
              : `${barberPeriodRange.start} → ${barberPeriodRange.end ?? "hoje"}`}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {barbers.map((barber) => {
          const commissionSummary = barberCommissionSummaries[barber.id] || {};
          const commissionRate = Number(barber.commission_rate || 0);
          const totalReceived = Number(commissionSummary.production_total || 0);
          const barberPart = Number(commissionSummary.commission_total || 0);
          const commissionPending = Number(commissionSummary.commission_pending || 0);
          const commissionPaid = Number(commissionSummary.commission_paid || 0);
          const barbershopPartFromBarber = totalReceived - barberPart;
          const apptCount = Number(commissionSummary.completed_appointments || 0);
          const pendingCount = Number(commissionSummary.pending_count || 0);
          const avgTicket = Number(commissionSummary.average_ticket || 0);

          return (
            <Card key={barber.id} className="bg-card border-border text-foreground">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-white">{barber.name}</CardTitle>
                <p className="text-xs text-muted-foreground">Comissão: {commissionRate}%</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center border-b border-border pb-2">
                  <span className="text-sm text-muted-foreground">Total Atendido</span>
                  <span className="font-bold text-white">R$ {totalReceived.toFixed(2)}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span>Parte do Barbeiro ({commissionRate}%)</span>
                    <span className="text-emerald-500 font-medium">R$ {barberPart.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span>Parte da Barbearia</span>
                    <span className="text-primary font-medium">R$ {barbershopPartFromBarber.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm pt-2 border-t border-border">
                    <span className="text-muted-foreground">Comissão pendente</span>
                    <span className="text-yellow-500 font-bold">R$ {commissionPending.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Comissão paga</span>
                    <span className="text-emerald-500 font-bold">R$ {commissionPaid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm pt-2 border-t border-border">
                    <span className="text-muted-foreground">Atendimentos</span>
                    <span className="font-bold text-white">{apptCount}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Ticket Médio</span>
                    <span className="font-medium text-white">R$ {avgTicket.toFixed(2)}</span>
                  </div>
                  {commissionPending > 0 && (
                    <PayCommissionDialog
                      tenantId={tenantId}
                      barberId={barber.id}
                      barberName={barber.name}
                      startDate={barberPeriodRange.start}
                      endDate={barberPeriodRange.end}
                      pendingAmount={commissionPending}
                      pendingCount={pendingCount || apptCount}
                      triggerClassName="w-full mt-3"
                      onPaid={onCommissionPaid}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        <Card className="bg-card border-primary/20 text-foreground shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-white font-black">Barbearia Geral (Total)</CardTitle>
            <p className="text-xs text-muted-foreground">Soma de todos os ganhos da barbearia</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              const generalTransactions = transactions.filter(t =>
                !t.barber_id &&
                t.type === 'income' &&
                inBarberRange(t.date)
              );
              const totalGeneralOnly = generalTransactions.reduce((acc, t) => {
                const val = parseFloat(String(t.amount)) || 0;
                if (val === 0 && (t.description?.includes("CRÉDITOS") || t.description?.includes("Créditos") || t.description?.includes("Uso de Crédito") || t.description?.includes("Abatimento"))) {
                  const match = t.description.match(/R\$\s*([\d.]+)/);
                  if (match) return acc + parseFloat(match[1]);
                }
                if (t.description?.includes("Abatimento Créditos: R$")) {
                  const match = t.description?.match(/Abatimento Créditos: R\$\s*([\d.]+)/);
                  const creditedAmount = match ? parseFloat(match[1]) : 0;
                  return acc + val + creditedAmount;
                }
                return acc + val;
              }, 0);

              const totalFromBarbers = barbers.reduce((acc, barber) => {
                const s = barberCommissionSummaries[barber.id] || {};
                return acc + (Number(s.production_total || 0) - Number(s.commission_total || 0));
              }, 0);

              const finalTotal = totalGeneralOnly + totalFromBarbers;

              return (
                <>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground italic font-medium uppercase tracking-tight">Resultado da Barbearia</span>
                    <span className="text-2xl font-black text-emerald-500 italic tracking-tight">R$ {finalTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Vindo dos Barbeiros</span>
                    <span className="text-foreground">R$ {totalFromBarbers.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-border pt-2 mt-2">
                    <span className="font-bold text-white uppercase tracking-tighter">Total Acumulado</span>
                    <span className="text-xl font-black text-primary">R$ {finalTotal.toFixed(2)}</span>
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>

        {barbers.length === 0 && (
          <div className="col-span-full text-center py-12 border border-border rounded-xl bg-card text-foreground font-medium">
            Nenhum barbeiro cadastrado.
          </div>
        )}
      </div>
    </div>
  );
}
