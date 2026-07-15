import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { useProfessionalAuth } from "@/components/professional/ProfessionalAuthProvider";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Phone, ArrowRight, User, Timer, DollarSign, Package, MessageSquare, CreditCard, ChevronRight, Search, Eye, TicketPercent, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

import { Handshake } from "lucide-react";
import { Users, FileText, Calendar, Plus, TrendingUp, TrendingDown, Wallet, Edit2, Trash2, Clock, Check, X, Scissors, CircleDollarSign, CheckCircle2, XCircle, RefreshCcw, History, Crown, Calculator, FileDown } from "lucide-react";
import { format, parseISO } from "date-fns";
import { formatInTimeZone, toDate } from "date-fns-tz";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AppointmentDetailsModal } from "@/components/calendar/AppointmentDetailsModal";
import { useFinancial } from "@/hooks/use-financial";
import { PayCommissionDialog } from "@/components/commissions/PayCommissionDialog";
import { ManagerialView } from "@/components/finances/ManagerialView";
import { CouponsView } from "@/components/finances/CouponsView";
import { AuditTrail } from "@/components/finances/AuditTrail";
import { RefundsTab } from "@/components/finances/RefundsTab";
import { PendingTab } from "@/components/finances/PendingTab";
import { SettingsTab } from "@/components/finances/SettingsTab";
import { BarbersTab } from "@/components/finances/BarbersTab";
import { EditTransactionDialog } from "@/components/finances/EditTransactionDialog";
import { TransactionsMobileList } from "@/components/finances/TransactionsMobileList";
import { TransactionsTab } from "@/components/finances/TransactionsTab";
import { TransactionsDesktopTable } from "@/components/finances/TransactionsDesktopTable";
import { KpiCards } from "@/components/finances/KpiCards";
import { FinancesHeader } from "@/components/finances/FinancesHeader";
import { FinancesTabsList } from "@/components/finances/FinancesTabsList";
import { NovaTransacaoDialog } from "@/components/finances/NovaTransacaoDialog";
import { exportFinancesPdf, periodLabel, type ReportPeriod } from "@/lib/finances-pdf";
import {
  TIMEZONE,
  formatTransactionTimeForEdit,
  formatTransactionDateForEdit,
  formatMixedPaymentLabel,
  computeBarberPeriodRange,
  isDateInBarberRange,
} from "@/lib/finances-helpers";
import { useFinancesData } from "@/hooks/use-finances-data";
import { useTransactionMutations } from "@/hooks/use-transaction-mutations";


import { BarChart3 } from "lucide-react";

import { DefaultRouteError, DefaultRouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/finances")({
  component: FinancesComponent,
  errorComponent: DefaultRouteError,
  notFoundComponent: DefaultRouteNotFound,
});

function FinancesComponent() {
  const queryClient = useQueryClient();
  const { user: authUser, loading: authLoading, role: authRole } = useAuth();
  const { session, loading: profLoading } = useProfessionalAuth();
  const navigate = useNavigate();
  const { plan } = usePlanLimits();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newTransaction, setNewTransaction] = useState({ 
    amount: "", 
    type: "income", 
    description: "", 
    category: "Serviço", 
    barber_id: "none", 
    customer_id: "none",
    date: new Date().toISOString().split('T')[0], 
    time: "12:00",
    payment_method: "pix",
    pix_amount: "0",
    cash_amount: "0",
    credit_card_amount: "0",
    credits_amount: "0",
    cashback_amount: "0"
  });
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [financeTab, setFinanceTab] = useState<string>("transactions");
  const [globalPeriod, setGlobalPeriod] = useState<ReportPeriod>("month");
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);
  const [barberPeriodPreset, setBarberPeriodPreset] = useState<string>("today");
  const [barberCustomStart, setBarberCustomStart] = useState<string>("");
  const [barberCustomEnd, setBarberCustomEnd] = useState<string>("");
  const barberPeriodRange = useMemo(
    () => computeBarberPeriodRange(barberPeriodPreset, barberCustomStart, barberCustomEnd),
    [barberPeriodPreset, barberCustomStart, barberCustomEnd],
  );
  const inBarberRange = (date?: string | null) => isDateInBarberRange(date, barberPeriodRange);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const user = authUser || (session ? { id: session.barber_id } : null);
  const loading = authLoading || profLoading;
  const { summary: financialSummary, isLoading: loadingFinancial } = useFinancial(user?.id || null, dateFilter, dateFilter);

  // Refund filters
  const [refundStatusFilter, setRefundStatusFilter] = useState<string>("all");
  const [refundDateStartFilter, setRefundDateStartFilter] = useState<string>("");
  const [refundDateEndFilter, setRefundDateEndFilter] = useState<string>("");
  const [refundSearchTerm, setRefundSearchTerm] = useState<string>("");

  const role = authRole || (session ? 'barber' : null);

  const {
    transactions,
    appointments,
    barbers,
    barberCommissionSummaries,
    refundRequests,
    loadingRefunds,
    cashbackTransactions,
    customerStats,
    customers,
    totalCredits,
    totalCashback,
    fetchTransactions,
    fetchAppointments,
    fetchRefundRequests,
    fetchCashbackTransactions,
    fetchCustomerStats,
    fetchBarberCommissionSummaries,
  } = useFinancesData({
    user,
    role,
    barberPeriodRange,
    refundStatusFilter,
    refundDateStartFilter,
    refundDateEndFilter,
    refundSearchTerm,
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth" });
      return;
    }

    if (!loading && user && role === 'super_admin') {
      navigate({ to: "/admin" });
      return;
    }
  }, [user, loading, role, navigate]);

  // (data fetching, realtime, and balances moved into useFinancesData)

  const [isClearingData, setIsClearingData] = useState(false);

  const handleClearTestData = async () => {
    if (!user?.id) return;
    
    const confirm = window.confirm(
      "ATENÇÃO: Isso removerá TODOS os agendamentos, transações, estornos e históricos financeiros desta barbearia. \n\nClientes, barbeiros e serviços serão preservados.\n\nEsta ação NÃO PODE SER DESFEITA. Deseja continuar?"
    );

    if (!confirm) return;

    setIsClearingData(true);
    try {
      const { data, error } = await supabase.rpc('clear_barbershop_financial_data', {
        p_tenant_id: user.id
      });

      if (error) throw error;

      toast.success("Dados financeiros limpos com sucesso!");
      queryClient.invalidateQueries();
      fetchTransactions();
      fetchAppointments();
      fetchRefundRequests();
      fetchCashbackTransactions();
      fetchCustomerStats();
    } catch (err: any) {
      console.error("Error clearing data:", err);
      toast.error("Erro ao limpar dados: " + err.message);
    } finally {
      setIsClearingData(false);
    }
  };


  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchStatus = statusFilter === "all" || 
        (statusFilter === "manual" && !t.appointment && t.type !== 'credit_reversed' && t.type !== 'credit_granted' && t.type !== 'cashback_reversed') ||
        (statusFilter === "pix" && (t.payment_method === 'pix' || t.appointment?.payment_method === 'pix' || t.pix_amount > 0)) ||
        (statusFilter === "credits" && (t.payment_method === 'credits' || t.payment_method === 'wallet' || t.type === 'credit_reversed' || t.type === 'credit_granted' || t.credits_amount > 0)) ||
        (statusFilter === "cashback" && (t.payment_method === 'cashback' || t.type === 'cashback_reversed' || t.cashback_amount > 0)) ||
        (statusFilter === "expense" && t.type === 'expense') ||
        (t.appointment?.status === statusFilter);
      
      const matchDate = !dateFilter || t.date === dateFilter;
      
      return matchStatus && matchDate;
    });
  }, [transactions, statusFilter, dateFilter]);

  const summary = useMemo(() => {
    if (!financialSummary) {
      return {
        income: 0,
        realCashIncome: 0,
        servicesSold: 0,
        totalIncome: 0,
        totalExpense: 0,
        netRevenue: 0,
        balance: 0,
        usedCredits: 0,
        usedCashback: 0,
        cashbackConceded: 0,
        cashbackUsedTotal: 0,
        freelancersPart: 0,
        barbershopPart: 0,
        subscriptionCovered: 0,
        subscriptionExtra: 0,
        subscriptionAppointments: 0,
      };
    }

    const totalExpense = transactions.reduce((acc, t) => t.type === 'expense' ? acc + (parseFloat(String(t.amount)) || 0) : acc, 0);
    const totalRefundsPaid = (refundRequests || [])
      .filter(r => r && (r.status === 'completed' || r.status === 'paid'))
      .reduce((acc, r) => acc + (Number(r.amount) || 0), 0);

    const freelancersPart = barbers.reduce((acc, barber) => {
      const bApptIds = new Set();
      const bTotal = transactions
        .filter(t => t.barber_id === barber.id && t.type === 'income')
        .reduce((tAcc, t) => {
          if (t.appointment_id) {
            if (bApptIds.has(t.appointment_id)) return tAcc;
            bApptIds.add(t.appointment_id);
            // Considerar o valor total do serviço para comissão
            return tAcc + (Number(t.appointment?.original_total || t.appointment?.total_price || t.amount || 0));
          }
          return tAcc + (parseFloat(String(t.amount)) || 0);
        }, 0);
      return acc + (bTotal * (Number(barber.commission_rate || 0) / 100));
    }, 0);

    const subscriptionCovered = Number(financialSummary.assinatura_coberta || 0);
    const subscriptionExtra = Number(financialSummary.assinatura_extra || 0);
    const subscriptionAppointments = Number(financialSummary.atendimentos_assinatura || 0);

    return {
      income: financialSummary.servicos_vendidos,
      realCashIncome: financialSummary.entrada_caixa,
      servicesSold: financialSummary.servicos_vendidos,
      totalIncome: financialSummary.entrada_caixa,
      totalExpense,
      netRevenue: financialSummary.entrada_caixa - totalRefundsPaid,
      balance: financialSummary.entrada_caixa - totalExpense - totalRefundsPaid,
      usedCredits: financialSummary.creditos_utilizados,
      usedCashback: financialSummary.cashback_utilizado,
      cashbackConceded: financialSummary.cashback_concedido,
      cashbackUsedTotal: financialSummary.cashback_utilizado,
      freelancersPart,
      barbershopPart: financialSummary.servicos_vendidos - freelancersPart,
      subscriptionCovered,
      subscriptionExtra,
      subscriptionAppointments,
    };
  }, [financialSummary, transactions, refundRequests, barbers]);

  // fetchBalances moved into useFinancesData

  async function handleUpdateRefundStatus(refundId: string, newStatus: string, notes?: string) {
    try {
      const updatePayload: any = { status: newStatus, updated_at: new Date().toISOString() };
      if (notes !== undefined) updatePayload.admin_notes = notes;
      if (newStatus === 'completed') updatePayload.completed_at = new Date().toISOString();

      const { error } = await supabase.from("refund_requests").update(updatePayload).eq("id", refundId);
      if (error) throw error;

      if (['approved', 'completed', 'rejected'].includes(newStatus)) {
        const { data: refund } = await supabase
          .from("refund_requests")
          .select("appointment_id, amount")
          .eq("id", refundId)
          .single();
        if (refund) {
          await supabase.functions.invoke('appointment-notifications', {
            body: {
              appointmentId: refund.appointment_id,
              type: 'refund_updated',
              status: newStatus,
              amount: refund.amount,
              updatedBy: { type: 'admin' }
            }
          });
        }
      }
      if (newStatus === 'completed') {
        const { data: refund } = await supabase
          .from("refund_requests")
          .select("amount, appointment_id, tenant_id, payment_id")
          .eq("id", refundId)
          .single();
        if (refund) {
          const { data: appt } = await supabase
            .from("appointments")
            .select("services(name), customers(name), barber_id")
            .eq("id", refund.appointment_id)
            .single();
          await supabase.from("transactions").insert({
            amount: refund.amount,
            type: "expense",
            description: `Estorno Pago (Pix): ${appt?.services?.name || "Serviço"} - ${appt?.customers?.name || "Cliente"}`,
            category: "Estorno",
            barber_id: appt?.barber_id,
            appointment_id: refund.appointment_id,
            user_id: refund.tenant_id,
            tenant_id: refund.tenant_id,
            date: new Date().toISOString().split('T')[0],
            payment_method: 'pix',
            pix_amount: refund.amount
          });
          await supabase.from("appointments").update({ refund_status: 'completed' }).eq("id", refund.appointment_id);
        }
      }

      toast.success(`Solicitação ${newStatus === 'approved' ? 'aprovada' : newStatus === 'completed' ? 'marcada como paga' : 'rejeitada'}!`);
      fetchRefundRequests();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar status");
    }
  }


  const { handleAddTransaction, handleUpdateTransaction, handleDeleteTransaction } = useTransactionMutations({
    user,
    transactions,
    newTransaction,
    setNewTransaction,
    setIsAddDialogOpen,
    editingTransaction,
    setEditingTransaction,
    setIsEditDialogOpen,
    fetchTransactions,
    fetchAppointments,
    fetchCustomerStats,
  });


  if (authLoading) return null;
  if (!user) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <FinancesHeader
          role={role}
          globalPeriod={globalPeriod}
          setGlobalPeriod={setGlobalPeriod}
          isExportingPdf={isExportingPdf}
          onExportPdf={async () => {
            if (plan === 'free') {
              toast.error("Relatórios PDF estão disponíveis apenas no plano Pro.");
              navigate({ to: "/subscription" });
              return;
            }
            try {
              setIsExportingPdf(true);
              toast.info(`Gerando PDF — ${periodLabel[globalPeriod]}...`);
              const { data: prof } = await supabase
                .from("profiles")
                .select("business_name, responsible_name")
                .eq("id", user.id)
                .maybeSingle();
              const fname = await exportFinancesPdf({
                tenantId: user.id,
                period: globalPeriod,
                businessName: prof?.business_name || prof?.responsible_name || "Barbex",
              });
              toast.success(`Relatório gerado: ${fname}`);
            } catch (err: any) {
              console.error(err);
              toast.error("Falha ao gerar PDF: " + (err?.message || "erro desconhecido"));
            } finally {
              setIsExportingPdf(false);
            }
          }}
          onSyncAll={() => fetchRefundRequests()}
          onRecalculateBalances={async () => {
            const { data: customers } = await supabase.from('customers').select('id, tenant_id').eq('tenant_id', user.id);
            if (customers) {
              toast.info(`Recalculando saldos de ${customers.length} clientes...`);
              for (const c of customers) {
                await supabase.rpc('recalculate_customer_credit_balance', { p_customer_id: c.id });
                await supabase.rpc('recalculate_customer_cashback_balance', { p_customer_id: c.id });
              }
              fetchTransactions();
              fetchCustomerStats();
              queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
              fetchCashbackTransactions();
              fetchCustomerStats();
              toast.success("Saldos recalculados com sucesso!");
            }
          }}
        >
            <NovaTransacaoDialog
              open={isAddDialogOpen}
              onOpenChange={setIsAddDialogOpen}
              newTransaction={newTransaction}
              setNewTransaction={setNewTransaction}
              onSubmit={handleAddTransaction}
              customers={customers}
              barbers={barbers}
            />
        </FinancesHeader>




        <KpiCards
          summary={summary}
          role={role}
          refundRequests={refundRequests || []}
          customerStats={customerStats}
          appointments={appointments}
          dateFilter={dateFilter}
        />

        <Tabs value={financeTab} onValueChange={setFinanceTab} className="w-full">
          <FinancesTabsList role={role} financeTab={financeTab} setFinanceTab={setFinanceTab} />



          {role !== 'barber' && user && (
            <TabsContent value="managerial" className="pt-4">
              <ManagerialView tenantId={user.id} initialPeriod={globalPeriod as any} periodKey={globalPeriod} />
            </TabsContent>
          )}

          {role !== 'barber' && user && (
            <TabsContent value="coupons" className="pt-4">
              <CouponsView tenantId={user.id} initialPeriod={globalPeriod as any} periodKey={globalPeriod} />
            </TabsContent>
          )}


          <TabsContent value="transactions" className="pt-4 space-y-4">
            <TransactionsTab
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              dateFilter={dateFilter}
              setDateFilter={setDateFilter}
              filteredTransactions={filteredTransactions}
              role={role}
              editingTransaction={editingTransaction}
              setEditingTransaction={setEditingTransaction}
              isEditDialogOpen={isEditDialogOpen}
              setIsEditDialogOpen={setIsEditDialogOpen}
              handleUpdateTransaction={handleUpdateTransaction}
              handleDeleteTransaction={handleDeleteTransaction}
              setSelectedAppointmentId={setSelectedAppointmentId}
              setIsDetailsModalOpen={setIsDetailsModalOpen}
              customers={customers}
              barbers={barbers}
            />
          </TabsContent>

        <TabsContent value="settings">
          <SettingsTab handleClearTestData={handleClearTestData} isClearingData={isClearingData} />
        </TabsContent>

          <TabsContent value="pending" className="pt-4">
            <PendingTab
              appointments={appointments}
              role={role}
              onOpenDetails={(id) => {
                setSelectedAppointmentId(id);
                setIsDetailsModalOpen(true);
              }}
            />
          </TabsContent>


          <TabsContent value="barbers" className="pt-4 space-y-4">
            <BarbersTab
              tenantId={user.id}
              barbers={barbers}
              barberCommissionSummaries={barberCommissionSummaries}
              transactions={transactions}
              barberPeriodPreset={barberPeriodPreset}
              setBarberPeriodPreset={setBarberPeriodPreset}
              barberCustomStart={barberCustomStart}
              setBarberCustomStart={setBarberCustomStart}
              barberCustomEnd={barberCustomEnd}
              setBarberCustomEnd={setBarberCustomEnd}
              barberPeriodRange={barberPeriodRange}
              inBarberRange={inBarberRange}
              onCommissionPaid={fetchBarberCommissionSummaries}
            />
          </TabsContent>


          <TabsContent value="refunds" className="pt-0">
            <RefundsTab
              refundRequests={refundRequests}
              loadingRefunds={loadingRefunds}
              refundStatusFilter={refundStatusFilter}
              setRefundStatusFilter={setRefundStatusFilter}
              refundDateStartFilter={refundDateStartFilter}
              setRefundDateStartFilter={setRefundDateStartFilter}
              refundDateEndFilter={refundDateEndFilter}
              setRefundDateEndFilter={setRefundDateEndFilter}
              refundSearchTerm={refundSearchTerm}
              setRefundSearchTerm={setRefundSearchTerm}
              handleUpdateRefundStatus={handleUpdateRefundStatus}
            />
          </TabsContent>
        </Tabs>
      </div>
      
      <AppointmentDetailsModal 
        appointmentId={selectedAppointmentId || undefined}
        open={isDetailsModalOpen}
        onOpenChange={setIsDetailsModalOpen}
        onSuccess={() => {
          const barberIdFilter = role === 'barber' ? user?.id : null;
          fetchTransactions(barberIdFilter);
          fetchAppointments(barberIdFilter);
        }}
      />
    </AppLayout>
  );
}

