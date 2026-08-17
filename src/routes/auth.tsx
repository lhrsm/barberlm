import { createFileRoute } from "@tanstack/react-router";
import { ClientLoginForm } from "@/components/public/auth/ClientLoginForm";
import { BookingAuthStep } from "@/components/public/booking/BookingAuthStep";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scissors } from "lucide-react";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      tab: (search.tab as string) || "login",
      redirect: (search.redirect as string) || undefined,
    };
  },
  component: AuthPageComponent,
  head: () => ({
    meta: [
      { title: "Entrar no Barbex — Portal do Cliente" },
      {
        name: "description",
        content: "Acesse seu histórico, créditos, cashback e agendamentos no Barbex.",
      },
      { property: "og:title", content: "Portal do Cliente Barbex" },
      { property: "og:description", content: "Acesse sua conta de cliente no Barbex." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function AuthPageComponent() {
  const { redirect } = Route.useSearch();
  const [migrationData, setMigrationData] = useState<{ userId: string; phone: string | null } | null>(null);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#050b18] p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gold/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-gold/5 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 mb-4">
            <Scissors className="text-gold w-8 h-8" />
          </div>
          <h1 className="text-xl font-black text-white tracking-widest uppercase">Barbex</h1>
        </div>

        <div className="bg-white rounded-[32px] shadow-2xl overflow-hidden">
          <AnimatePresence mode="wait">
            {!migrationData ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="p-8"
              >
                <ClientLoginForm 
                  onMigrationRequired={(data) => setMigrationData(data)}
                />
              </motion.div>
            ) : (
              <motion.div
                key="migration"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <BookingAuthStep
                  customerName="Cliente Barbex"
                  customerPhone={migrationData.phone || ""}
                  customerId={null} // Identidade vinculada via Auth
                  tenantId="" // Será resolvido no finalize
                  onSuccess={() => window.location.reload()}
                  onBack={() => setMigrationData(null)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <p className="mt-8 text-center text-zinc-500 text-xs font-bold uppercase tracking-widest">
          &copy; 2026 Barbex Enterprise. Segurança Garantida.
        </p>
      </div>
    </div>
  );
}
