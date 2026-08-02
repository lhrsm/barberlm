import { memo, useMemo } from "react";
import { Crown, CalendarCheck, PiggyBank, Repeat } from "lucide-react";

interface Props {
  plans: any[];
  services: any[];
}

/**
 * Camada explicativa do Clube Premium (como funciona + economia estimada).
 * Puramente visual: calcula a partir dos planos e serviços já carregados.
 */
export const SubscriptionValueProps = memo(function SubscriptionValueProps({ plans, services }: Props) {
  const { cheapest, avgService, savings } = useMemo(() => {
    const prices = (plans || []).map((p) => Number(p.monthly_price || 0)).filter((n) => n > 0);
    const cheapest = prices.length ? Math.min(...prices) : 0;
    const svc = (services || []).map((s) => Number(s.price || 0)).filter((n) => n > 0);
    const avgService = svc.length ? svc.reduce((a, b) => a + b, 0) / svc.length : 0;
    const usesArr = (plans || []).map((p) => Number(p.max_uses_per_month || 0)).filter((n) => n > 0);
    const uses = usesArr.length ? Math.max(...usesArr) : 1;
    const savings = avgService > 0 && cheapest > 0 ? Math.max(0, avgService * uses - cheapest) : 0;
    return { cheapest, avgService, savings };
  }, [plans, services]);

  const steps = [
    { icon: Crown, title: "Escolha seu plano", text: "Planos mensais com benefícios recorrentes." },
    { icon: CalendarCheck, title: "Agende normalmente", text: "O benefício do clube é aplicado no agendamento." },
    { icon: Repeat, title: "Renove sem esforço", text: "Cobrança recorrente, cancele quando quiser." },
  ];

  return (
    <div className="mb-14 grid gap-4 md:grid-cols-3">
      {steps.map((s) => (
        <div
          key={s.title}
          className="rounded-3xl border border-gold/15 bg-black/50 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gold/45"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10">
            <s.icon size={18} className="text-gold" aria-hidden />
          </div>
          <h4 className="mt-4 text-sm font-black uppercase tracking-tight text-white">{s.title}</h4>
          <p className="mt-1 text-sm leading-relaxed text-slate-400">{s.text}</p>
        </div>
      ))}
      {savings > 0 && (
        <div className="md:col-span-3 flex flex-wrap items-center gap-4 rounded-3xl border border-gold/30 bg-gradient-to-r from-gold/10 to-transparent p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10">
            <PiggyBank size={18} className="text-gold" aria-hidden />
          </div>
          <p className="text-sm font-medium text-slate-300">
            Assinando a partir de <span className="font-black text-white">R$ {cheapest.toFixed(2)}/mês</span>, você
            pode economizar até <span className="font-black text-gold">R$ {savings.toFixed(2)}</span> por mês em
            relação ao valor avulso médio de R$ {avgService.toFixed(2)} por serviço.
          </p>
        </div>
      )}
    </div>
  );
});
