import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Barbex" },
      { name: "description", content: "Termos e condições de uso da plataforma Barbex." },
      { property: "og:title", content: "Termos de Uso — Barbex" },
      { property: "og:description", content: "Termos e condições de uso da plataforma Barbex." },
    ],
  }),
  component: TermsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-white/75">{children}</div>
    </section>
  );
}

function TermsPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-3xl px-5 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white">
          <ArrowLeft size={16} /> Voltar
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#F5C542] to-[#D4A017] text-[#050505]">
            <FileText size={22} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Termos de Uso</h1>
            <p className="text-sm text-white/55">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>
          </div>
        </div>

        <p className="mt-6 text-sm leading-relaxed text-white/75">
          Ao utilizar o Barbex, você concorda com estes Termos de Uso. Leia com atenção. Se não concordar,
          interrompa o uso da plataforma.
        </p>

        <Section title="1. Cadastro e conta">
          <p>
            Você é responsável por manter a confidencialidade das credenciais de acesso e por todas as
            atividades realizadas em sua conta. Informe imediatamente qualquer uso não autorizado.
          </p>
        </Section>

        <Section title="2. Agendamentos">
          <p>
            Agendamentos podem ser confirmados, reagendados ou cancelados conforme as políticas de cada
            barbearia. Os horários estão sujeitos à disponibilidade.
          </p>
        </Section>

        <Section title="3. Cancelamento">
          <p>
            Cancelamentos devem respeitar o prazo informado pela barbearia. Cancelamentos fora do prazo
            podem incidir em taxas ou perda de crédito conforme regra do estabelecimento.
          </p>
        </Section>

        <Section title="4. Créditos, cashback e fidelidade">
          <ul className="list-disc space-y-1 pl-5">
            <li>Créditos podem ser usados em serviços e produtos do mesmo estabelecimento.</li>
            <li>Cashback é gerado conforme regras de cada barbearia e não é convertido em dinheiro.</li>
            <li>Pontos de fidelidade não têm valor monetário e podem expirar.</li>
          </ul>
        </Section>

        <Section title="5. Assinaturas">
          <p>
            Planos de assinatura têm cobrança recorrente. O cancelamento interrompe renovações futuras,
            preservando o acesso até o fim do ciclo já pago, salvo regra específica.
          </p>
        </Section>

        <Section title="6. Loja e produtos">
          <p>
            Vendas de produtos estão sujeitas a estoque, prazos de entrega/retirada e política de troca
            da barbearia.
          </p>
        </Section>

        <Section title="7. Conduta do usuário">
          <p>
            É proibido utilizar a plataforma para fins ilícitos, ofensivos, fraudulentos ou que violem
            direitos de terceiros. Contas em desacordo podem ser suspensas.
          </p>
        </Section>

        <Section title="8. Limitação de responsabilidade">
          <p>
            O Barbex atua como plataforma tecnológica conectando clientes e barbearias. A execução dos
            serviços contratados é de responsabilidade do estabelecimento.
          </p>
        </Section>

        <Section title="9. Alterações destes Termos">
          <p>
            Podemos atualizar estes Termos periodicamente. Mudanças relevantes serão comunicadas pelos
            canais oficiais.
          </p>
        </Section>

        <Section title="10. Contato">
          <p>contato@barbex.shop</p>
        </Section>

        <div className="mt-10 flex flex-wrap gap-3 text-sm">
          <Link to="/privacy" className="rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-white hover:bg-white/10">
            Política de Privacidade
          </Link>
          <Link to="/" className="rounded-full bg-gradient-to-br from-[#F5C542] to-[#D4A017] px-4 py-2 font-semibold text-[#050505] hover:brightness-110">
            Voltar ao site
          </Link>
        </div>
      </div>
    </div>
  );
}
