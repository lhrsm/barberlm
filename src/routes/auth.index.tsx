import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthForm } from "@/components/auth/AuthForm";
import { ClientLoginForm } from "@/components/public/auth/ClientLoginForm";
import { BookingAuthStep } from "@/components/public/booking/BookingAuthStep";
import { useState } from "react";
import { motion } from "framer-motion";
import { 
  CheckCircle2, 
  ShieldCheck, 
  Sparkles,
  Award
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth/")({
  component: AuthIndexComponent,
});

function AuthIndexComponent() {
  const navigate = useNavigate();
  const search = Route.useSearch() as any;
  const tab = search.tab;
  const [migrationData, setMigrationData] = useState<{ userId: string; phone: string | null } | null>(null);

  const isClientPortal = tab === "client";

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
          
          <div className={`relative ${isClientPortal ? 'bg-white' : 'bg-[#0d0f14]/80 backdrop-blur-xl border border-white/5'} rounded-[32px] shadow-2xl overflow-visible p-8 md:p-10`}>
            <div className="text-center space-y-3 mb-10">
              <h2 className={`text-2xl md:text-3xl font-black ${isClientPortal ? 'text-zinc-900' : 'text-white'} tracking-tighter uppercase italic leading-none`}>
                {isClientPortal ? 'PORTAL DO' : 'BEM-VINDO'} <span className="text-gold">{isClientPortal ? 'CLIENTE' : 'BARBEX'}</span>
              </h2>
              <p className={`${isClientPortal ? 'text-zinc-400' : 'text-zinc-500'} text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed max-w-[240px] mx-auto`}>
                {isClientPortal ? 'Gerencie seus agendamentos e cashback em um só lugar.' : 'Acesse sua barbearia e gerencie sua operação de qualquer lugar.'}
              </p>
            </div>

            {isClientPortal ? (
              <div className="space-y-6">
                {!migrationData ? (
                  <ClientLoginForm onMigrationRequired={(data) => setMigrationData(data)} />
                ) : (
                  <BookingAuthStep
                    customerName="Cliente Barbex"
                    customerPhone={migrationData.phone || ""}
                    customerId={null}
                    tenantId=""
                    onSuccess={() => window.location.reload()}
                    onBack={() => setMigrationData(null)}
                  />
                )}
                <div className="text-center pt-4">
                  <Button 
                    variant="link" 
                    onClick={() => {
                      const currentSlug = window.location.pathname.split('/')[1];
                      window.location.href = '/auth';
                    }}
                    className="text-zinc-400 hover:text-gold text-[10px] font-black uppercase tracking-widest"
                  >
                    Acesso Administrativo
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <AuthForm />
                <div className="text-center pt-6">
                  <Button 
                    variant="link" 
                    onClick={() => {
                      // Redireciona para o portal global apenas se não houver contexto, 
                      // mas ClientLoginForm cuidará da resolução.
                      navigate({ to: '/auth', search: { tab: 'client' } });
                    }}
                    className="text-zinc-500 hover:text-gold text-[10px] font-black uppercase tracking-widest"
                  >
                    Acesso para Clientes
                  </Button>
                </div>
              </>
            )}

            {/* Commercial Info / Badges */}
            <div className={`mt-8 pt-8 border-t ${isClientPortal ? 'border-zinc-100' : 'border-white/5'} grid grid-cols-2 gap-4`}>
              {[
                { text: isClientPortal ? "Check-in Rápido" : "15 dias grátis" },
                { text: isClientPortal ? "Histórico 360°" : "Sem cartão" },
                { text: isClientPortal ? "Cashback Ativo" : "Config. Rápida" },
                { text: isClientPortal ? "Agenda 24h" : "Suporte VIP" }
              ].map((info, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <CheckCircle2 size={12} className="text-gold/60" />
                  <span className={`text-[9px] font-bold ${isClientPortal ? 'text-zinc-400' : 'text-zinc-500'} uppercase tracking-widest`}>{info.text}</span>
                </div>
              ))}
            </div>

            {/* Security Footer */}
            <div className="mt-10 flex flex-col items-center text-center space-y-2 opacity-50">
              <div className={`flex items-center gap-2 text-[10px] font-black ${isClientPortal ? 'text-zinc-900' : 'text-white'} uppercase tracking-widest`}>
                <ShieldCheck size={14} className="text-gold" />
                Ambiente Seguro
              </div>
              <p className={`text-[8px] font-medium ${isClientPortal ? 'text-zinc-500' : 'text-zinc-500'} leading-relaxed max-w-[200px]`}>
                Seus dados são protegidos por autenticação e controles de segurança avançados.
              </p>
            </div>
          </div>
        </div>
        
        <p className="mt-8 text-center text-zinc-600 text-[9px] font-black uppercase tracking-[0.3em] italic">
          &copy; 2026 BARBEX ENTERPRISE &bull; V1.8.4
        </p>
      </div>
    </motion.div>
  );
}
