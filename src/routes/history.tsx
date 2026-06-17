import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useTenant } from "@/hooks/use-tenant";
import { supabase } from "@/integrations/supabase/client";
import {
  PremiumTabs,
  PremiumTabsList,
  PremiumTabsBody,
  PremiumTabsContent,
} from "@/components/ui/premium-tabs";
import { Calendar, DollarSign, Gift, Wallet, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/history")({
  component: HistoryComponent,
  head: () => ({
    meta: [
      { title: "Histórico — Barbex" },
      { name: "description", content: "Histórico de agendamentos, financeiro, cashback e créditos." },
    ],
  }),
});

type Row = Record<string, any>;

function HistoryComponent() {
  const { tenantId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Row[]>([]);
  const [finance, setFinance] = useState<Row[]>([]);
  const [cashback, setCashback] = useState<Row[]>([]);
  const [credits, setCredits] = useState<Row[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    const anyDb = supabase as any;
    (async () => {
      setLoading(true);
      const [a, f, cb, cr] = await Promise.all([
        anyDb.from("appointments").select("id, scheduled_at, status, customer_name, service_name, total_price").eq("tenant_id", tenantId).order("scheduled_at", { ascending: false }).limit(50),
        anyDb.from("financial_transactions").select("id, created_at, type, amount, description").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50),
        anyDb.from("cashback_transactions").select("id, created_at, type, amount, customer_name").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50),
        anyDb.from("customer_credits").select("id, created_at, amount, customer_name, reason").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50),
      ]);
      setAppointments(a.data || []);
      setFinance(f.data || []);
      setCashback(cb.data || []);
      setCredits(cr.data || []);
      setLoading(false);
    })();
  }, [tenantId]);

  const fmtDate = (d?: string) => (d ? new Date(d).toLocaleString("pt-BR") : "—");
  const fmtMoney = (v?: number) =>
    typeof v === "number" ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

  const EmptyOrLoading = ({ items }: { items: Row[] }) =>
    loading ? (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando…
      </div>
    ) : items.length === 0 ? (
      <p className="text-center text-slate-500 py-16">Nada por aqui ainda.</p>
    ) : null;

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#050816] p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter">Histórico</h1>
          <p className="text-sm text-slate-400 mt-1">Tudo o que aconteceu na sua barbearia.</p>
        </div>

        <PremiumTabs defaultValue="appointments" className="space-y-0">
          <PremiumTabsList
            tabs={[
              { value: "appointments", label: "Agendamentos", icon: Calendar },
              { value: "finance", label: "Financeiro", icon: DollarSign },
              { value: "cashback", label: "Cashback", icon: Gift },
              { value: "credits", label: "Créditos", icon: Wallet },
            ]}
          />
          <PremiumTabsBody>
            <PremiumTabsContent value="appointments">
              <EmptyOrLoading items={appointments} />
              {appointments.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/5 text-[10px] uppercase font-bold text-slate-500">
                        <th className="p-3">Data</th>
                        <th className="p-3">Cliente</th>
                        <th className="p-3">Serviço</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-300">
                      {appointments.map((r) => (
                        <tr key={r.id} className="border-b border-white/5">
                          <td className="p-3">{fmtDate(r.scheduled_at)}</td>
                          <td className="p-3 font-bold text-white">{r.customer_name || "—"}</td>
                          <td className="p-3">{r.service_name || "—"}</td>
                          <td className="p-3"><Badge className="bg-white/5 text-slate-300">{r.status || "—"}</Badge></td>
                          <td className="p-3 text-right">{fmtMoney(Number(r.total_price))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </PremiumTabsContent>

            <PremiumTabsContent value="finance">
              <EmptyOrLoading items={finance} />
              {finance.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/5 text-[10px] uppercase font-bold text-slate-500">
                        <th className="p-3">Data</th>
                        <th className="p-3">Tipo</th>
                        <th className="p-3">Descrição</th>
                        <th className="p-3 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-300">
                      {finance.map((r) => (
                        <tr key={r.id} className="border-b border-white/5">
                          <td className="p-3">{fmtDate(r.created_at)}</td>
                          <td className="p-3"><Badge className={r.type === "income" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}>{r.type}</Badge></td>
                          <td className="p-3">{r.description || "—"}</td>
                          <td className="p-3 text-right font-bold text-white">{fmtMoney(Number(r.amount))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </PremiumTabsContent>

            <PremiumTabsContent value="cashback">
              <EmptyOrLoading items={cashback} />
              {cashback.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/5 text-[10px] uppercase font-bold text-slate-500">
                        <th className="p-3">Data</th>
                        <th className="p-3">Cliente</th>
                        <th className="p-3">Tipo</th>
                        <th className="p-3 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-300">
                      {cashback.map((r) => (
                        <tr key={r.id} className="border-b border-white/5">
                          <td className="p-3">{fmtDate(r.created_at)}</td>
                          <td className="p-3 font-bold text-white">{r.customer_name || "—"}</td>
                          <td className="p-3">{r.type || "—"}</td>
                          <td className="p-3 text-right">{fmtMoney(Number(r.amount))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </PremiumTabsContent>

            <PremiumTabsContent value="credits">
              <EmptyOrLoading items={credits} />
              {credits.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/5 text-[10px] uppercase font-bold text-slate-500">
                        <th className="p-3">Data</th>
                        <th className="p-3">Cliente</th>
                        <th className="p-3">Motivo</th>
                        <th className="p-3 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-300">
                      {credits.map((r) => (
                        <tr key={r.id} className="border-b border-white/5">
                          <td className="p-3">{fmtDate(r.created_at)}</td>
                          <td className="p-3 font-bold text-white">{r.customer_name || "—"}</td>
                          <td className="p-3">{r.reason || "—"}</td>
                          <td className="p-3 text-right">{fmtMoney(Number(r.amount))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </PremiumTabsContent>
          </PremiumTabsBody>
        </PremiumTabs>
      </div>
    </AppLayout>
  );
}
