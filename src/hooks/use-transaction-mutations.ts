import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const defaultNewTransaction = {
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
  cashback_amount: "0",
};

interface Params {
  user: { id: string } | null;
  transactions: any[];
  newTransaction: any;
  setNewTransaction: (v: any) => void;
  setIsAddDialogOpen: (v: boolean) => void;
  editingTransaction: any;
  setEditingTransaction: (v: any) => void;
  setIsEditDialogOpen: (v: boolean) => void;
  fetchTransactions: (bId?: string | null) => Promise<void> | void;
  fetchAppointments: (bId?: string | null) => Promise<void> | void;
  fetchCustomerStats: () => Promise<void> | void;
}

export function useTransactionMutations({
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
}: Params) {
  const queryClient = useQueryClient();

  async function handleAddTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const { error } = await (supabase.from("transactions").insert as any)([{
      type: newTransaction.type,
      category: newTransaction.category,
      description: newTransaction.description,
      date: newTransaction.date,
      time: newTransaction.time,
      payment_method: newTransaction.payment_method,
      amount: parseFloat(newTransaction.amount) || 0,
      pix_amount: parseFloat(newTransaction.pix_amount) || 0,
      cash_amount: parseFloat(newTransaction.cash_amount) || 0,
      credit_card_amount: parseFloat(newTransaction.credit_card_amount) || 0,
      credits_amount: parseFloat(newTransaction.credits_amount) || 0,
      cashback_amount: parseFloat(newTransaction.cashback_amount) || 0,
      user_id: user.id,
      tenant_id: user.id,
      barber_id: newTransaction.barber_id === "none" ? null : newTransaction.barber_id,
      customer_id: newTransaction.customer_id === "none" ? null : newTransaction.customer_id,
    }]);

    if (error) {
      toast.error("Erro ao adicionar transação");
    } else {
      toast.success("Transação adicionada!");
      setIsAddDialogOpen(false);
      setNewTransaction({ ...defaultNewTransaction, date: new Date().toISOString().split('T')[0] });
      fetchTransactions();
      fetchCustomerStats();
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
    }
  }

  async function handleUpdateTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !editingTransaction) return;

    if (!editingTransaction.adjustment_reason) {
      toast.error("O motivo do ajuste é obrigatório.");
      return;
    }

    const transactionAmount = parseFloat(editingTransaction.amount);
    if (isNaN(transactionAmount)) {
      toast.error("O valor total é inválido.");
      return;
    }

    const isMixed = editingTransaction.payment_method === 'misto' || editingTransaction.payment_method === 'mixed';

    if (isMixed) {
      const total =
        Number(editingTransaction.pix_amount || 0) +
        Number(editingTransaction.cash_amount || 0) +
        Number(editingTransaction.credit_card_amount || 0) +
        Number(editingTransaction.debit_card_amount || 0) +
        Number(editingTransaction.credits_amount || 0) +
        Number(editingTransaction.cashback_amount || 0);

      if (Math.abs(total - transactionAmount) > 0.01) {
        toast.error(`A soma das formas de pagamento (R$ ${total.toFixed(2)}) precisa ser igual ao valor total (R$ ${transactionAmount.toFixed(2)}).`);
        return;
      }
    }

    const originalTransaction = transactions.find((t: any) => t.id === editingTransaction.id);

    const breakdown = isMixed ? {
      pix: Number(editingTransaction.pix_amount || 0),
      cash: Number(editingTransaction.cash_amount || 0),
      card_credit: Number(editingTransaction.credit_card_amount || 0),
      card_debit: Number(editingTransaction.debit_card_amount || 0),
      credits: Number(editingTransaction.credits_amount || 0),
      cashback: Number(editingTransaction.cashback_amount || 0),
    } : null;

    const updateData: any = {
      amount: parseFloat(editingTransaction.amount),
      type: editingTransaction.type,
      description: editingTransaction.description,
      category: editingTransaction.category,
      barber_id: editingTransaction.barber_id === "none" ? null : editingTransaction.barber_id,
      customer_id: editingTransaction.customer_id === "none" ? null : editingTransaction.customer_id,
      date: editingTransaction.date,
      time: editingTransaction.time,
      payment_method: isMixed ? 'mixed' : editingTransaction.payment_method,
      manual_adjustment: true,
      adjusted_by: user.id,
      adjusted_at: new Date().toISOString(),
      adjustment_reason: editingTransaction.adjustment_reason,
      pix_amount: editingTransaction.payment_method === 'pix' ? parseFloat(editingTransaction.amount) : (isMixed ? Number(editingTransaction.pix_amount || 0) : 0),
      cash_amount: editingTransaction.payment_method === 'cash' || editingTransaction.payment_method === 'dinheiro' ? parseFloat(editingTransaction.amount) : (isMixed ? Number(editingTransaction.cash_amount || 0) : 0),
      credit_card_amount: editingTransaction.payment_method === 'card' || editingTransaction.payment_method === 'credit_card' ? parseFloat(editingTransaction.amount) : (isMixed ? Number(editingTransaction.credit_card_amount || 0) : 0),
      debit_card_amount: editingTransaction.payment_method === 'debit_card' ? parseFloat(editingTransaction.amount) : (isMixed ? Number(editingTransaction.debit_card_amount || 0) : 0),
      credits_amount: editingTransaction.payment_method === 'credits' ? parseFloat(editingTransaction.amount) : (isMixed ? Number(editingTransaction.credits_amount || 0) : 0),
      cashback_amount: editingTransaction.payment_method === 'cashback' ? parseFloat(editingTransaction.amount) : (isMixed ? Number(editingTransaction.cashback_amount || 0) : 0),
      payment_breakdown: breakdown,
    };

    const { error } = await supabase
      .from("transactions")
      .update(updateData)
      .eq("id", editingTransaction.id);

    if (error) {
      toast.error("Erro ao atualizar transação");
      console.error(error);
    } else {
      if (editingTransaction.appointment_id) {
        const finalAmount = updateData.pix_amount + updateData.cash_amount + updateData.credit_card_amount + updateData.debit_card_amount;

        await supabase.from("appointments").update({
          payment_method: updateData.payment_method,
          pix_amount: updateData.pix_amount,
          cash_amount: updateData.cash_amount,
          credit_card_amount: updateData.credit_card_amount,
          debit_card_amount: updateData.debit_card_amount,
          credits_used: updateData.credits_amount,
          cashback_used: updateData.cashback_amount,
          final_amount: finalAmount,
          total_price: updateData.amount,
        }).eq("id", editingTransaction.appointment_id);
      }

      await supabase.from("financial_adjustment_logs").insert({
        transaction_id: editingTransaction.id,
        appointment_id: editingTransaction.appointment_id,
        tenant_id: editingTransaction.tenant_id,
        old_values: originalTransaction,
        new_values: updateData,
        reason: editingTransaction.adjustment_reason,
        adjusted_by: user.id,
        adjusted_at: new Date().toISOString(),
      });

      toast.success("Transação atualizada e auditada!");
      setIsEditDialogOpen(false);
      setEditingTransaction(null);
      fetchTransactions();
      fetchAppointments();
      fetchCustomerStats();
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
    }
  }

  async function handleDeleteTransaction(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta transação?")) return;

    const { error } = await supabase.from("transactions").delete().eq("id", id);

    if (error) {
      toast.error("Erro ao excluir transação");
    } else {
      toast.success("Transação excluída!");
      fetchTransactions();
    }
  }

  return { handleAddTransaction, handleUpdateTransaction, handleDeleteTransaction };
}
