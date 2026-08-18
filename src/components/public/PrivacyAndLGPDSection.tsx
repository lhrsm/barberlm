import { motion } from "framer-motion";
import { Shield, Lock, FileText, CheckCircle, Database, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  { icon: Database, title: "Isolamento por barbearia", desc: "Cada estabelecimento acessa apenas as informações vinculadas ao seu próprio ambiente." },
  { icon: UserCheck, title: "Controle de acesso", desc: "Permissões por perfil ajudam a limitar quem pode visualizar ou alterar informações." },
  { icon: CheckCircle, title: "Consentimentos", desc: "Recursos para registrar consentimentos e preferências de comunicação." },
  { icon: FileText, title: "Auditoria", desc: "Registros de ações administrativas ajudam no acompanhamento e rastreabilidade." },
  { icon: Lock, title: "Direitos do titular", desc: "Estrutura para apoiar solicitações de acesso, correção e exclusão." },
  { icon: Shield, title: "Arquivos protegidos", desc: "Documentos e arquivos sensíveis podem utilizar acesso restrito." },
];

export function PrivacyAndLGPDSection() {
  return (
    <section className="py-20 md:py-24 px-6 bg-[#05070d]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <span className="text-gold font-black uppercase tracking-[0.4em] text-[10px]">Privacidade</span>
          <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-white">Privacidade e proteção de dados desde a base</h2>
          <p className="max-w-2xl mx-auto text-slate-400">
            O Barbex foi desenvolvido com controles de acesso e recursos para apoiar boas práticas de privacidade e conformidade com a LGPD.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-8 rounded-[2rem] border border-white/5 bg-white/[0.02] hover:border-gold/20 transition-all"
            >
              <feature.icon className="text-gold mb-6" size={32} />
              <h4 className="text-white font-black uppercase tracking-tight mb-3">{feature.title}</h4>
              <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-16 p-8 rounded-3xl border border-white/10 bg-white/[0.01] text-center space-y-6">
          <p className="text-slate-400 text-sm max-w-2xl mx-auto italic">
            O Barbex fornece recursos técnicos para apoiar a proteção dos dados. Cada barbearia continua responsável pela forma como coleta, utiliza, compartilha e mantém os dados de seus clientes e colaboradores.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a href="/privacy" className="text-gold text-xs font-bold uppercase tracking-widest hover:underline">Política de Privacidade</a>
            <a href="/terms" className="text-gold text-xs font-bold uppercase tracking-widest hover:underline">Termos de Uso</a>
          </div>
        </div>
      </div>
    </section>
  );
}
