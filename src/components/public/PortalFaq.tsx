import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  shop: any;
  productsEnabled?: boolean;
  subscriptionsEnabled?: boolean;
  cashbackEnabled?: boolean;
  couponsEnabled?: boolean;
  loyaltyEnabled?: boolean;
};

type Item = { q: string; a: string };
type Group = { key: string; label: string; items: Item[] };

/**
 * FAQ do portal público — apenas apresentação, organizado por categorias
 * e respeitando os módulos habilitados pela barbearia.
 */
export function PortalFaq({
  shop,
  productsEnabled,
  subscriptionsEnabled,
  cashbackEnabled,
  couponsEnabled,
  loyaltyEnabled,
}: Props) {
  const name = shop?.business_name || "a barbearia";

  const groups: Group[] = [
    {
      key: "agendamento",
      label: "Agendamento",
      items: [
        {
          q: "Como faço para agendar um horário?",
          a: `Clique em "Agendar agora", escolha o serviço, o profissional, a data e o horário disponível. A confirmação é imediata.`,
        },
        {
          q: "Posso cancelar ou remarcar?",
          a: "Sim. Use o link enviado na confirmação ou acesse o portal do cliente para cancelar e reagendar quando precisar.",
        },
        {
          q: "Os horários mostrados são reais?",
          a: "Sim. A agenda é atualizada em tempo real e só exibe horários realmente livres para o profissional escolhido.",
        },
      ],
    },
    productsEnabled && {
      key: "produtos",
      label: "Produtos",
      items: [
        {
          q: "Consigo comprar produtos pelo site?",
          a: `Sim. Na loja virtual da ${name} você escolhe os produtos e finaliza a compra direto por aqui.`,
        },
        {
          q: "Posso retirar na barbearia?",
          a: "Sim, a retirada é feita no balcão. Basta informar seu nome ao chegar.",
        },
      ],
    },
    subscriptionsEnabled && {
      key: "assinaturas",
      label: "Assinaturas",
      items: [
        {
          q: "Como funciona o clube de assinaturas?",
          a: "Você assina um plano mensal e passa a ter benefícios recorrentes, aplicados automaticamente nos seus agendamentos.",
        },
        {
          q: "Posso cancelar o plano?",
          a: "Sim, o cancelamento pode ser solicitado a qualquer momento pelo portal do cliente.",
        },
      ],
    },
    cashbackEnabled && {
      key: "cashback",
      label: "Cashback e créditos",
      items: [
        {
          q: "Como recebo cashback?",
          a: "A cada atendimento elegível, parte do valor volta como saldo na sua conta para usar em serviços futuros.",
        },
        {
          q: "Onde vejo meu saldo?",
          a: "No portal do cliente, com o histórico completo de créditos e cashback.",
        },
      ],
    },
    loyaltyEnabled && {
      key: "fidelidade",
      label: "Fidelidade",
      items: [
        {
          q: "Como funciona o programa de fidelidade?",
          a: "Cada atendimento acumula pontos que podem ser trocados por recompensas definidas pela barbearia.",
        },
      ],
    },
    couponsEnabled && {
      key: "cupons",
      label: "Cupons",
      items: [
        {
          q: "Onde aplico um cupom de desconto?",
          a: "No momento de finalizar o agendamento ou a compra, no campo de cupom.",
        },
      ],
    },
    {
      key: "pagamentos",
      label: "Pagamentos",
      items: [
        {
          q: "Quais formas de pagamento são aceitas?",
          a: "Pagamento na barbearia, PIX e as demais opções habilitadas no checkout.",
        },
        {
          q: "Preciso pagar no momento do agendamento?",
          a: "Não necessariamente — você pode escolher pagar no atendimento, quando essa opção estiver disponível.",
        },
      ],
    },
  ].filter(Boolean) as Group[];

  const [active, setActive] = React.useState(groups[0]?.key);
  const [open, setOpen] = React.useState<string | null>(null);
  const current = groups.find((g) => g.key === active) || groups[0];

  return (
    <section id="faq" className="py-24 bg-[#050505]">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center space-y-3 mb-12">
          <span className="text-gold font-black uppercase tracking-[0.3em] text-xs">Tire suas dúvidas</span>
          <h3 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-white">
            Perguntas frequentes
          </h3>
        </div>

        <div className="mb-8 flex flex-wrap justify-center gap-2" role="tablist" aria-label="Categorias de perguntas">
          {groups.map((g) => (
            <button
              key={g.key}
              role="tab"
              aria-selected={active === g.key}
              onClick={() => {
                setActive(g.key);
                setOpen(null);
              }}
              className={cn(
                "rounded-full border px-4 py-2 text-xs font-black uppercase tracking-widest transition-all",
                active === g.key
                  ? "border-gold bg-gold text-black shadow-[0_10px_30px_-12px_rgba(212,175,55,0.8)]"
                  : "border-white/10 text-slate-300 hover:border-gold/50 hover:text-gold",
              )}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {current?.items.map((item) => {
            const id = `${current.key}-${item.q}`;
            const isOpen = open === id;
            return (
              <div
                key={id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-black transition-colors hover:border-gold/40"
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-sm md:text-base font-bold text-white">{item.q}</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-gold transition-transform duration-300",
                      isOpen && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                </button>
                <div
                  className={cn(
                    "grid transition-all duration-300",
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-sm leading-relaxed text-slate-400">{item.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
