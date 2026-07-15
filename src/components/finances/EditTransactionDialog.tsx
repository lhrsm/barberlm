import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface EditTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTransaction: any;
  setEditingTransaction: (t: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  customers: Array<{ id: string; name: string }>;
  barbers: Array<{ id: string; name: string }>;
}

export function EditTransactionDialog({
  open,
  onOpenChange,
  editingTransaction,
  setEditingTransaction,
  onSubmit,
  customers,
  barbers,
}: EditTransactionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[650px] bg-[#0b0f17] border-amber-500/30 shadow-2xl shadow-amber-500/10 rounded-[24px] overflow-hidden p-0 text-white">
        <DialogHeader className="p-6 sm:p-8 border-b border-white/5">
          <DialogTitle className="text-2xl font-black text-white tracking-tight">Ajuste Manual de Transação</DialogTitle>
          <p className="text-xs text-zinc-400 font-medium">Realize ajustes financeiros manuais para correção de fluxos e registros.</p>
        </DialogHeader>
        {editingTransaction && (
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="p-6 sm:p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="edit-date" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Data</Label>
                    <Input id="edit-date" type="date" value={editingTransaction.date} onChange={(e) => setEditingTransaction({ ...editingTransaction, date: e.target.value })} required className="bg-[#05070d] border-[#1f2937] text-white focus:border-amber-500/50 transition-all h-11 rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-time" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Horário</Label>
                    <Input id="edit-time" type="time" value={editingTransaction.time} onChange={(e) => setEditingTransaction({ ...editingTransaction, time: e.target.value })} required className="bg-[#05070d] border-[#1f2937] text-white focus:border-amber-500/50 transition-all h-11 rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-amount" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Valor Total (R$)</Label>
                    <Input id="edit-amount" type="number" step="0.01" value={editingTransaction.amount} onChange={(e) => setEditingTransaction({ ...editingTransaction, amount: e.target.value })} required className="bg-[#05070d] border-[#1f2937] text-white focus:border-amber-500/50 transition-all h-11 rounded-xl font-black text-lg" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-type" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Tipo</Label>
                    <Select value={editingTransaction.type} onValueChange={(val) => setEditingTransaction({ ...editingTransaction, type: val })}>
                      <SelectTrigger className="bg-[#05070d] border-[#1f2937] text-white focus:ring-amber-500/50 h-11 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0b0f17] border-[#1f2937] text-white">
                        <SelectItem value="income" className="focus:bg-amber-500/20 focus:text-white">Entrada (Receita)</SelectItem>
                        <SelectItem value="expense" className="focus:bg-amber-500/20 focus:text-white">Saída (Despesa)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="edit-customer" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Cliente</Label>
                    <Select value={editingTransaction.customer_id || "none"} onValueChange={(val) => setEditingTransaction({ ...editingTransaction, customer_id: val })}>
                      <SelectTrigger className="bg-[#05070d] border-[#1f2937] text-white focus:ring-amber-500/50 h-11 rounded-xl">
                        <SelectValue placeholder="Selecione um cliente" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0b0f17] border-[#1f2937] text-white">
                        <SelectItem value="none" className="focus:bg-amber-500/20 focus:text-white">Nenhum / Geral</SelectItem>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id} className="focus:bg-amber-500/20 focus:text-white">{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-payment-method" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Forma de Pagamento</Label>
                    <Select value={editingTransaction.payment_method} onValueChange={(val) => setEditingTransaction({ ...editingTransaction, payment_method: val })}>
                      <SelectTrigger className="bg-[#05070d] border-[#1f2937] text-white focus:ring-amber-500/50 h-11 rounded-xl">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0b0f17] border-[#1f2937] text-white">
                        <SelectItem value="pix" className="focus:bg-amber-500/20 focus:text-white">PIX</SelectItem>
                        <SelectItem value="dinheiro" className="focus:bg-amber-500/20 focus:text-white">Dinheiro</SelectItem>
                        <SelectItem value="credit_card" className="focus:bg-amber-500/20 focus:text-white">Cartão de Crédito</SelectItem>
                        <SelectItem value="debit_card" className="focus:bg-amber-500/20 focus:text-white">Cartão de Débito</SelectItem>
                        <SelectItem value="barbershop" className="focus:bg-amber-500/20 focus:text-white">Pagar na Barbearia</SelectItem>
                        <SelectItem value="credits" className="focus:bg-amber-500/20 focus:text-white">Créditos</SelectItem>
                        <SelectItem value="cashback" className="focus:bg-amber-500/20 focus:text-white">Cashback</SelectItem>
                        <SelectItem value="misto" className="focus:bg-amber-500/20 focus:text-white">Misto (Múltiplas Formas)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-category-dropdown" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Categoria</Label>
                    <Select value={editingTransaction.category} onValueChange={(val) => setEditingTransaction({ ...editingTransaction, category: val })}>
                      <SelectTrigger className="bg-[#05070d] border-[#1f2937] text-white focus:ring-amber-500/50 h-11 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0b0f17] border-[#1f2937] text-white">
                        <SelectItem value="Serviço" className="focus:bg-amber-500/20 focus:text-white">Serviço</SelectItem>
                        <SelectItem value="Produto" className="focus:bg-amber-500/20 focus:text-white">Produto</SelectItem>
                        <SelectItem value="Ambos" className="focus:bg-amber-500/20 focus:text-white">Ambos</SelectItem>
                        <SelectItem value="Outros" className="focus:bg-amber-500/20 focus:text-white">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-barber" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Barbeiro Responsável</Label>
                    <Select value={editingTransaction.barber_id} onValueChange={(val) => setEditingTransaction({ ...editingTransaction, barber_id: val })}>
                      <SelectTrigger className="bg-[#05070d] border-[#1f2937] text-white focus:ring-amber-500/50 h-11 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0b0f17] border-[#1f2937] text-white">
                        <SelectItem value="none" className="focus:bg-amber-500/20 focus:text-white">Nenhum / Geral</SelectItem>
                        {barbers.map((b) => (
                          <SelectItem key={b.id} value={b.id} className="focus:bg-amber-500/20 focus:text-white">{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {(editingTransaction.payment_method === 'misto' || editingTransaction.payment_method === 'mixed' || editingTransaction.manual_adjustment) && (
                <div className="bg-amber-500/5 p-6 rounded-2xl border border-amber-500/20 shadow-inner space-y-6">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-amber-500">Detalhamento do Pagamento</h4>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[9px] uppercase font-black tracking-widest text-zinc-500">Valor PIX</Label>
                      <Input type="number" step="0.01" value={editingTransaction.pix_amount} onChange={(e) => setEditingTransaction({ ...editingTransaction, pix_amount: e.target.value })} className="h-10 bg-[#05070d]/50 border-[#1f2937] text-white focus:border-amber-500/40 text-sm rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[9px] uppercase font-black tracking-widest text-zinc-500">Valor Dinheiro</Label>
                      <Input type="number" step="0.01" value={editingTransaction.cash_amount} onChange={(e) => setEditingTransaction({ ...editingTransaction, cash_amount: e.target.value })} className="h-10 bg-[#05070d]/50 border-[#1f2937] text-white focus:border-amber-500/40 text-sm rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[9px] uppercase font-black tracking-widest text-zinc-500">Valor Cartão</Label>
                      <Input type="number" step="0.01" value={editingTransaction.credit_card_amount} onChange={(e) => setEditingTransaction({ ...editingTransaction, credit_card_amount: e.target.value })} className="h-10 bg-[#05070d]/50 border-[#1f2937] text-white focus:border-amber-500/40 text-sm rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[9px] uppercase font-black tracking-widest text-zinc-500">Valor Débito</Label>
                      <Input type="number" step="0.01" value={editingTransaction.debit_card_amount} onChange={(e) => setEditingTransaction({ ...editingTransaction, debit_card_amount: e.target.value })} className="h-10 bg-[#05070d]/50 border-[#1f2937] text-white focus:border-amber-500/40 text-sm rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[9px] uppercase font-black tracking-widest text-zinc-500">Valor Créditos</Label>
                      <Input type="number" step="0.01" value={editingTransaction.credits_amount} onChange={(e) => setEditingTransaction({ ...editingTransaction, credits_amount: e.target.value })} className="h-10 bg-[#05070d]/50 border-[#1f2937] text-white focus:border-amber-500/40 text-sm rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[9px] uppercase font-black tracking-widest text-zinc-500">Valor Cashback</Label>
                      <Input type="number" step="0.01" value={editingTransaction.cashback_amount} onChange={(e) => setEditingTransaction({ ...editingTransaction, cashback_amount: e.target.value })} className="h-10 bg-[#05070d]/50 border-[#1f2937] text-white focus:border-amber-500/40 text-sm rounded-xl" />
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <div className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border",
                      Math.abs((Number(editingTransaction.pix_amount || 0) + Number(editingTransaction.cash_amount || 0) + Number(editingTransaction.credit_card_amount || 0) + Number(editingTransaction.debit_card_amount || 0) + Number(editingTransaction.credits_amount || 0) + Number(editingTransaction.cashback_amount || 0)) - parseFloat(editingTransaction.amount)) < 0.01
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        : "bg-red-500/10 text-red-500 border-red-500/20"
                    )}>
                      Soma: R$ {(Number(editingTransaction.pix_amount || 0) + Number(editingTransaction.cash_amount || 0) + Number(editingTransaction.credit_card_amount || 0) + Number(editingTransaction.debit_card_amount || 0) + Number(editingTransaction.credits_amount || 0) + Number(editingTransaction.cashback_amount || 0)).toFixed(2)}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-description" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Descrição Pública (Exibida na Tabela)</Label>
                  <Input id="edit-description" value={editingTransaction.description} onChange={(e) => setEditingTransaction({ ...editingTransaction, description: e.target.value })} className="bg-[#05070d] border-[#1f2937] text-white focus:border-amber-500/50 transition-all h-11 rounded-xl" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-internal-notes" className="text-[10px] font-black uppercase tracking-widest text-amber-500/80">Observações Internas</Label>
                  <Textarea id="edit-internal-notes" value={editingTransaction.notes || ""} onChange={(e) => setEditingTransaction({ ...editingTransaction, notes: e.target.value })} placeholder="Anotações que não aparecem para o cliente..." className="bg-[#05070d] border-[#1f2937] text-white focus:border-amber-500/50 transition-all rounded-xl min-h-[100px] resize-none text-sm placeholder:text-zinc-600" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-reason" className="text-[10px] font-black uppercase tracking-widest text-red-400 flex items-center gap-1.5">
                    Motivo do Ajuste <span className="text-[8px] text-red-500/60 font-medium">(Obrigatório)</span>
                  </Label>
                  <Input id="edit-reason" value={editingTransaction.adjustment_reason} onChange={(e) => setEditingTransaction({ ...editingTransaction, adjustment_reason: e.target.value })} placeholder="Ex: Erro no lançamento original, Cliente mudou forma de pagamento..." required className="bg-[#05070d] border-red-500/20 focus:border-red-500 text-white transition-all h-11 rounded-xl text-sm placeholder:text-zinc-600" />
                </div>
              </div>
            </div>

            <DialogFooter className="p-6 sm:p-8 bg-[#05070d]/50 border-t border-white/5 flex flex-col sm:flex-row gap-3">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none h-12 rounded-xl border border-zinc-800 text-zinc-400 font-bold hover:bg-zinc-800 hover:text-white transition-all order-2 sm:order-1">
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 sm:flex-none h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-black px-10 shadow-lg shadow-amber-500/20 transition-all active:scale-95 order-1 sm:order-2">
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
