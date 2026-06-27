import { createFileRoute, Link } from "@tanstack/react-router";
import { Scale, ArrowLeft, Mail, FileCheck2, UserCheck, Download, Trash2, Edit3 } from "lucide-react";

export const Route = createFileRoute("/lgpd")({
  head: () => ({
    meta: [
      { title: "LGPD — Barbex" },
      { name: "description", content: "Como o Barbex atua em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018)." },
    ],
  }),
  component: LgpdPage,
});

function LgpdPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-4xl mx-auto px-6 py-16">
        <Link to="/trust" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8">
          <ArrowLeft className="h-4 w-4" /> Central de Confiança
        </Link>

        <header className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/40 text-primary text-xs font-bold uppercase tracking-wider mb-4">
            <Scale className="h-3.5 w-3.5" /> Conformidade
          </div>
          <h1 className="text-4xl font-black mb-4">LGPD</h1>
          <p className="text-lg text-muted-foreground">
            O Barbex atua como <strong>operador</strong> dos dados pessoais tratados pelas barbearias clientes,
            que são as <strong>controladoras</strong>. Esta página explica nossos papéis, bases legais e como
            você pode exercer seus direitos.
          </p>
        </header>

        <Section title="Quem é o controlador" icon={UserCheck}>
          Cada barbearia cliente do Barbex é a controladora dos dados dos seus próprios clientes.
          A barbearia define a finalidade do tratamento (agendamentos, programa de fidelidade, comunicação).
        </Section>

        <Section title="Quem é o operador" icon={FileCheck2}>
          A Barbex Tecnologia atua como operadora, fornecendo a plataforma e tratando os dados
          exclusivamente conforme as instruções da barbearia controladora.
        </Section>

        <Section title="Bases legais" icon={Scale}>
          Tratamos dados com base em: execução de contrato (agendamentos), consentimento
          (marketing e cookies opcionais), cumprimento de obrigação legal/regulatória
          (notas fiscais, retenção fiscal) e legítimo interesse (segurança e prevenção a fraudes).
        </Section>

        <Section title="Direitos do titular" icon={UserCheck}>
          Você pode solicitar a qualquer momento:
          <ul className="mt-3 grid sm:grid-cols-2 gap-2 list-none p-0">
            <Bullet icon={Download} title="Exportação" desc="Receba uma cópia dos seus dados." />
            <Bullet icon={Trash2} title="Exclusão" desc="Solicite a exclusão dos seus dados." />
            <Bullet icon={Edit3} title="Correção" desc="Corrija informações desatualizadas." />
            <Bullet icon={UserCheck} title="Anonimização" desc="Mantenha o histórico sem identificá-lo." />
          </ul>
        </Section>

        <Section title="Como solicitar" icon={Mail}>
          Clientes finais devem solicitar diretamente à barbearia, que possui um painel próprio para
          atender as requisições. Você também pode escrever para nosso encarregado de dados:{" "}
          <a className="text-primary underline" href="mailto:privacidade@barbex.shop">privacidade@barbex.shop</a>.
          Prazo de resposta: até 15 dias.
        </Section>

        <Section title="Tempo de retenção" icon={FileCheck2}>
          Dados de clientes são mantidos enquanto houver relação ativa com a barbearia e pelos prazos
          legais aplicáveis após o encerramento (obrigações fiscais, defesa em processos). Em média,
          mantemos dados por 5 anos após a última interação, salvo se você solicitar exclusão antes.
        </Section>

        <Section title="Encarregado pelo tratamento de dados (DPO)" icon={Mail}>
          E-mail: <a className="text-primary underline" href="mailto:privacidade@barbex.shop">privacidade@barbex.shop</a>
        </Section>
      </main>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="mb-8 rounded-2xl border border-border bg-card p-6">
      <h2 className="flex items-center gap-2 text-xl font-bold mb-3">
        <Icon className="h-5 w-5 text-primary" /> {title}
      </h2>
      <div className="text-muted-foreground leading-relaxed">{children}</div>
    </section>
  );
}

function Bullet({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
      <Icon className="h-4 w-4 text-primary mt-1 shrink-0" />
      <div>
        <p className="font-semibold text-foreground text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </li>
  );
}
