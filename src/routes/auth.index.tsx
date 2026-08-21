import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/auth/AuthForm";
import { motion } from "framer-motion";
import { 
  CheckCircle2, 
  ShieldCheck, 
  Sparkles,
  Scissors
} from "lucide-react";

export const Route = createFileRoute("/auth/")({
  head: () => ({
    meta: [
      { title: "Entrar no Barbex | Acesso da Equipe e Gestão" },
      { name: "description", content: "Acesso administrativo e profissional para gestão da barbearia no Barbex." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AuthIndexComponent,
});

function AuthIndexComponent() {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="w-full min-w-[320px] max-w-full md:max-w-[550px] flex items-center justify-center p-6 md:p-12"
    >
      <div className="w-full max-w-[430px] md:max-w-[480px]">
        {/* Main Card */}
        <div className="relative group">
          {/* Glow Effect */}
          <div className="absolute -inset-1 bg-gradient-to-b from-gold/20 to-transparent rounded-[32px] blur-2xl opacity-20 group-hover:opacity-30 transition-opacity duration-500" />
          
          <div className="relative bg-[#0d0f14]/80 backdrop-blur-xl border border-white/5 rounded-[32px] shadow-2xl overflow-visible p-8 md:p-10">
            <div className="text-center space-y-2 mb-8">
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tighter uppercase italic leading-none">
                BEM-VINDO AO <span className="text-gold">BARBEX</span>
              </h2>
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed max-w-[260px] mx-auto">
                Acesso de colaboradores e administradores da barbearia.
              </p>
            </div>

            <AuthForm />

            {/* Informational box for clients */}
            <div className="mt-8 pt-6 border-t border-white/5 text-center space-y-1">
              <p className="text-[11px] font-bold text-zinc-400 flex items-center justify-center gap-1.5">
                <Scissors size={12} className="text-gold/80" /> É cliente de uma barbearia?
              </p>
              <p className="text-[10px] text-zinc-500 max-w-[280px] mx-auto leading-relaxed">
                Acesse o link direto da sua barbearia para entrar no Portal do Cliente.
              </p>
            </div>

            {/* Commercial Info / Badges */}
            <div className="mt-8 pt-6 border-t border-white/5 grid grid-cols-2 gap-3">
              {[
                { text: "Agenda em Tempo Real" },
                { text: "Comissões Automáticas" },
                { text: "Fila de Atendimento" },
                { text: "Suporte Dedicado" }
              ].map((info, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <CheckCircle2 size={12} className="text-gold/60 shrink-0" />
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest truncate">{info.text}</span>
                </div>
              ))}
            </div>

            {/* Security Footer */}
            <div className="mt-8 flex flex-col items-center text-center space-y-1.5 opacity-50">
              <div className="flex items-center gap-2 text-[10px] font-black text-white uppercase tracking-widest">
                <ShieldCheck size={14} className="text-gold" />
                Ambiente Seguro
              </div>
              <p className="text-[8px] font-medium text-zinc-500 leading-relaxed max-w-[220px]">
                Acesso protegido com autenticação e isolamento seguro por barbearia.
              </p>
            </div>
          </div>
        </div>
        
        <p className="mt-8 text-center text-zinc-600 text-[9px] font-black uppercase tracking-[0.3em] italic">
          &copy; 2026 BARBEX ENTERPRISE &bull; V1.8.5
        </p>
      </div>
    </motion.div>
  );
}
