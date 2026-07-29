import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface NewTransactionState {
  date: string;
  time: string;
  amount: string;
  customer_id: string;
  type: string;
  payment_method: string;
  pix_amount: string;
  cash_amount: string;
  credit_card_amount: string;
  credits_amount: string;
  cashback_amount: string;
  category: string;
  barber_id: string;
  description: string;
  [key: string]: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newTransaction: NewTransactionState;
  setNewTransaction: (t: NewTransactionState) => void;
  onSubmit: (e: React.FormEvent) => void | Promise<void>;
  customers: Array<{ id: string; name: string }>;
  barbers: Array<{ id: string; name: string }>;
}

export function NovaTransacaoDialog({
  open,
  onOpenChange,
  newTransaction,
  setNewTransaction,
  onSubmit,
  customers,
  barbers,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2 whitespace-nowrap w-full md:w-auto h-11 px-6 rounded-[14px] font-bold border-0 text-black bg-gradient-to-b from-[#F5D062] to-[#C9971A] shadow-[0_10px_26px_-10px_rgba(212,175,55,0.75)] transition-all duration-200 hover:bg-gradient-to-b hover:from-[#FFE082] hover:to-gold hover:shadow-[0_16px_36px_-12px_rgba(212,175,55,0.9)] hover:-translate-y-0.5 hover:scale-[1.02] active:translate-y-0 active:scale-100">
          <Plus size={18} strokeWidth={3} /> Nova Transação
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Transação</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={newTransaction.date}
                onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Horário</Label>
              <Input
                id="time"
                type="time"
                value={newTransaction.time}
                onChange={(e) => setNewTransaction({ ...newTransaction, time: e.target.value })}
                required
                className="bg-[#05070d] border-[#1f2937] text-white h-11 rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Valor Total (R$)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={newTransaction.amount}
              onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
              required
              className="bg-[#05070d] border-[#1f2937] text-white h-11 rounded-xl font-bold"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_id" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Cliente (Opcional)</Label>
            <Select
              value={newTransaction.customer_id}
              onValueChange={(val) => setNewTransaction({ ...newTransaction, customer_id: val })}
            >
              <SelectTrigger className="bg-[#05070d] border-[#1f2937] text-white h-11 rounded-xl">
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent className="bg-[#0b0f17] border-[#1f2937] text-white">
                <SelectItem value="none" className="focus:bg-amber-500/20">Nenhum / Geral</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="focus:bg-amber-500/20">{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Tipo de Movimentação</Label>
            <Select
              value={newTransaction.type}
              onValueChange={(val) => setNewTransaction({ ...newTransaction, type: val })}
            >
              <SelectTrigger className="bg-[#05070d] border-[#1f2937] text-white h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Entrada (Receita)</SelectItem>
                <SelectItem value="expense">Saída (Despesa)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_method" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Forma de Pagamento</Label>
            <Select
              value={newTransaction.payment_method}
              onValueChange={(val) => setNewTransaction({ ...newTransaction, payment_method: val })}
            >
              <SelectTrigger className="bg-[#05070d] border-[#1f2937] text-white h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0b0f17] border-[#1f2937] text-white">
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="cash">Dinheiro</SelectItem>
                <SelectItem value="card">Cartão</SelectItem>
                <SelectItem value="wallet">Créditos</SelectItem>
                <SelectItem value="cashback">Cashback</SelectItem>
                <SelectItem value="misto">Misto (Múltiplas Formas)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(newTransaction.payment_method === 'misto' || newTransaction.payment_method === 'mixed') && (
            <div className="bg-amber-500/5 p-4 rounded-xl border border-amber-500/20 space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">Detalhamento Misto</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase font-bold text-zinc-500">PIX</Label>
                  <Input type="number" step="0.01" value={newTransaction.pix_amount} onChange={(e) => setNewTransaction({ ...newTransaction, pix_amount: e.target.value })} className="h-9 bg-[#05070d] border-[#1f2937] text-white text-xs rounded-lg" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase font-bold text-zinc-500">Dinheiro</Label>
                  <Input type="number" step="0.01" value={newTransaction.cash_amount} onChange={(e) => setNewTransaction({ ...newTransaction, cash_amount: e.target.value })} className="h-9 bg-[#05070d] border-[#1f2937] text-white text-xs rounded-lg" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase font-bold text-zinc-500">Cartão</Label>
                  <Input type="number" step="0.01" value={newTransaction.credit_card_amount} onChange={(e) => setNewTransaction({ ...newTransaction, credit_card_amount: e.target.value })} className="h-9 bg-[#05070d] border-[#1f2937] text-white text-xs rounded-lg" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase font-bold text-zinc-500">Créditos</Label>
                  <Input type="number" step="0.01" value={newTransaction.credits_amount} onChange={(e) => setNewTransaction({ ...newTransaction, credits_amount: e.target.value })} className="h-9 bg-[#05070d] border-[#1f2937] text-white text-xs rounded-lg" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase font-bold text-zinc-500">Cashback</Label>
                  <Input type="number" step="0.01" value={newTransaction.cashback_amount} onChange={(e) => setNewTransaction({ ...newTransaction, cashback_amount: e.target.value })} className="h-9 bg-[#05070d] border-[#1f2937] text-white text-xs rounded-lg" />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="category" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Categoria</Label>
            <Input
              id="category"
              placeholder="Serviço, Aluguel, Produtos, etc."
              value={newTransaction.category}
              onChange={(e) => setNewTransaction({ ...newTransaction, category: e.target.value })}
              className="bg-[#05070d] border-[#1f2937] text-white h-11 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="barber_id" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Barbeiro Responsável</Label>
            <Select
              value={newTransaction.barber_id}
              onValueChange={(val) => setNewTransaction({ ...newTransaction, barber_id: val })}
            >
              <SelectTrigger className="bg-[#05070d] border-[#1f2937] text-white h-11 rounded-xl">
                <SelectValue placeholder="Selecione um barbeiro" />
              </SelectTrigger>
              <SelectContent className="bg-[#0b0f17] border-[#1f2937] text-white">
                <SelectItem value="none" className="focus:bg-amber-500/20">Nenhum / Geral</SelectItem>
                {barbers.map((b) => (
                  <SelectItem key={b.id} value={b.id} className="focus:bg-amber-500/20">{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              value={newTransaction.description}
              onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
            />
          </div>

          <Button type="submit" className="w-full bg-black text-white hover:scale-105 transition-all h-12 rounded-xl font-bold uppercase tracking-tight">Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
