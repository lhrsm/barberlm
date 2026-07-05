import * as React from "react";
import { motion } from "framer-motion";
import { Sparkles, Bot } from "lucide-react";
import { differenceInDays } from "date-fns";

type Props = {
  appointments: any[];
  customerData: any;
  mySubscription: any;
  sales: any[];
};

function cadence(appts: any[], key: string) {
  const filtered = appts
    .filter((a) => a.status === "completed" && (a.services?.name || a.service_name || "").toLowerCase().includes(key))
    .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));
  if (filtered.length < 2) return null;
  const diffs: number[] = [];
  for (let i = 1; i < filtered.length; i++) {
    diffs.push(differenceInDays(new Date(filtered[i].start_time), new Date(filtered[i - 1].start_time)));
  }
  const avg = Math.round(diffs.reduce((s, d) => s + d, 0) / diffs.length);
  return avg > 0 ? avg : null;
}

export function AssistenteBarbex({ appointments, customerData, mySubscription, sales }: Props) {
  const completed = appointments.filter((a) => a.status === "completed");
  const insights: string[] = [];

  const cutCad = cadence(appointments, "corte");
  if (cutCad) insights.push(`Você costuma cortar o cabelo a cada ${cutCad} dias.`);

  const barbaCad = cadence(appointments, "barba");
  if (barbaCad) insights.push(`Sua barba normalmente é feita a cada ${barbaCad} dias.`);

  const last = completed.sort((a, b) => +new Date(b.start_time) - +new Date(a.start_time))[0];
  if (last && cutCad) {
    const days = differenceInDays(new Date(), new Date(last.start_time));
    const remaining = cutCad - days;
    if (remaining <= 3 && remaining >= -5) {
      insights.push(
        remaining > 0
          ? `Seu próximo atendimento recomendado é em ${remaining} ${remaining === 1 ? "dia" : "dias"}.`
          : `Seu próximo atendimento já está no ponto ideal.`,
      );
    }
  }

  const saved = completed.reduce(
    (s, a) =>
      s +
      (a.covered_by_subscription ? Number(a.service_price || 0) : 0) +
      Number(a.cashback_used || 0) +
      Number(a.credits_used || 0),
    0,
  );
  if (mySubscription && saved > 0) {
    insights.push(`Você já economizou R$ ${saved.toFixed(0)} utilizando sua assinatura Barbex.`);
  }

  if (completed.length >= 5) {
    insights.push(`Você já realizou ${completed.length} atendimentos conosco. Obrigado pela confiança.`);
  }

  if (sales?.length >= 1) {
    insights.push(`Você já adquiriu ${sales.length} ${sales.length === 1 ? "produto" : "produtos"} na barbearia.`);
  }

  const barberCount = new Map<string, { name: string; n: number }>();
  completed.forEach((a) => {
    const id = a.barber_id;
    const name = a.barbers?.name;
    if (!id || !name) return;
    const cur = barberCount.get(id) || { name, n: 0 };
    cur.n += 1;
    barberCount.set(id, cur);
  });
  const fav = Array.from(barberCount.values()).sort((a, b) => b.n - a.n)[0];
  if (fav && fav.n >= 2) insights.push(`Seu profissional favorito é ${fav.name}, com ${fav.n} atendimentos.`);

  const cashback = Number(customerData?.cashback_balance || 0);
  if (cashback > 20) insights.push(`Você tem R$ ${cashback.toFixed(2)} em cashback pronto para usar.`);

  if (insights.length === 0) {
    insights.push("Ainda estamos aprendendo sobre você. Agende seu primeiro atendimento para começar sua jornada.");
  }

  const visible = insights.slice(0, 4);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-3xl border border-[#D4AF37]/25 bg-gradient-to-br from-[#D4AF37]/[0.06] via-white/[0.02] to-transparent p-6 backdrop-blur-xl"
    >
      <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-[#D4AF37]/15 blur-3xl" />
      <div className="relative flex items-start gap-4">
        <div className="h-11 w-11 shrink-0 rounded-2xl grid place-items-center bg-[#D4AF37]/15 border border-[#D4AF37]/40 shadow-[0_0_24px_rgba(212,175,55,0.35)]">
          <Bot className="h-5 w-5 text-[#D4AF37]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.3em] font-black text-[#D4AF37]">Assistente Barbex</p>
            <Sparkles className="h-3 w-3 text-[#D4AF37]/70" />
          </div>
          <h3 className="text-lg md:text-xl font-black text-white mt-1">Insights personalizados</h3>
          <ul className="mt-3 space-y-2">
            {visible.map((t, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex gap-2 text-sm text-gray-200 leading-relaxed"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D4AF37]" />
                <span>{t}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </motion.section>
  );
}
