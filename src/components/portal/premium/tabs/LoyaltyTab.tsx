import { useState } from "react";
import { motion } from "framer-motion";
import {
  Gift,
  Award,
  Crown,
  Sparkles,
  CheckCircle2,
  Lock,
  Scissors,
  Users,
  TrendingUp,
  Wallet,
  Coins,
  Star,
  Calendar,
  Compass,
  Repeat
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LoyaltyTierProgress } from "@/components/portal/premium/LoyaltyTierProgress";

interface LoyaltyTabProps {
  customerData: any;
  appointments: any[];
  creditTransactions: any[];
  cashbackTransactions: any[];
  reviews: any[];
  reviewsStatus?: 'success' | 'error' | 'unknown';
  shopName?: string;
}

export function LoyaltyTab({
  customerData,
  appointments = [],
  creditTransactions = [],
  cashbackTransactions = [],
  reviews = [],
  reviewsStatus = 'success',
  shopName
}: LoyaltyTabProps) {
  const [filterCategory, setFilterCategory] = useState<'all' | 'unlocked' | 'progress' | 'locked'>('all');

  // Fatos objetivos calculados
  const completedAppts = appointments.filter(a => a.status === 'completed');
  const completedCount = completedAppts.length;
  const distinctServices = new Set(completedAppts.map(a => a.service_id).filter(Boolean)).size;
  const distinctBarbers = new Set(completedAppts.map(a => a.barber_id).filter(Boolean)).size;
  const totalSpent = completedAppts.reduce((sum, a) => sum + Number(a.final_amount || a.total_price || 0), 0);

  const cashbackReceived = cashbackTransactions
    .filter(t => t.type === 'credit' || Number(t.amount || 0) > 0)
    .reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);

  const creditsUsed = creditTransactions
    .filter(t => t.type === 'debit' || Number(t.amount || 0) < 0).length;
  const creditsCurrent = Number(customerData?.credits || 0);
  const reviewsCount = reviews.length;

  // Atendimentos no mesmo mês
  const monthlyCounts = completedAppts.reduce((acc: any, a) => {
    const month = a.start_time ? a.start_time.substring(0, 7) : '';
    if (month) acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {});
  const maxInSameMonth = Object.values(monthlyCounts).length > 0 ? Math.max(...(Object.values(monthlyCounts) as number[])) : 0;

  // Catálogo completo de conquistas
  const catalog = [
    // Jornada
    {
      id: 'primeiro_passo',
      name: 'Primeiro Atendimento',
      description: 'Concluiu seu primeiro atendimento na barbearia',
      icon: Scissors,
      category: 'Jornada',
      xp: 50,
      current: Math.min(completedCount, 1),
      target: 1,
      unlockedAt: completedAppts[completedAppts.length - 1]?.start_time
    },
    {
      id: 'cliente_frequente',
      name: 'Cliente Frequente',
      description: 'Concluiu 5 atendimentos na barbearia',
      icon: Scissors,
      category: 'Jornada',
      xp: 150,
      current: Math.min(completedCount, 5),
      target: 5
    },
    {
      id: 'cliente_fiel',
      name: 'Cliente Fiel',
      description: 'Concluiu 10 atendimentos na barbearia',
      icon: Award,
      category: 'Jornada',
      xp: 300,
      current: Math.min(completedCount, 10),
      target: 10
    },
    {
      id: 'cliente_vip',
      name: 'Cliente VIP',
      description: 'Concluiu 25 atendimentos na barbearia',
      icon: Crown,
      category: 'Jornada',
      xp: 600,
      current: Math.min(completedCount, 25),
      target: 25
    },
    {
      id: 'lenda_barbearia',
      name: 'Lenda da Barbearia',
      description: 'Concluiu 50 atendimentos na barbearia',
      icon: Sparkles,
      category: 'Jornada',
      xp: 1200,
      current: Math.min(completedCount, 50),
      target: 50
    },

    // Fidelidade & Finanças
    {
      id: 'primeiro_cashback',
      name: 'Primeiro Cashback',
      description: 'Recebeu cashback em um atendimento',
      icon: Wallet,
      category: 'Fidelidade',
      xp: 75,
      current: cashbackReceived > 0 ? 1 : 0,
      target: 1
    },
    {
      id: 'cofrinho_crescendo',
      name: 'Cofrinho Crescendo',
      description: 'Acumulou R$ 25 em cashback histórico',
      icon: Wallet,
      category: 'Fidelidade',
      xp: 150,
      current: Math.min(cashbackReceived, 25),
      target: 25,
      unit: 'R$'
    },
    {
      id: 'mestre_cashback',
      name: 'Mestre do Cashback',
      description: 'Acumulou R$ 100 em cashback histórico',
      icon: Coins,
      category: 'Fidelidade',
      xp: 350,
      current: Math.min(cashbackReceived, 100),
      target: 100,
      unit: 'R$'
    },
    {
      id: 'primeiro_credito',
      name: 'Primeiro Crédito',
      description: 'Possui ou utilizou saldo em créditos no estabelecimento',
      icon: Coins,
      category: 'Fidelidade',
      xp: 50,
      current: creditsCurrent > 0 || creditsUsed > 0 ? 1 : 0,
      target: 1
    },
    {
      id: 'investidor',
      name: 'Investidor no Estilo',
      description: 'Totalizou mais de R$ 500 investidos em seu visual',
      icon: TrendingUp,
      category: 'Fidelidade',
      xp: 400,
      current: Math.min(totalSpent, 500),
      target: 500,
      unit: 'R$'
    },

    // Avaliações
    {
      id: 'primeira_avaliacao',
      name: 'Primeira Avaliação',
      description: 'Avaliou um atendimento e compartilhou sua opinião',
      icon: Star,
      category: 'Avaliações',
      xp: 50,
      current: Math.min(reviewsCount, 1),
      target: 1
    },
    {
      id: 'critico_casa',
      name: 'Crítico da Casa',
      description: 'Enviou 5 avaliações de atendimentos realizados',
      icon: Star,
      category: 'Avaliações',
      xp: 200,
      current: Math.min(reviewsCount, 5),
      target: 5
    },

    // Experiência & Estilo
    {
      id: 'explorador',
      name: 'Explorador de Estilos',
      description: 'Experimentou 3 tipos de serviços diferentes',
      icon: Compass,
      category: 'Experiência',
      xp: 150,
      current: Math.min(distinctServices, 3),
      target: 3
    },
    {
      id: 'membro_da_casa',
      name: 'Membro da Casa',
      description: 'Foi atendido por 2 ou mais profissionais da equipe',
      icon: Users,
      category: 'Experiência',
      xp: 100,
      current: Math.min(distinctBarbers, 2),
      target: 2
    },

    // Recorrência
    {
      id: 'mes_ativo',
      name: 'Mês em Dia',
      description: 'Realizou 3 atendimentos no mesmo mês',
      icon: Repeat,
      category: 'Recorrência',
      xp: 200,
      current: Math.min(maxInSameMonth, 3),
      target: 3
    }
  ];

  const processedAchievements = catalog.map(ach => {
    if (ach.category === 'Avaliações' && reviewsStatus === 'error') {
      return {
        ...ach,
        isUnlocked: false,
        progress: 0,
        status: 'locked' as const,
        isUnavailable: true
      };
    }
    const isUnlocked = ach.current >= ach.target;
    const progress = Math.min(100, Math.round((ach.current / ach.target) * 100));
    const status: 'unlocked' | 'progress' | 'locked' = isUnlocked ? 'unlocked' : progress > 0 ? 'progress' : 'locked';
    return { ...ach, isUnlocked, progress, status, isUnavailable: false };
  });

  const unlockedList = processedAchievements.filter(a => a.status === 'unlocked');
  const progressList = processedAchievements.filter(a => a.status === 'progress');
  const lockedList = processedAchievements.filter(a => a.status === 'locked');

  const filteredAchievements =
    filterCategory === 'unlocked' ? unlockedList :
    filterCategory === 'progress' ? progressList :
    filterCategory === 'locked' ? lockedList :
    processedAchievements;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Nível de Fidelidade Hero */}
      <LoyaltyTierProgress appointments={appointments} />

      {/* Resumo de Conquistas */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-white uppercase italic tracking-tight flex items-center gap-2">
            <Gift className="text-gold h-6 w-6" />
            Conquistas & Recompensas
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Desbloqueie conquistas exclusivas frequentando e interagindo com a <span className="text-white font-bold">{shopName || 'barbearia'}</span>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge className="bg-gold/15 text-gold border-gold/30 px-3 py-1 text-xs font-black uppercase tracking-wider">
            {unlockedList.length} Desbloqueadas
          </Badge>
          <Badge className="bg-white/5 text-zinc-300 border-white/10 px-3 py-1 text-xs font-black uppercase tracking-wider">
            {unlockedList.length} / {catalog.length} Concluídas
          </Badge>
        </div>
      </div>

      {/* Filtros de Conquistas */}
      <div className="flex items-center gap-2 bg-[#05070D] p-1.5 rounded-2xl border border-white/5 w-full sm:w-fit">
        {[
          { id: 'all', label: 'Todas', count: catalog.length },
          { id: 'unlocked', label: 'Desbloqueadas', count: unlockedList.length },
          { id: 'progress', label: 'Em Progresso', count: progressList.length },
          { id: 'locked', label: 'A Conquistar', count: lockedList.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterCategory(tab.id as any)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
              filterCategory === tab.id
                ? "bg-gold text-black shadow-lg"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            )}
          >
            <span>{tab.label}</span>
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-md font-bold",
              filterCategory === tab.id ? "bg-black/20 text-black" : "bg-white/10 text-zinc-400"
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Grid de Conquistas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAchievements.map((ach, idx) => {
          const Icon = ach.icon;
          const isUnlocked = ach.isUnlocked;

          return (
            <motion.div
              key={ach.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
            >
              <Card className={cn(
                "relative overflow-hidden rounded-3xl border transition-all duration-300 h-full flex flex-col justify-between p-5",
                isUnlocked
                  ? "bg-gradient-to-br from-gold/10 via-[#0a0d14] to-black border-gold/40 shadow-lg shadow-gold/5"
                  : ach.status === 'progress'
                  ? "bg-[#0b0f17]/80 border-white/10 hover:border-gold/30"
                  : "bg-zinc-950/40 border-white/5 opacity-60 grayscale-[50%]"
              )}>
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className={cn(
                      "h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 border transition-all",
                      isUnlocked
                        ? "bg-gradient-to-br from-gold to-[#d4af37] text-black border-gold shadow-lg shadow-gold/20"
                        : "bg-white/5 text-zinc-400 border-white/10"
                    )}>
                      <Icon size={22} />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Badge className={cn(
                        "text-[9px] font-black uppercase tracking-widest",
                        ach.isUnavailable ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                        isUnlocked ? "bg-gold/20 text-gold border-gold/40" : "bg-white/5 text-zinc-500 border-white/10"
                      )}>
                        {ach.isUnavailable ? "Indisponível" : isUnlocked ? "Conquistada" : ach.status === 'progress' ? "Em Progresso" : "Bloqueada"}
                      </Badge>
                      {isUnlocked ? (
                        <CheckCircle2 size={18} className="text-gold shrink-0" />
                      ) : (
                        <Lock size={15} className="text-zinc-600 shrink-0" />
                      )}
                    </div>
                  </div>

                  <h4 className={cn(
                    "text-sm font-black uppercase italic tracking-tight mb-1",
                    isUnlocked ? "text-white" : "text-zinc-300"
                  )}>
                    {ach.name}
                  </h4>
                  <p className="text-xs text-zinc-400 leading-snug">
                    {ach.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-zinc-500 uppercase tracking-wider text-[9px]">{ach.category}</span>
                    <span className={cn(isUnlocked ? "text-gold font-black" : "text-zinc-400")}>
                      {ach.isUnavailable
                        ? "Status indisponível"
                        : isUnlocked
                        ? "Concluída ✓"
                        : `${ach.unit ? `${ach.unit} ` : ''}${ach.current} / ${ach.unit ? `${ach.unit} ` : ''}${ach.target}`}
                    </span>
                  </div>

                  {/* Barra de Progresso */}
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${ach.progress}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className={cn(
                        "h-full rounded-full",
                        isUnlocked ? "bg-gradient-to-r from-gold to-amber-300" : "bg-zinc-600"
                      )}
                    />
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
