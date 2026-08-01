import { motion } from "framer-motion";
import { CalendarClock, MapPin, Scissors, Users, Star, ShoppingBag } from "lucide-react";

type Props = {
  shop: any;
  barbers: any[];
  services: any[];
  products?: any[];
  testimonials?: any[];
};

function avgOf(t: any) {
  const ratings = [t.barbershop_rating, t.service_rating, t.barber_rating].filter(
    (r) => typeof r === "number",
  ) as number[];
  return ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
}

/**
 * Seção "Sobre" — camada puramente visual.
 * Todos os números vêm dos dados já carregados na página pública;
 * nenhum fluxo, consulta ou API é alterado.
 */
export function AboutShop({ shop, barbers, services, products, testimonials }: Props) {
  const name = shop?.business_name || "nossa barbearia";
  const openingYear = shop?.opening_date ? new Date(shop.opening_date).getUTCFullYear() : null;
  const years =
    openingYear && new Date().getFullYear() - openingYear > 0
      ? new Date().getFullYear() - openingYear
      : null;

  const rated = (testimonials || []).map(avgOf).filter((n): n is number => typeof n === "number");
  const average = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null;

  const stats = [
    years && { icon: CalendarClock, value: `${years}`, label: years === 1 ? "Ano de história" : "Anos de história" },
    (barbers?.length || 0) > 0 && {
      icon: Users,
      value: String(barbers.length),
      label: barbers.length === 1 ? "Profissional" : "Profissionais",
    },
    (services?.length || 0) > 0 && {
      icon: Scissors,
      value: String(services.length),
      label: "Serviços",
    },
    (products?.length || 0) > 0 && {
      icon: ShoppingBag,
      value: String(products!.length),
      label: "Produtos na loja",
    },
    average !== null && {
      icon: Star,
      value: average.toFixed(1).replace(".", ","),
      label: "Nota média",
    },
  ].filter(Boolean) as { icon: any; value: string; label: string }[];

  if (stats.length < 2) return null;

  const cover = Array.isArray(shop?.gallery_images) && shop.gallery_images.length > 0
    ? (shop.gallery_images as string[])[0]
    : shop?.barbershop_logo_url || null;

  return (
    <section id="sobre" className="py-24 bg-black relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(212,175,55,0.07),transparent_55%)] pointer-events-none" />
      <div className="max-w-6xl mx-auto px-4 relative grid gap-12 lg:grid-cols-2 items-center">
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="space-y-6"
        >
          <span className="text-gold font-black uppercase tracking-[0.25em] text-xs">Sobre nós</span>
          <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-white leading-none">
            Tradição e cuidado em cada detalhe
          </h2>
          <p className="text-slate-400 text-base leading-relaxed max-w-xl">
            Na <span className="text-white font-bold">{name}</span> cada atendimento é pensado para
            você sair melhor do que entrou. Ambiente premium, profissionais dedicados e uma
            experiência que começa no agendamento e continua no seu portal do cliente.
          </p>
          {shop?.address && (
            <p className="text-sm text-slate-400 flex items-start gap-2">
              <MapPin size={16} className="text-gold mt-0.5 shrink-0" /> {shop.address}
            </p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur transition-colors hover:border-gold/40"
              >
                <s.icon className="h-4 w-4 text-gold mb-2" />
                <p className="text-2xl font-black text-white leading-none">{s.value}</p>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        {cover && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative"
          >
            <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-gold/25 to-transparent blur-2xl" />
            <img
              src={cover}
              alt={`Ambiente da ${name}`}
              loading="lazy"
              className="relative rounded-[1.75rem] border border-gold/25 object-cover w-full h-[320px] md:h-[420px] shadow-2xl"
            />
          </motion.div>
        )}
      </div>
    </section>
  );
}
