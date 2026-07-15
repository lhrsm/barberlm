import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Params {
  user: { id: string } | null;
  fetchTransactions: (bId?: string | null) => Promise<void> | void;
  fetchAppointments: (bId?: string | null) => Promise<void> | void;
  fetchRefundRequests: () => Promise<void> | void;
  fetchCashbackTransactions: () => Promise<void> | void;
  fetchCustomerStats: () => Promise<void> | void;
}

export function useFinancesActions({
  user,
  fetchTransactions,
  fetchAppointments,
  fetchRefundRequests,
  fetchCashbackTransactions,
  fetchCustomerStats,
}: Params) {
  const queryClient = useQueryClient();
  const [isClearingData, setIsClearingData] = useState(false);

  const handleClearTestData = async () => {
    if (!user?.id) return;

    const confirm = window.confirm(
      "ATENÇÃO: Isso removerá TODOS os agendamentos, transações, estornos e históricos financeiros desta barbearia. \n\nClientes, barbeiros e serviços serão preservados.\n\nEsta ação NÃO PODE SER DESFEITA. Deseja continuar?",
    );

    if (!confirm) return;

    setIsClearingData(true);
    try {
      const { error } = await supabase.rpc("clear_barbershop_financial_data", {
        p_tenant_id: user.id,
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

  async function handleUpdateRefundStatus(refundId: string, newStatus: string, notes?: string) {
    try {
      const updatePayload: any = { status: newStatus, updated_at: new Date().toISOString() };
      if (notes !== undefined) updatePayload.admin_notes = notes;
      if (newStatus === "completed") updatePayload.completed_at = new Date().toISOString();

      const { error } = await supabase
        .from("refund_requests")
        .update(updatePayload)
        .eq("id", refundId);
      if (error) throw error;

      if (["approved", "completed", "rejected"].includes(newStatus)) {
        const { data: refund } = await supabase
          .from("refund_requests")
          .select("appointment_id, amount")
          .eq("id", refundId)
          .single();
        if (refund) {
          await supabase.functions.invoke("appointment-notifications", {
            body: {
              appointmentId: refund.appointment_id,
              type: "refund_updated",
              status: newStatus,
              amount: refund.amount,
              updatedBy: { type: "admin" },
            },
          });
        }
      }
      if (newStatus === "completed") {
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
            date: new Date().toISOString().split("T")[0],
            payment_method: "pix",
            pix_amount: refund.amount,
          });
          await supabase
            .from("appointments")
            .update({ refund_status: "completed" })
            .eq("id", refund.appointment_id);
        }
      }

      toast.success(
        `Solicitação ${newStatus === "approved" ? "aprovada" : newStatus === "completed" ? "marcada como paga" : "rejeitada"}!`,
      );
      fetchRefundRequests();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar status");
    }
  }

  return { isClearingData, handleClearTestData, handleUpdateRefundStatus };
}
