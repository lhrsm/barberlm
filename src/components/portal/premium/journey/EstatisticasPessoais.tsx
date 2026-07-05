import * as React from "react";
import { motion } from "framer-motion";
import {
  Calendar as CalendarIcon,
  DollarSign,
  TrendingDown,
  Wallet,
  ShoppingBag,
  Clock,
  User as UserIcon,
  Scissors,
} from "lucide-react";
import { differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

type Props = {
  appointments: any[];
  sales: any[];
  customerData: any;
};

export function EstatisticasPessoais({ appointments, sales, customerData }: Props) {
  const completed = appointments.filter((a) => a.status === "completed");
  const invested = completed.reduce((s, a) => s + Number(a.service_price || a.total_price || 0), 0);
  const subSaved = completed
    .filter((a) => a.covered_by_subscription)
    .reduce((s, a) => s + Number(a.service_price || 0), 0);
  const cashSaved = completed.reduce((s, a) => s + Number(a.cashback_used || 0), 0);
  const products = sales?.length || 0;

  const created = customerData?.created_at ? new Date(customerData.created_at) : null;
  const daysAsClient = created ? Math.max(0, differenceInDays(new Date(), created)) : 0;
  const monthsAsClient = Math.max(1, Math.round(daysAsClient / 30));

  const barberMap = new Map<string, number>();
  completed.forEach((a) => {
    const n = a.barbers?.name;
    if (n) barberMap.set(n, (barberMap.get(n) || 0) + 1);
  });
  const favBarber = Array.from(barberMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  const svcMap = new Map<string, number>();
  completed.forEach((a) => {
    const n = a.services?.name || a.service_name;
    if (n) svcMap.set(n, (svcMap.get(n) || 0) + 1);
  });
  const favService = Array.from(svcMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  const stats = [
    { label: "Atendimentos", value: String(completed.length), icon: CalendarIcon, accent: "gold" },
    { label: "Investido", value: `R$ ${invested.toFixed(0)}`, icon: DollarSign, accent: "white" },
    { label: "Economia assinatura", value: `R$ ${subSaved.toFixed(0)}`, icon: TrendingDown, accent: "emerald" },
    { label: "Economia cashback", value: `R$ ${cashSaved.toFixed(0)}`, icon: Wallet, accent: "emerald" },
    { label: "Produtos", value: String(products), icon: ShoppingBag, accent: "white" },
    { label: "Tempo conosco", value: monthsAsClient >= 12 ? `${Math.floor(monthsAsClient / 12)} anos` : `${monthsAsClient} meses`, icon: Clock, accent: "white" },
    { label: "Barbeiro favorito", value: favBarber, icon: UserIcon, accent: "gold" },
    { label: "Serviço favorito", value: favService, icon: Scissors, accent: "gold" },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-[0.3em] font-black text-[#D4AF37]">Sua rotina</p>
        <h3 className="text-lg md:text-xl font-black text-white mt-1">Estatísticas pessoais</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className={cn(
              "rounded-2xl border p-4 backdrop-blur transition-all",
              "bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20",
              s.accent === "gold" && "hover:border-[#D4AF37]/40",
              s.accent === "emerald" && "hover:border-emerald-500/40",
            )}
          >
            <div
              className={cn(
                "h-8 w-8 rounded-xl grid place-items-center mb-3",
                s.accent === "gold" && "bg-[#D4AF37]/15 text-[#D4AF37]",
                s.accent === "emerald" && "bg-emerald-500/15 text-emerald-400",
                s.accent === "white" && "bg-white/10 text-white/80",
              )}
            >
              <s.icon className="h-4 w-4" />
            </div>
            <p className="text-[9px] uppercase tracking-widest font-black text-gray-500">{s.label}</p>
            <p
              className={cn(
                "mt-0.5 text-base md:text-lg font-black truncate",
                s.accent === "gold" ? "text-[#D4AF37]" : s.accent === "emerald" ? "text-emerald-400" : "text-white",
              )}
            >
              {s.value}
            </p>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
