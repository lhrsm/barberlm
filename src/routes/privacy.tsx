import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Barbex" },
      { name: "description", content: "Saiba como o Barbex coleta, utiliza e protege seus dados pessoais em conformidade com a LGPD." },
      { property: "og:title", content: "Política de Privacidade — Barbex" },
      { property: "og:description", content: "Saiba como o Barbex coleta, utiliza e protege seus dados pessoais em conformidade com a LGPD." },
    ],
  }),
  component: PrivacyPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-white/75">{children}</div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-3xl px-5 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white">
          <ArrowLeft size={16} /> Voltar
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#F5C542] to-[#D4A017] text-[#050505]">
            <ShieldCheck size={22} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Política de Privacidade</h1>
            <p className="text-sm text-white/55">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>
          </div>
        </div>

        <p className="mt-6 text-sm leading-relaxed text-white/75">
          Esta Política descreve como o Barbex (“nós”) coleta, utiliza, armazena e protege dados pessoais
          dos usuários da plataforma, em conformidade com a Lei Geral de Proteção de Dados Pessoais
          (Lei nº 13.709/2018 — LGPD).
        </p>

        <Section title="1. Dados que coletamos">
          <ul className="list-disc space-y-1 pl-5">
            <li>Dados de cadastro: nome, e-mail, telefone, CPF (quando aplicável).</li>
            <li>Dados de uso: agendamentos, serviços contratados, histórico de compras, fidelidade e cashback.</li>
            <li>Dados técnicos: endereço IP, tipo de dispositivo, navegador, cookies.</li>
            <li>Dados de pagamento: processados por gateways parceiros — não armazenamos número completo de cartão.</li>
          </ul>
        </Section>

        <Section title="2. Finalidades do tratamento">
          <ul className="list-disc space-y-1 pl-5">
            <li>Executar serviços de agendamento, assinaturas, fidelidade e loja.</li>
            <li>Comunicação operacional (confirmações, lembretes, comprovantes).</li>
            <li>Comunicação de marketing (somente com consentimento específico).</li>
            <li>Cumprimento de obrigações legais e fiscais.</li>
            <li>Prevenção a fraudes e segurança da plataforma.</li>
          </ul>
        </Section>

        <Section title="3. Compartilhamento de dados">
          <p>
            Compartilhamos dados apenas com operadores necessários ao serviço (gateways de pagamento,
            envio de mensagens, hospedagem em nuvem) e com autoridades quando exigido por lei.
            Não vendemos dados pessoais a terceiros.
          </p>
        </Section>

        <Section title="4. Armazenamento e segurança">
          <p>
            Os dados são armazenados em infraestrutura segura, com criptografia em trânsito (TLS) e em repouso.
            Aplicamos controles de acesso, registros de auditoria e princípios de mínimo privilégio.
          </p>
        </Section>

        <Section title="5. Direitos do titular">
          <p>Você pode, a qualquer momento:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Confirmar a existência de tratamento.</li>
            <li>Acessar e exportar seus dados.</li>
            <li>Corrigir dados incompletos, inexatos ou desatualizados.</li>
            <li>Solicitar anonimização, bloqueio ou eliminação.</li>
            <li>Revogar o consentimento.</li>
          </ul>
          <p>
            Essas solicitações podem ser feitas no Portal do Cliente, em <em>Privacidade e Dados</em>,
            ou pelos contatos abaixo.
          </p>
        </Section>

        <Section title="6. Cookies">
          <p>
            Utilizamos cookies essenciais para o funcionamento da plataforma e cookies opcionais de análise
            e marketing, mediante consentimento exibido no banner. Você pode revisar suas preferências a
            qualquer momento limpando os dados do navegador.
          </p>
        </Section>

        <Section title="7. Retenção">
          <p>
            Mantemos os dados pelo tempo necessário ao cumprimento das finalidades e das obrigações legais.
            Após esse prazo, os dados são anonimizados ou eliminados.
          </p>
        </Section>

        <Section title="8. Contato do controlador">
          <p>
            Em caso de dúvidas, solicitações ou denúncias relacionadas a dados pessoais, fale com o
            encarregado (DPO):
          </p>
          <p className="text-white">privacidade@barbex.shop</p>
        </Section>

        <div className="mt-10 flex flex-wrap gap-3 text-sm">
          <Link to="/terms" className="rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-white hover:bg-white/10">
            Termos de Uso
          </Link>
          <Link to="/" className="rounded-full bg-gradient-to-br from-[#F5C542] to-[#D4A017] px-4 py-2 font-semibold text-[#050505] hover:brightness-110">
            Voltar ao site
          </Link>
        </div>
      </div>
    </div>
  );
}
