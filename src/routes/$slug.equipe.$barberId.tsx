import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Clock,
  Scissors,
  Star,
  User as UserIcon,
  CalendarDays,
  Quote,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/$slug/equipe/$barberId")({
  component: BarberProfilePage,
  head: ({ params }) => {
    const pretty = params.slug
      .split("-")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
    const title = `Profissional — ${pretty}`;
    const description = `Conheça o profissional, veja especialidades, serviços realizados e avaliações reais na ${pretty}. Agende online em poucos cliques.`;
    const url = `https://barbex.shop/${params.slug}/equipe/${params.barberId}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});

function BarberProfilePage() {
  const { slug, barberId } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState<any>(null);
  const [barber, setBarber] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [stats, setStats] = useState<{ avg: number | null; total: number }>({ avg: null, total: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: currentShop } = await supabase
          .from("profiles")
          .select("id, business_name, slug, barbershop_logo_url")
          .eq("slug", slug.trim().toLowerCase())
          .maybeSingle();
        if (!currentShop) {
          if (!cancelled) setLoading(false);
          return;
        }

        const { data: barberRow } = await supabase
          .from("barbers")
          .select("id, name, avatar_url, bio, specialties, category, barber_services(service_id)")
          .eq("id", barberId)
          .eq("user_id", currentShop.id)
          .eq("active", true)
          .maybeSingle();

        if (!barberRow) {
          if (!cancelled) {
            setShop(currentShop);
            setLoading(false);
          }
          return;
        }

        const serviceIds = (barberRow as any).barber_services?.map((bs: any) => bs.service_id) ?? [];

        const [servicesRes, statsRes, reviewsRes] = await Promise.all([
          serviceIds.length
            ? supabase
                .from("services")
                .select("id, name, description, price, duration_minutes, category")
                .in("id", serviceIds)
                .eq("active", true)
            : Promise.resolve({ data: [] as any[] }),
          supabase
            .from("barber_rating_stats" as any)
            .select("avg_rating, total_ratings")
            .eq("barber_id", barberId)
            .maybeSingle(),
          supabase
            .from("appointment_reviews")
            .select("id, testimonial_text, barber_rating, created_at, customers(name, avatar_url), appointments(services(name))")
            .eq("tenant_id", currentShop.id)
            .eq("barber_id", barberId)
            .eq("testimonial_status", "approved")
            .eq("show_on_frontend", true)
            .eq("allow_public_display", true)
            .not("testimonial_text", "is", null)
            .order("created_at", { ascending: false })
            .limit(6),
        ]);

        if (cancelled) return;
        setShop(currentShop);
        setBarber(barberRow);
        setServices((servicesRes as any).data || []);
        setReviews((reviewsRes as any).data || []);
        const s: any = (statsRes as any).data;
        setStats({ avg: s?.avg_rating ?? null, total: s?.total_ratings ?? 0 });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, barberId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!barber) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6 px-6 text-center">
        <UserIcon className="h-12 w-12 text-white/20" />
        <div className="space-y-2">
          <h1 className="text-2xl font-black uppercase italic tracking-tighter text-white">
            Profissional não encontrado
          </h1>
          <p className="text-white/50 text-sm">Este perfil pode ter sido removido ou está inativo.</p>
        </div>
        <Link to="/$slug" params={{ slug }}>
          <Button className="rounded-full bg-gold text-black font-black uppercase tracking-widest px-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
        </Link>
      </div>
    );
  }

  const specialties: string[] = Array.isArray(barber.specialties) ? barber.specialties : [];

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute -top-32 -left-32 w-[28rem] h-[28rem] bg-gold/10 blur-[120px] rounded-full" />
        <div className="relative max-w-6xl mx-auto px-4 py-14 md:py-20">
          <Link
            to="/$slug"
            params={{ slug }}
            className="inline-flex items-center gap-2 text-white/60 hover:text-gold transition-colors text-xs font-bold uppercase tracking-widest mb-10"
          >
            <ArrowLeft className="h-4 w-4" />
            {shop?.business_name || "Voltar"}
          </Link>

          <div className="grid gap-10 md:grid-cols-[320px,1fr] items-start">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="relative aspect-[4/5] rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10"
            >
              {barber.avatar_url ? (
                <img src={barber.avatar_url} alt={barber.name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-zinc-900">
                  <UserIcon className="h-20 w-20 text-white/10" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="space-y-6"
            >
              <div className="space-y-3">
                <span className="text-gold font-black uppercase tracking-[0.25em] text-xs">
                  {barber.category || "Especialista"}
                </span>
                <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-white">
                  {barber.name}
                </h1>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <Star size={16} className="text-gold" fill="currentColor" />
                    <span className="text-lg font-black text-white">
                      {stats.avg ? Number(stats.avg).toFixed(1) : "—"}
                    </span>
                    <span className="text-[11px] text-white/50 font-bold uppercase tracking-widest ml-1">
                      {stats.total} avaliações
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-white/60">
                    <Scissors size={15} className="text-gold" />
                    <span className="text-[11px] font-bold uppercase tracking-widest">
                      {services.length} serviços
                    </span>
                  </div>
                </div>
              </div>

              {barber.bio && (
                <p className="text-white/60 leading-relaxed max-w-2xl">{barber.bio}</p>
              )}

              {specialties.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {specialties.map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-gold/30 bg-gold/[0.08] px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-gold"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}

              <Link to="/$slug" params={{ slug }} hash="servicos">
                <Button className="h-14 px-8 rounded-full bg-gold text-black font-black uppercase tracking-widest text-xs hover:bg-white transition-all shadow-[0_12px_30px_-10px_rgba(212,175,55,0.6)]">
                  <CalendarDays className="h-4 w-4 mr-2" /> Agendar com {barber.name.split(" ")[0]}
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Services */}
      {services.length > 0 && (
        <section className="py-16 md:py-20 bg-black">
          <div className="max-w-6xl mx-auto px-4">
            <div className="space-y-2 mb-10">
              <span className="text-gold font-black uppercase tracking-[0.25em] text-xs">Atendimentos</span>
              <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-white">
                Serviços realizados
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="group rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-6 hover:border-gold/40 transition-all duration-500"
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/20 flex items-center justify-center">
                      <Scissors className="h-5 w-5 text-gold" />
                    </div>
                    <p className="text-2xl font-black tracking-tighter text-white">
                      <span className="text-xs text-white/50 font-bold mr-1">R$</span>
                      {Number(service.price).toFixed(2)}
                    </p>
                  </div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-white group-hover:text-gold transition-colors">
                    {service.name}
                  </h3>
                  {service.description && (
                    <p className="text-white/50 text-sm mt-1 line-clamp-2">{service.description}</p>
                  )}
                  <div className="flex items-center gap-2 text-white/60 mt-4 pt-4 border-t border-white/10">
                    <Clock className="h-4 w-4 text-gold" />
                    <span className="text-[11px] font-bold uppercase tracking-widest">
                      {service.duration_minutes} min
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Reviews */}
      {reviews.length > 0 && (
        <section className="py-16 md:py-20 bg-[#050505] border-t border-white/5">
          <div className="max-w-6xl mx-auto px-4">
            <div className="space-y-2 mb-10">
              <span className="text-gold font-black uppercase tracking-[0.25em] text-xs">Prova social</span>
              <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-white">
                O que dizem sobre {barber.name.split(" ")[0]}
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {reviews.map((r) => (
                <div
                  key={r.id}
                  className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6 flex flex-col gap-4"
                >
                  <Quote className="h-6 w-6 text-gold/50" />
                  <p className="text-white/70 text-sm leading-relaxed flex-1">{r.testimonial_text}</p>
                  <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                    {r.customers?.avatar_url ? (
                      <img
                        src={r.customers.avatar_url}
                        alt={r.customers?.name || "Cliente"}
                        className="h-9 w-9 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-white/5 flex items-center justify-center">
                        <UserIcon className="h-4 w-4 text-white/30" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">
                        {r.customers?.name || "Cliente"}
                      </p>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={11}
                            className={i < (r.barber_rating || 0) ? "text-gold" : "text-white/15"}
                            fill="currentColor"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-16 bg-black border-t border-white/5">
        <div className="max-w-3xl mx-auto px-4 text-center space-y-6">
          <h2 className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter text-white">
            Garanta seu horário
          </h2>
          <p className="text-white/50">
            Escolha o serviço, o dia e confirme em segundos com {barber.name.split(" ")[0]}.
          </p>
          <Link to="/$slug" params={{ slug }} hash="servicos">
            <Button className="h-14 px-10 rounded-full bg-gold text-black font-black uppercase tracking-widest text-xs hover:bg-white transition-all">
              Agendar agora
            </Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
