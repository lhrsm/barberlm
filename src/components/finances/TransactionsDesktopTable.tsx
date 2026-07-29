import { format } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMixedPaymentLabel, formatTransactionDateForEdit, formatTransactionTimeForEdit } from "@/lib/finances-helpers";

interface TransactionsDesktopTableProps {
  transactions: any[];
  role?: string;
  onEdit: (transaction: any) => void;
  onOpenDetails: (appointmentId: string | null) => void;
  onDelete: (id: string) => void;
}

export function TransactionsDesktopTable({
  transactions,
  role,
  onEdit,
  onOpenDetails,
  onDelete,
}: TransactionsDesktopTableProps) {
  return (
    <div className="hidden md:block overflow-x-auto">
      <Table>
        <TableHeader className="bg-background">
          <TableRow className="hover:bg-transparent border-border">
            <TableHead className="w-[100px] text-muted-foreground">Data</TableHead>
            <TableHead className="w-[100px] text-muted-foreground">Hora</TableHead>
            <TableHead className="text-muted-foreground">Cliente</TableHead>
            <TableHead className="text-muted-foreground">Serviço</TableHead>
            {role !== 'barber' && <TableHead className="text-muted-foreground">Barbeiro</TableHead>}
            <TableHead className="text-muted-foreground">Status</TableHead>
            <TableHead className="text-muted-foreground">Pagamento</TableHead>
            <TableHead className="text-muted-foreground">Categoria</TableHead>
            <TableHead className="text-right text-muted-foreground">Serviço/Faturamento Bruto</TableHead>
            <TableHead className="text-right text-muted-foreground">Dinheiro Real (Caixa)</TableHead>
            <TableHead className="text-right text-muted-foreground">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                Nenhuma transação encontrada com os filtros selecionados.
              </TableCell>
            </TableRow>
          ) : (
            transactions.map((t) => (
              <TableRow key={t.id} className="border-border hover:bg-muted/50 transition-colors">
                <TableCell className="whitespace-nowrap text-foreground">
                  {t.appointment?.start_time
                    ? new Date(t.appointment.start_time).toLocaleDateString('pt-BR')
                    : (t.date ? new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR') : "-")}
                </TableCell>
                <TableCell>
                  <span className="text-sm font-medium">
                    {t.appointment?.start_time
                      ? format(new Date(t.appointment.start_time), 'HH:mm')
                      : (typeof t.time === 'string' ? t.time.substring(0, 5) : "--:--")}
                  </span>
                </TableCell>
                <TableCell className="font-medium">
                  {t.appointment?.customers?.name || (t.description?.includes("Cliente:") ? t.description.split("Cliente:")[1].split("-")[0].trim() : "-")}
                </TableCell>
                <TableCell>
                  {t.appointment?.services?.name || (t.description?.includes("Serviço:") ? t.description.split("Serviço:")[1].split("-")[0].trim() : (t.category === 'Serviço' ? t.description : "-"))}
                </TableCell>
                {role !== 'barber' && <TableCell>{t.barber?.name || "Geral"}</TableCell>}
                <TableCell>
                  {t.appointment ? (
                    <Badge className={cn(
                      "font-semibold",
                      t.appointment.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                        t.appointment.status === 'cancelled' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                          'bg-blue-500/10 text-blue-500 border-blue-500/20'
                    )} variant="outline">
                      {t.appointment.status === 'completed' ? 'Concluído' :
                        t.appointment.status === 'cancelled' ? 'Cancelado' : 'Agendado'}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-muted text-muted-foreground border-border">Manual</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {t.payment_method === 'misto' || t.payment_method === 'mixed' ? (
                      <div className="flex flex-col gap-0.5">
                        <Badge variant="outline" className="w-fit bg-orange-500/10 text-orange-500 border-orange-500/20 font-bold">MISTO</Badge>
                        <span className="text-[9px] text-muted-foreground uppercase leading-none font-medium mt-1">
                          {formatMixedPaymentLabel(t)}
                        </span>
                      </div>
                    ) : (
                      <>
                        {(t.payment_method === 'pix' || t.appointment?.payment_method === 'pix' || t.pix_amount > 0) && <Badge variant="outline" className="w-fit bg-emerald-500/10 text-emerald-500 border-emerald-500/20">PIX</Badge>}
                        {(t.payment_method === 'dinheiro' || t.appointment?.payment_method === 'cash' || t.cash_amount > 0) && <Badge variant="outline" className="w-fit bg-blue-500/10 text-blue-500 border-blue-500/20">Dinheiro</Badge>}
                        {(t.payment_method === 'credit_card' || t.payment_method === 'card' || t.appointment?.payment_method === 'card' || t.credit_card_amount > 0) && <Badge variant="outline" className="w-fit bg-purple-500/10 text-purple-500 border-purple-500/20">Cartão</Badge>}
                        {(t.payment_method === 'debit_card' || t.debit_card_amount > 0) && <Badge variant="outline" className="w-fit bg-indigo-500/10 text-indigo-500 border-indigo-500/20">Débito</Badge>}
                        {(t.payment_method === 'credits' || t.appointment?.payment_method === 'credits' || t.payment_method === 'wallet' || t.type === 'credit_reversed' || t.type === 'credit_granted' || t.credits_amount > 0) && <Badge variant="outline" className="w-fit bg-violet-500/10 text-violet-500 border-violet-500/20">Créditos</Badge>}
                        {(t.payment_method === 'cashback' || t.appointment?.payment_method === 'cashback' || t.type === 'cashback_reversed' || t.cashback_amount > 0) && <Badge variant="outline" className="w-fit bg-primary/10 text-primary border-primary/20">Cashback</Badge>}
                        {!t.appointment && !t.payment_method && <span className="text-xs uppercase font-medium text-muted-foreground">-</span>}
                      </>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{t.category || "-"}</TableCell>
                <TableCell className={cn("text-right font-bold", t.type === "income" ? "text-white" : "text-red-500")}>
                  R$ {Number(t.appointment?.original_total || t.appointment?.total_price || t.amount || 0).toFixed(2)}
                </TableCell>
                <TableCell className={cn("text-right font-bold", t.type === "income" ? (parseFloat(String(t.amount)) > 0 ? "text-emerald-500" : "text-violet-400") : "text-red-500")}>
                  {t.type === "income" ? (parseFloat(String(t.amount)) > 0 ? "+" : "★") : "-"} R$ {(parseFloat(String(t.amount)) || 0).toFixed(2)}
                  {t.type === "income" && (parseFloat(String(t.amount)) || 0) === 0 && <span className="block text-[10px] opacity-70">Crédito</span>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => onEdit({
                        ...t,
                        amount: String(t.amount || ""),
                        barber_id: t.barber_id || "none",
                        date: formatTransactionDateForEdit(t),
                        time: formatTransactionTimeForEdit(t),
                        payment_method: t.payment_method || (t.appointment?.payment_method === 'cash' ? 'dinheiro' : (t.appointment?.payment_method === 'card' ? 'credit_card' : t.appointment?.payment_method)) || "dinheiro",
                        category: t.category || "Serviço",
                        pix_amount: String(t.pix_amount || t.appointment?.pix_amount || 0),
                        cash_amount: String(t.cash_amount || t.appointment?.cash_amount || 0),
                        credit_card_amount: String(t.credit_card_amount || t.appointment?.credit_card_amount || 0),
                        debit_card_amount: String(t.debit_card_amount || t.appointment?.debit_card_amount || 0),
                        credits_amount: String(t.credits_amount || t.appointment?.credits_used || t.appointment?.credit_used || 0),
                        cashback_amount: String(t.cashback_amount || t.appointment?.cashback_used || 0),
                        adjustment_reason: "",
                      })}
                    >
                      <Edit2 size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-bold"
                      onClick={() => onOpenDetails(t.appointment_id)}
                    >
                      Detalhes
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() = aria-label="Excluir"> {
                        if (confirm("Tem certeza que deseja excluir esta transação?")) {
                          onDelete(t.id);
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
