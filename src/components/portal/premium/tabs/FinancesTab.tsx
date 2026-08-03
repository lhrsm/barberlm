import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

type Props = {
  creditTransactions: any[];
  cashbackTransactions: any[];
};

export function FinancesTab({ creditTransactions, cashbackTransactions }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="bg-white/5 border-white/10 shadow-lg backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            Extrato de Créditos
          </CardTitle>
          <CardDescription className="text-gray-400">Suas movimentações de saldo em crédito</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {creditTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500 italic space-y-2">
                <p>Nenhuma movimentação de créditos.</p>
              </div>
            ) : (
              creditTransactions.map((tx: any) => (
                <div key={tx.id} className="group flex items-center justify-between py-4 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors rounded-lg px-2 -mx-2">
                  <div className="flex-1 mr-3">
                    <p className="text-sm font-bold text-white group-hover:text-gold transition-colors">
                      {tx.description || (tx.type === 'reversion' ? 'Crédito Devolvido' : 'Crédito Adicionado')}
                    </p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">
                      {format(parseISO(tx.created_at), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                  <span className={cn(
                    "font-black text-sm shrink-0", 
                    (tx.type === 'reversion' || tx.type === 'credit_granted' || tx.type === 'refund_credit' || tx.type === 'adjustment_add' || tx.amount > 0) 
                      ? "text-emerald-500" 
                      : "text-red-500"
                  )}>
                    {(tx.type === 'reversion' || tx.type === 'credit_granted' || tx.type === 'refund_credit' || tx.type === 'adjustment_add' || tx.amount > 0) ? "+" : "-"} R$ {Math.abs(Number(tx.amount)).toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10 shadow-lg backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-gold shadow-[0_0_10px_rgba(212,175,55,0.5)]" />
            Extrato de Cashback
          </CardTitle>
          <CardDescription className="text-gray-400">Recompensas acumuladas por serviços</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {cashbackTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500 italic space-y-2">
                <p>Nenhuma movimentação de cashback.</p>
              </div>
            ) : (
              cashbackTransactions.map((tx: any) => (
                <div key={tx.id} className="group flex items-center justify-between py-4 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors rounded-lg px-2 -mx-2">
                  <div className="flex-1 mr-3">
                    <p className="text-sm font-bold text-white group-hover:text-gold transition-colors">
                      {tx.description || (tx.type === 'cashback_earned' ? 'Ganho por Agendamento' : 'Uso em Agendamento')}
                    </p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">
                      {format(parseISO(tx.created_at), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                  <span className={cn(
                    "font-black text-sm shrink-0",
                    tx.type === 'cashback_earned' ? "text-gold" : "text-red-500"
                  )}>
                    {tx.type === 'cashback_earned' ? "+" : "-"} R$ {Number(tx.amount).toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
