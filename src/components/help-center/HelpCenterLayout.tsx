import { ReactNode } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GraduationCap } from "lucide-react";

interface HelpCenterLayoutProps {
  children: ReactNode;
}

export function HelpCenterLayout({ children }: HelpCenterLayoutProps) {
  return (
    <AppLayout>
      <div className="min-h-screen bg-[#05070d] text-white">
        <div className="p-4 md:p-8 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
          <header className="flex items-center gap-4">
            <div className="shrink-0 h-14 w-14 rounded-2xl bg-gradient-to-br from-[#f59e0b]/20 to-[#ea580c]/5 border border-[#f59e0b]/30 grid place-items-center shadow-[0_4px_20px_rgba(245,158,11,0.15)]">
              <GraduationCap className="h-7 w-7 text-[#f59e0b]" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">Central de Ajuda 2.0</h1>
              <p className="text-sm text-zinc-400 mt-1">Sua base de conhecimento completa para dominar o Barbex.</p>
            </div>
          </header>
          {children}
        </div>
      </div>
    </AppLayout>
  );
}
