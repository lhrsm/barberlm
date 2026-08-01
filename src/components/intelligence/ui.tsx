import { memo } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MessageCircle, Star } from "lucide-react";
import { brl, type CustomerRow, type RadarItem } from "./engine";

export const SectionCard = memo(function SectionCard({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: any;
  action?: { label: string; to: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        "rounded-2xl border border-gold/15 bg-[#0b0f17]/90 p-5 transition-all duration-200",
        "hover:border-gold/35 hover:shadow-[0_10px_30px_rgba(212,175,55,0.08)]",
        className,
      )}
    >
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {Icon && (
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/10">
              <Icon className="h-4 w-4 text-gold" aria-hidden />
            </span>
          )}
          <div>
            <h2 className="text-base font-black text-white">{title}</h2>
            {subtitle && <p className="text-[10px] font-black uppercase tracking-widest text-white/40">{subtitle}</p>}
          </div>
        </div>
        {action && (
          <Button
            asChild
            size="sm"
            className="h-8 rounded-lg bg-gold/15 text-xs font-bold text-gold hover:bg-gold/25"
          >
            <Link to={action.to}>{action.label}</Link>
          </Button>
        )}
      </header>
      {children}
    </section>
  );
});

export function EmptyState({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-white/40">{text}</p>;
}

export function SkeletonBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-xl bg-white/[0.04]" />
      ))}
    </div>
  );
}

export function whatsappLink(phone?: string | null, message?: string) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  const full = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${full}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

export const CustomerList = memo(function CustomerList({
  rows,
  note,
  emptyText = "Nenhum cliente nesta condição.",
  limit = 6,
}: {
  rows: { row: CustomerRow; reason?: string }[];
  note?: (r: CustomerRow) => string;
  emptyText?: string;
  limit?: number;
}) {
  if (rows.length === 0) return <EmptyState text={emptyText} />;
  return (
    <ul className="space-y-2">
      {rows.slice(0, limit).map(({ row, reason }) => {
        const link = whatsappLink(row.phone, `Olá ${row.name}!`);
        return (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-all duration-200 hover:translate-x-0.5 hover:border-gold/25"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{row.name}</p>
              <p className="truncate text-[11px] text-white/45">
                {reason || note?.(row) || (
                  <>
                    {row.lastVisit
                      ? `Última visita há ${row.daysSince} dias`
                      : "Sem atendimentos registrados"}
                    {row.favoriteBarber ? ` • ${row.favoriteBarber}` : ""}
                    {row.favoriteService ? ` • ${row.favoriteService}` : ""}
                    {row.avgTicket > 0 ? ` • ${brl(row.avgTicket)} médio` : ""}
                  </>
                )}
              </p>
            </div>
            {link && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Falar com ${row.name} no WhatsApp`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10 text-gold transition-colors hover:bg-gold/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                    >
                      <MessageCircle className="h-4 w-4" aria-hidden />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>Abrir conversa no WhatsApp</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </li>
        );
      })}
      {rows.length > limit && (
        <li className="pt-1 text-center text-[11px] font-bold uppercase tracking-widest text-white/35">
          +{rows.length - limit} clientes
        </li>
      )}
    </ul>
  );
});

const PRIORITY_LABEL: Record<RadarItem["priority"], { text: string; stars: number; tone: string }> = {
  "muito-alta": { text: "Muito Alta", stars: 5, tone: "border-gold/40 bg-gold/[0.08] text-gold" },
  alta: { text: "Alta", stars: 4, tone: "border-green-500/30 bg-green-500/[0.07] text-green-300" },
  media: { text: "Média", stars: 3, tone: "border-amber-500/30 bg-amber-500/[0.07] text-amber-300" },
  baixa: { text: "Baixa", stars: 2, tone: "border-white/10 bg-white/[0.03] text-white/70" },
};

export const RadarCard = memo(function RadarCard({ item }: { item: RadarItem }) {
  const meta = PRIORITY_LABEL[item.priority];
  return (
    <article
      className={cn(
        "rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(212,175,55,0.10)]",
        meta.tone,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1" aria-label={`Prioridade ${meta.text}`}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={cn("h-3 w-3", i < meta.stars ? "fill-current" : "opacity-25")} aria-hidden />
            ))}
            <span className="ml-1 text-[10px] font-black uppercase tracking-widest">{meta.text}</span>
          </p>
          <h3 className="mt-1 truncate text-sm font-black text-white">{item.title}</h3>
          <p className="text-xs text-white/60">{item.detail}</p>
        </div>
        <span className="rounded-lg bg-black/30 px-2 py-1 text-[10px] font-black text-white/70">{item.score}/100</span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-lg bg-black/25 px-3 py-2">
          <dt className="font-black uppercase tracking-widest text-white/40">Potencial</dt>
          <dd className="font-bold text-white">{brl(item.potential)}</dd>
        </div>
        <div className="rounded-lg bg-black/25 px-3 py-2">
          <dt className="font-black uppercase tracking-widest text-white/40">Execução</dt>
          <dd className="font-bold capitalize text-white">{item.effort}</dd>
        </div>
      </dl>
      {item.action.to && (
        <Button
          asChild
          size="sm"
          className="mt-3 h-8 w-full rounded-lg bg-gold text-xs font-black text-black hover:bg-gold/85"
        >
          <Link to={item.action.to}>{item.action.label}</Link>
        </Button>
      )}
    </article>
  );
});
