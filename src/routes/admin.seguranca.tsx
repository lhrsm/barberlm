import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { withModule } from "@/components/modules/withModule";
import { 
  ShieldAlert, 
  ShieldCheck, 
  Lock, 
  Key, 
  Users, 
  History, 
  FileLock, 
  Eye, 
  AlertTriangle,
  Fingerprint,
  Smartphone,
  Shield,
  Zap,
  CheckCircle2,
  XCircle,
  Activity,
  ArrowRight,
  Database,
  Globe
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  PremiumTabs, 
  PremiumTabsList, 
  PremiumTabsBody, 
  PremiumTabsContent 
} from "@/components/ui/premium-tabs";
import { useQuery } from "@tanstack/react-query";
import { getSecurityOverview } from "@/lib/security-enterprise.functions";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

function SecurityCenterPage() {
  const { data: overview, isLoading } = useQuery({
    queryKey: ['security-overview'],
    queryFn: () => getSecurityOverview({ data: {} })
  });

  const securityScore = overview?.score || 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header Premium */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 grid place-items-center shadow-lg shadow-indigo-500/5">
            <ShieldCheck className="text-indigo-400" size={28} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter leading-none">Central de Segurança</h1>
            <p className="text-zinc-500 font-medium text-sm mt-1">Camada Enterprise de proteção, governança e conformidade LGPD.</p>
          </div>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-[#0b0f17] border-zinc-800/80 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] -z-10 group-hover:bg-indigo-500/10 transition-all" />
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-white font-black italic uppercase tracking-tight">Status Geral do Tenant</CardTitle>
                <CardDescription className="text-zinc-500 font-bold">Nível de proteção atual baseado em 42 critérios auditados.</CardDescription>
              </div>
              <div className="text-right">
                <span className="text-4xl font-black text-white italic">{securityScore}%</span>
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mt-1 italic">Nível Enterprise</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500">
                <span className="text-white">{securityScore}/100</span>
              </div>
              <Progress value={securityScore} className="h-2 bg-zinc-800" />
            </div>


            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-zinc-800/50">
              <SecurityIndicator icon={Lock} label="RLS Ativo" status="success" />
              <SecurityIndicator icon={Fingerprint} label="MFA" status="warning" />
              <SecurityIndicator icon={Globe} label="CORS" status="success" />
              <SecurityIndicator icon={Shield} label="Rate Limit" status="success" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0b0f17] border-zinc-800/80 shadow-2xl flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-white font-black italic uppercase tracking-tight">Alertas de Risco</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-3">
            {overview?.alerts?.map((alert: any) => (
              <div key={alert.id} className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl flex items-start gap-3 hover:border-amber-500/30 transition-all cursor-pointer group">
                <AlertTriangle className={cn("mt-0.5 shrink-0", alert.severity === 'high' ? "text-rose-500" : "text-amber-500")} size={16} />

                <div className="flex-1">
                  <p className="text-xs font-black text-white uppercase tracking-tight group-hover:text-amber-400 transition-colors">{alert.title}</p>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase mt-0.5">{alert.actor}</p>
                </div>
                <ArrowRight size={14} className="text-zinc-700 group-hover:translate-x-1 group-hover:text-white transition-all" />
              </div>
            ))}
            {(!overview?.alerts || overview.alerts.length === 0) && (
              <div className="h-full flex flex-col items-center justify-center py-8 text-center">
                <ShieldCheck className="text-emerald-500/20 mb-2" size={48} />
                <p className="text-xs font-bold text-zinc-500 italic">Nenhuma vulnerabilidade crítica detectada no momento.</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="pt-0">
            <Button variant="ghost" className="w-full h-9 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-xl">
              Ver Histórico Completo
            </Button>
          </CardFooter>
        </Card>
      </div>

      <PremiumTabs defaultValue="overview">
        <PremiumTabsList 
          tabs={[
            { value: "overview", label: "Visão Geral", icon: Shield },
            { value: "auth", label: "Acesso & MFA", icon: Key },
            { value: "audit", label: "Auditoria", icon: History },
            { value: "lgpd", label: "LGPD & Privacidade", icon: FileLock },
            { value: "infra", label: "Infra & Backup", icon: Database },
          ]}
        />
        <PremiumTabsBody>
          <PremiumTabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SecurityModuleCard 
                title="Proteção de Identidade"
                description="Gestão de sessões, MFA e controle de dispositivos ativos."
                icon={Fingerprint}
                status="Ativo"
                items={["Políticas de Senha", "Sessões Ativas", "MFA Adaptativo (Beta)"]}
              />
              <SecurityModuleCard 
                title="Isolamento Multi-tenant"
                description="RLS auditado e guards de proteção cross-tenant."
                icon={Lock}
                status="Blindado"
                items={["Tabelas RLS", "RPC Guards", "Token Mapping"]}
              />
              <SecurityModuleCard 
                title="Conformidade LGPD"
                description="Governança de dados, consentimentos e anonimização."
                icon={FileLock}
                status="Pendente"
                items={["Inventário de Dados", "Portabilidade", "Direito ao Esquecimento"]}
              />
              <SecurityModuleCard 
                title="Auditoria Proativa"
                description="Logs imutáveis de todas as operações administrativas."
                icon={History}
                status="Logando"
                items={["Audit Logs", "Alertas de Risco", "Impersonation Tracker"]}
              />
            </div>
          </PremiumTabsContent>

          <PremiumTabsContent value="auth">
            <div className="p-12 text-center text-zinc-500 italic bg-[#0b0f17] border border-zinc-800 rounded-2xl">
               Configurações avançadas de MFA e Política de Acesso serão migradas para cá na Fase 2.
            </div>
          </PremiumTabsContent>

          <PremiumTabsContent value="audit">
            <div className="p-12 text-center text-zinc-500 italic bg-[#0b0f17] border border-zinc-800 rounded-2xl">
               Visualizador de Logs de Auditoria Enterprise disponível na Fase 3.
            </div>
          </PremiumTabsContent>
        </PremiumTabsBody>
      </PremiumTabs>
    </div>
  );
}

function SecurityIndicator({ icon: Icon, label, status }: any) {
  return (
    <div className="flex flex-col items-center gap-2 p-2 rounded-xl hover:bg-zinc-900/50 transition-colors cursor-default">
      <div className={cn(
        "h-10 w-10 rounded-xl border grid place-items-center",
        status === 'success' ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-500" : "bg-amber-500/5 border-amber-500/20 text-amber-500"
      )}>
        <Icon size={20} />
      </div>
      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-tighter text-center leading-none px-1">{label}</span>
      <div className={cn("h-1 w-4 rounded-full", status === 'success' ? "bg-emerald-500" : "bg-amber-500")} />
    </div>
  );
}

function SecurityModuleCard({ title, description, icon: Icon, status, items }: any) {
  return (
    <Card className="bg-[#0b0f17] border-zinc-800/80 hover:border-indigo-500/30 transition-all group">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="h-10 w-10 rounded-xl bg-zinc-900 border border-zinc-800 grid place-items-center group-hover:bg-indigo-500/10 group-hover:border-indigo-500/30 transition-all">
            <Icon size={20} className="text-zinc-500 group-hover:text-indigo-400" />
          </div>
          <Badge className="bg-zinc-800 text-zinc-400 border-none font-black uppercase text-[8px] tracking-widest">{status}</Badge>
        </div>
        <CardTitle className="text-white font-black italic uppercase tracking-tight mt-4 group-hover:text-indigo-400 transition-colors">{title}</CardTitle>
        <CardDescription className="text-xs text-zinc-500 font-medium italic">"{description}"</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((item: string, i: number) => (
            <li key={i} className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase italic">
              <CheckCircle2 size={12} className="text-emerald-500/50" />
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="pt-2">
        <Button variant="link" className="p-0 h-auto text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300">
          Gerenciar Módulo <ArrowRight size={10} className="ml-1" />
        </Button>
      </CardFooter>
    </Card>
  );
}

export const Route = createFileRoute("/admin/seguranca")({
  component: SecurityCenterPage,
  head: () => ({
    title: "Central de Segurança Enterprise | Barbex",
    meta: [
      { name: "description", content: "Auditoria, conformidade LGPD e governança Enterprise do Barbex." }
    ]
  })
});
