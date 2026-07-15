import { useMemo } from "react";

interface Params {
  financialSummary: any;
  transactions: any[];
  refundRequests: any[];
  barbers: any[];
}

export function useFinancesSummary({ financialSummary, transactions, refundRequests, barbers }: Params) {
  return useMemo(() => {
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

    const totalExpense = transactions.reduce(
      (acc, t) => (t.type === "expense" ? acc + (parseFloat(String(t.amount)) || 0) : acc),
      0,
    );
    const totalRefundsPaid = (refundRequests || [])
      .filter((r) => r && (r.status === "completed" || r.status === "paid"))
      .reduce((acc, r) => acc + (Number(r.amount) || 0), 0);

    const freelancersPart = barbers.reduce((acc, barber) => {
      const bApptIds = new Set();
      const bTotal = transactions
        .filter((t) => t.barber_id === barber.id && t.type === "income")
        .reduce((tAcc, t) => {
          if (t.appointment_id) {
            if (bApptIds.has(t.appointment_id)) return tAcc;
            bApptIds.add(t.appointment_id);
            return (
              tAcc +
              Number(t.appointment?.original_total || t.appointment?.total_price || t.amount || 0)
            );
          }
          return tAcc + (parseFloat(String(t.amount)) || 0);
        }, 0);
      return acc + bTotal * (Number(barber.commission_rate || 0) / 100);
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
}
