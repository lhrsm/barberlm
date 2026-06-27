import { createFileRoute, Link } from "@tanstack/react-router";
import { HelpCircle, ArrowLeft } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/privacy-faq")({
  head: () => ({
    meta: [
      { title: "FAQ de Privacidade — Barbex" },
      { name: "description", content: "Perguntas e respostas sobre privacidade, dados e LGPD no Barbex." },
    ],
  }),
  component: PrivacyFaq,
});

const QA = [
  { q: "Como meus dados são utilizados?", a: "Seus dados são utilizados para operar agendamentos, programa de fidelidade, comunicação com a barbearia e melhoria da plataforma. Marketing só com seu consentimento expresso." },
  { q: "Posso excluir meus dados?", a: "Sim. Você pode solicitar exclusão pelo Portal do Cliente, diretamente com a barbearia ou pelo e-mail privacidade@barbex.shop. Atendemos em até 15 dias." },
  { q: "Como exporto meus dados?", a: "No Portal do Cliente, vá em Privacidade → Baixar meus dados. Você receberá um arquivo com seus agendamentos, créditos, cashback e consentimentos." },
  { q: "Onde meus dados ficam armazenados?", a: "Os dados são armazenados em provedores de classe mundial com criptografia em trânsito e em repouso. Veja /subprocessors para a lista completa." },
  { q: "Quem pode visualizar meus dados?", a: "Apenas a barbearia controladora e funcionários autorizados por ela. A equipe Barbex acessa apenas em casos de suporte explicitamente solicitado por você ou pela barbearia." },
  { q: "Como cancelar meu consentimento?", a: "No Portal do Cliente, aba Privacidade → Meus Consentimentos. Você pode desativar marketing, WhatsApp promocional e cookies opcionais a qualquer momento." },
];

function PrivacyFaq() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <Link to="/trust" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8">
          <ArrowLeft className="h-4 w-4" /> Central de Confiança
        </Link>
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/40 text-primary text-xs font-bold uppercase tracking-wider mb-4">
            <HelpCircle className="h-3.5 w-3.5" /> Perguntas frequentes
          </div>
          <h1 className="text-4xl font-black mb-3">FAQ de Privacidade</h1>
          <p className="text-lg text-muted-foreground">
            Respostas rápidas para as dúvidas mais comuns sobre seus dados.
          </p>
        </header>

        <Accordion type="single" collapsible className="rounded-xl border border-border bg-card divide-y divide-border">
          {QA.map((item, i) => (
            <AccordionItem key={i} value={`q-${i}`} className="px-5">
              <AccordionTrigger className="text-left font-semibold">{item.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </main>
    </div>
  );
}
