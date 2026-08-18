import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  shop?: any;
  productsEnabled?: boolean;
  subscriptionsEnabled?: boolean;
  cashbackEnabled?: boolean;
  couponsEnabled?: boolean;
  loyaltyEnabled?: boolean;
};

export function PortalFaq({
  shop,
  productsEnabled = true,
  subscriptionsEnabled = true,
  cashbackEnabled = true,
  couponsEnabled = true,
  loyaltyEnabled = true,
}: Props) {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  const faqs = [
    {
      q: "Como funciona o teste gratuito?",
      a: "Você tem 15 dias de acesso total a todas as funcionalidades do plano selecionado. Não pedimos cartão de crédito para começar, e você pode configurar sua barbearia em minutos."
    },
    {
      q: "Preciso cadastrar cartão de crédito?",
      a: "Não. O teste é totalmente gratuito e sem compromisso. Você só cadastra uma forma de pagamento se decidir continuar utilizando a plataforma após o período de teste."
    },
    {
      q: "Posso cancelar quando quiser?",
      a: "Sim. O Barbex é uma assinatura mensal sem fidelidade. Você pode cancelar sua conta a qualquer momento direto pelo painel de configurações, sem burocracia."
    },
    {
      q: "O Barbex possui agendamento online?",
      a: "Sim. Você recebe um link exclusivo do seu Portal do Cliente onde seus clientes podem agendar horários 24h por dia, visualizando apenas os horários livres."
    },
    {
      q: "O cliente consegue reagendar sozinho?",
      a: "Sim. Através do portal ou do link de confirmação, o cliente pode solicitar o reagendamento ou cancelamento, respeitando as regras de antecedência que você definir."
    },
    {
      q: "Existe painel para o barbeiro?",
      a: "Com certeza. Cada profissional tem seu próprio acesso para gerir sua agenda, ver comissões, histórico de clientes e metas pessoais."
    },
    {
      q: "O Barbex possui controle financeiro?",
      a: "Sim, oferecemos um módulo financeiro completo com fluxo de caixa, comissões automatizadas, DRE gerencial e relatórios de lucratividade."
    },
    {
      q: "Posso vender produtos?",
      a: "Sim. O Barbex inclui uma loja virtual integrada onde você pode vender produtos de revenda, com controle de estoque automático e integração com o checkout."
    },
    {
      q: "Como funcionam as automações pelo WhatsApp?",
      a: "O sistema envia automaticamente lembretes de agendamento, mensagens de aniversário e campanhas de marketing diretamente para o WhatsApp dos seus clientes."
    },
    {
      q: "Preciso contratar uma API do WhatsApp?",
      a: "O Barbex já oferece integração nativa. Dependendo do seu volume de mensagens e plano, você pode utilizar nossa infraestrutura sem custos adicionais de API externa."
    },
    {
      q: "Posso adicionar módulos ao meu plano?",
      a: "Sim, nossa arquitetura é modular. Você pode expandir as funcionalidades do seu plano conforme sua barbearia cresce, ativando novos módulos a qualquer momento."
    },
    {
      q: "O Barbex funciona em celular e computador?",
      a: "Sim. A plataforma é 100% responsiva e otimizada para funcionar perfeitamente em notebooks, desktops, tablets e smartphones."
    }
  ];

  return (
    <section id="faq" className="py-24 md:py-32 bg-black relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(212,175,55,0.05),transparent_50%)]" />
      
      <div className="max-w-4xl mx-auto px-6 relative">
        <div className="text-center mb-16 space-y-4">
          <span className="text-gold font-black uppercase tracking-[0.4em] text-[10px]">Dúvidas Frequentes</span>
          <h2 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-white">FAQ Premium</h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <motion.div
              key={idx}
              initial={false}
              className={cn(
                "group rounded-2xl border border-white/5 bg-zinc-900/20 transition-all duration-300",
                openIndex === idx ? "border-gold/30 bg-zinc-900/40" : "hover:border-white/10 hover:bg-zinc-900/30"
              )}
            >
              <button
                onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                className="flex w-full items-center justify-between gap-6 px-8 py-6 text-left"
              >
                <span className={cn(
                  "text-[17px] md:text-[18px] font-semibold tracking-tight transition-colors duration-300",
                  openIndex === idx ? "text-gold" : "text-slate-200 group-hover:text-white"
                )}>
                  {faq.q}
                </span>
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 transition-all duration-300",
                  openIndex === idx ? "bg-gold border-gold text-black rotate-180" : "text-slate-500 group-hover:border-gold/50 group-hover:text-gold"
                )}>
                  <ChevronDown size={18} />
                </div>
              </button>
              
              <AnimatePresence initial={false}>
                {openIndex === idx && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <div className="px-8 pb-8">
                      <div className="h-px w-full bg-white/5 mb-6" />
                      <p className="text-[16px] leading-[1.8] text-slate-400 font-medium">
                        {faq.a}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
