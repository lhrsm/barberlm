import { motion } from "framer-motion";
import { Star, Users, Scissors, MessageSquare, ShieldCheck } from "lucide-react";

type Props = {
  shop: any;
  testimonials: any[];
  barbers: any[];
  services: any[];
};

function avgOf(t: any) {
  const ratings = [t.barbershop_rating, t.service_rating, t.barber_rating].filter(
    (r) => typeof r === "number",
  ) as number[];
  return ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
}

/**
 * "Por que escolher nossa barbearia?" — indicadores 100% reais,
 * calculados a partir dos dados públicos já carregados na página.
 * Camada apenas visual: não faz consultas nem altera nenhum fluxo.
 */
export function WhyChooseUs({ shop, testimonials, barbers, services }: Props) {
  const rated = (testimonials || []).map(avgOf).filter((n): n is number => typeof n === "number");
  const average = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null;
  const satisfaction = rated.length
    ? Math.round((rated.filter((n) => n >= 4).length / rated.length) * 100)
    : null;

  const items = [
    average !== null && {
      icon: Star,
      value: average.toFixed(1).replace(".", ","),
      label: "Nota média dos clientes",
    },
    rated.length > 0 && {
      icon: MessageSquare,
      value: String(rated.length),
      label: rated.length === 1 ? "Avaliação publicada" : "Avaliações publicadas",
    },
    satisfaction !== null && {
      icon: ShieldCheck,
      value: `${satisfaction}%`,
      label: "Clientes satisfeitos",
    },
    (barbers?.length || 0) > 0 && {
      icon: Users,
      value: String(barbers.length),
      label: barbers.length === 1 ? "Profissional na equipe" : "Profissionais na equipe",
    },
    (services?.length || 0) > 0 && {
      icon: Scissors,
      value: String(services.length),
      label: "Serviços no catálogo",
    },
  ].filter(Boolean) as { icon: any; value: string; label: string }[];

  if (items.length < 2) return null;

  return (
    <section id="por-que-escolher" className="py-24 bg-black relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      <div className="max-w-6xl mx-auto px-4 relative">
        <div className="text-center space-y-3 mb-14">
          <span className="text-gold font-black uppercase tracking-[0.3em] text-xs">Confiança real</span>
          <h3 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-white">
            Por que escolher {shop?.business_name ? "a " + shop.business_name : "nossa barbearia"}?
          </h3>
          <p className="text-slate-400 max-w-2xl mx-auto text-base md:text-lg">
            Indicadores calculados automaticamente a partir dos atendimentos e avaliações reais desta barbearia.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {items.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="group rounded-2xl border border-gold/20 bg-gradient-to-br from-zinc-950 to-black p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:border-gold/60 hover:shadow-[0_16px_44px_-14px_rgba(212,175,55,0.5)]"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold transition-transform duration-300 group-hover:scale-110">
                <item.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="text-3xl md:text-4xl font-black tracking-tighter text-white">{item.value}</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-slate-400">{item.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
