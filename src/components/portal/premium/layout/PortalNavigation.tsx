import * as React from "react";
import { motion } from "framer-motion";
import { 
  Calendar, 
  Gift, 
  Crown, 
  QrCode, 
  TrendingUp, 
  User as UserIcon, 
  ShieldCheck, 
  ShoppingBag,
  Ticket,
  LayoutDashboard
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  show?: boolean;
};

type Props = {
  activeTab: string;
  onTabChange: (id: string) => void;
  isSubscriber: boolean;
  subscriptionsEnabled: boolean;
  storeEnabled: boolean;
  couponsEnabled: boolean;
};

export function PortalNavigation({ 
  activeTab, 
  onTabChange, 
  isSubscriber, 
  subscriptionsEnabled, 
  storeEnabled, 
  couponsEnabled 
}: Props) {
  const tabs: Tab[] = [
    { id: "home", label: "Início", icon: LayoutDashboard },
    { id: "appointments", label: "Agendamentos", icon: Calendar },
    { id: "benefits", label: "Benefícios", icon: Crown, show: isSubscriber },
    { id: "club", label: "Clube Barbex", icon: SparklesIcon, show: !isSubscriber && subscriptionsEnabled },
    { id: "loyalty", label: "Fidelidade", icon: Gift },
    { id: "products", label: "Produtos", icon: ShoppingBag, show: storeEnabled },
    { id: "coupons", label: "Cupons", icon: Ticket, show: couponsEnabled },
    { id: "finances", label: "Extrato", icon: TrendingUp },
    { id: "profile", label: "Perfil", icon: UserIcon },
    { id: "privacy", label: "Privacidade", icon: ShieldCheck },
  ].filter(t => t.show !== false);

  return (
    <div className="sticky top-16 z-40 w-full bg-black/80 backdrop-blur-md border-b border-white/10 overflow-x-auto no-scrollbar">
      <div className="max-w-7xl mx-auto px-6 flex items-center h-14 gap-1">
        <a 
          href={`/${window.location.pathname.split('/')[1] || ''}`}
          className="flex items-center gap-2 px-4 h-10 rounded-xl transition-all whitespace-nowrap text-sm font-bold text-white/40 hover:text-gold hover:bg-gold/5 mr-2"
        >
          <LayoutDashboard size={16} />
          Site
        </a>
        <div className="h-4 w-px bg-white/10 mx-2" />
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "relative flex items-center gap-2 px-4 h-10 rounded-xl transition-all whitespace-nowrap text-sm font-bold",
                isActive ? "text-gold" : "text-white/40 hover:text-white hover:bg-white/5"
              )}
            >
              <Icon size={16} className={cn(isActive ? "text-gold" : "text-inherit")} />
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId="active-portal-tab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SparklesIcon({ size = 16 }: { size?: number }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" />
    </svg>
  );
}
