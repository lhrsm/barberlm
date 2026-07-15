import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Edit2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMixedPaymentLabel, formatTransactionDateForEdit, formatTransactionTimeForEdit } from "@/lib/finances-helpers";

interface TransactionsMobileListProps {
  transactions: any[];
  onOpenDetails: (appointmentId: string | null) => void;
  onEdit: (transaction: any) => void;
  onDelete: (id: string) => void;
}

export function TransactionsMobileList({
  transactions,
  onOpenDetails,
  onEdit,
  onDelete,
}: TransactionsMobileListProps) {
  if (transactions.length === 0) {
    return (
      <div className="md:hidden divide-y divide-border">
        <div className="p-8 text-center text-muted-foreground italic">
          Nenhuma transação encontrada.
        </div>
      </div>
    );
  }

  return (
    <div className="md:hidden divide-y divide-border">
      {transactions.map((t) => (
        <div
          key={t.id}
          className="p-4 space-y-4 hover:bg-muted/50 transition-colors cursor-pointer"
          onClick={() => onOpenDetails(t.appointment_id)}
        >
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {t.appointment?.start_time
                  ? new Date(t.appointment.start_time).toLocaleDateString('pt-BR')
                  : (t.date ? new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR') : "-")}
              </span>
              <span className="text-lg font-black text-foreground">
                {t.appointment?.start_time
                  ? format(new Date(t.appointment.start_time), 'HH:mm')
                  : (typeof t.time === 'string' ? t.time.substring(0, 5) : "--:--")}
              </span>
            </div>
            <div className={cn("text-right", t.type === "income" ? (parseFloat(String(t.amount)) > 0 ? "text-emerald-500" : "text-violet-400") : "text-red-500")}>
              <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">{t.type === "income" ? "Entrada" : "Saída"}</p>
              <span className="text-lg font-black italic">
                R$ {(() => {
                  const val = parseFloat(String(t.amount)) || 0;
                  if (val === 0 && (t.description?.includes("CRÉDITOS") || t.description?.includes("Créditos") || t.description?.includes("Uso de Crédito"))) {
                    const match = t.description.match(/R\$\s*([\d.]+)/);
                    return match ? parseFloat(match[1]).toFixed(2) : "0.00";
                  }
                  return val.toFixed(2);
                })()}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-background/50 p-3 rounded-xl border border-border">
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Descrição</p>
              <p className="text-sm font-bold text-foreground leading-tight">
                {t.appointment?.customers?.name ? (
                  <>
                    <span className="text-primary">Cliente: {t.appointment.customers.name}</span><br />
                    {t.description || "-"}
                  </>
                ) : (
                  t.description || "-"
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-background/50 p-3 rounded-xl border border-border">
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Status</p>
                {t.appointment ? (
                  <Badge className={cn(
                    "text-[10px] font-black uppercase italic",
                    t.appointment.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                      t.appointment.status === 'cancelled' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                        'bg-blue-500/10 text-blue-500 border-blue-500/20'
                  )} variant="outline">
                    {t.appointment.status === 'completed' ? 'Concluído' :
                      t.appointment.status === 'cancelled' ? 'Cancelado' : 'Agendado'}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px] font-black uppercase italic">
                    {t.type === 'credit_reversed' || t.type === 'cashback_reversed' ? 'Estorno de Saldo' :
                      t.type === 'credit_granted' ? 'Crédito Concedido' : 'Manual'}
                  </Badge>
                )}
              </div>
              <div className="bg-background/50 p-3 rounded-xl border border-border">
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Pagamento</p>
                <div className="flex flex-wrap gap-1">
                  {t.payment_method === 'misto' || t.payment_method === 'mixed' ? (
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className="text-[10px] font-bold bg-orange-500/10 text-orange-500 border-orange-500/20">MISTO</Badge>
                      <span className="text-[9px] text-muted-foreground uppercase leading-tight font-medium">
                        {formatMixedPaymentLabel(t)}
                      </span>
                    </div>
                  ) : (
                    <>
                      {(t.payment_method === 'pix' || t.appointment?.payment_method === 'pix' || t.pix_amount > 0) && <Badge variant="outline" className="text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border-emerald-500/20">PIX</Badge>}
                      {(t.payment_method === 'dinheiro' || t.appointment?.payment_method === 'cash' || t.cash_amount > 0) && <Badge variant="outline" className="text-[10px] font-bold bg-blue-500/10 text-blue-500 border-blue-500/20">Dinheiro</Badge>}
                      {(t.payment_method === 'credit_card' || t.payment_method === 'card' || t.appointment?.payment_method === 'card' || t.credit_card_amount > 0) && <Badge variant="outline" className="text-[10px] font-bold bg-purple-500/10 text-purple-500 border-purple-500/20">Cartão</Badge>}
                      {(t.payment_method === 'debit_card' || t.debit_card_amount > 0) && <Badge variant="outline" className="text-[10px] font-bold bg-indigo-500/10 text-indigo-500 border-indigo-500/20">Débito</Badge>}
                      {(t.payment_method === 'credits' || t.appointment?.payment_method === 'credits' || t.payment_method === 'wallet' || t.type === 'credit_reversed' || t.type === 'credit_granted' || t.credits_amount > 0) && <Badge variant="outline" className="text-[10px] font-bold bg-violet-500/10 text-violet-500 border-violet-500/20">Créditos</Badge>}
                      {(t.payment_method === 'cashback' || t.appointment?.payment_method === 'cashback' || t.type === 'cashback_reversed' || t.cashback_amount > 0) && <Badge variant="outline" className="text-[10px] font-bold bg-primary/10 text-primary border-primary/20">Cashback</Badge>}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            {t.appointment && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-auto text-xs gap-1 font-bold rounded-xl border-border bg-background hover:bg-accent"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetails(t.appointment_id);
                }}
              >
                <Eye size={12} /> Detalhes
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-auto text-xs gap-1 font-bold rounded-xl border-border bg-background hover:bg-accent"
              onClick={(e) => {
                e.stopPropagation();
                onEdit({
                  ...t,
                  amount: String(t.amount || ""),
                  barber_id: t.barber_id || "none",
                  date: formatTransactionDateForEdit(t),
                  time: formatTransactionTimeForEdit(t),
                  payment_method: t.payment_method || (t.appointment?.payment_method === 'cash' ? 'dinheiro' : t.appointment?.payment_method) || "dinheiro",
                  category: t.category || "Serviço",
                  pix_amount: String(t.pix_amount || t.appointment?.pix_amount || 0),
                  cash_amount: String(t.cash_amount || 0),
                  credit_card_amount: String(t.credit_card_amount || 0),
                  debit_card_amount: String(t.debit_card_amount || 0),
                  credits_amount: String(t.credits_amount || t.appointment?.credits_used || t.appointment?.credit_used || 0),
                  cashback_amount: String(t.cashback_amount || t.appointment?.cashback_used || 0),
                  adjustment_reason: "",
                });
              }}
            >
              <Edit2 size={12} /> Editar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-auto text-xs gap-1 font-bold rounded-xl text-red-500 hover:bg-red-500/10"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(t.id);
              }}
            >
              <Trash2 size={12} /> Excluir
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
