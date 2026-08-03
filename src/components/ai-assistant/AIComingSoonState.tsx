import { motion } from "framer-motion";
import { 
  Sparkles, 
  MessageSquare, 
  Lock, 
  ShieldCheck, 
  BarChart3, 
  Zap, 
  AlertCircle,
  HelpCircle,
  Search,
  Database,
  EyeOff
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export function AIComingSoonState() {
  const suggestedQuestions = [
    "Quanto faturei este mês?",
    "Qual profissional teve maior ocupação?",
    "Quais clientes ainda não retornaram?",
    "Qual serviço possui maior receita?",
    "Qual produto está parado?",
    "Como está o meu ticket médio?"
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-8 rounded-3xl bg-zinc-900/50 border border-gold/10 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gold/5 blur-[80px] -z-10 rounded-full" />
        
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gold/10 rounded-xl">
              <Sparkles className="h-6 w-6 text-gold" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">Assistente Barbex</h1>
            <Badge className="bg-gold text-black font-black uppercase tracking-widest text-[10px] px-2 py-0.5 ml-2 shadow-[0_0_15px_rgba(212,175,55,0.3)] border-none">
              Beta Interno
            </Badge>
          </div>
          <p className="text-white/50 font-medium max-w-xl">
            Sua barbearia movida a inteligência operacional. Transforme dados em decisões estratégicas através de uma interface conversacional segura.
          </p>
        </div>

        <div className="flex flex-col gap-2">
           <div className="flex items-center gap-2 text-xs font-bold text-white/40 uppercase tracking-widest">
             <ShieldCheck className="h-3.5 w-3.5" />
             Arquitetura Segura
           </div>
           <div className="flex items-center gap-2 text-xs font-bold text-white/40 uppercase tracking-widest">
             <Lock className="h-3.5 w-3.5" />
             Dados Criptografados
           </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Chat Preview (Disabled) */}
        <Card className="md:col-span-2 bg-[#0b0f17] border-gold/10 rounded-3xl overflow-hidden flex flex-col min-h-[500px] shadow-2xl">
          <CardHeader className="border-b border-gold/5 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
              <CardTitle className="text-sm font-bold text-white/60">Sessão de Inteligência</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center items-center p-12 text-center space-y-6">
            <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center border border-gold/5 relative">
               <div className="absolute inset-0 bg-gold/5 blur-xl rounded-full" />
               <EyeOff className="h-10 w-10 text-gold/20 relative z-10" />
            </div>
            <div className="space-y-2 max-w-sm">
              <h3 className="text-xl font-black text-white">Interface em Preparação</h3>
              <p className="text-sm text-white/40 font-medium">
                Nenhuma ação será executada automaticamente. O assistente terá acesso apenas a ferramentas de consulta autorizadas por você.
              </p>
            </div>
          </CardContent>
          <div className="p-6 border-t border-gold/5 bg-white/[0.01]">
            <div className="relative group">
              <Input 
                disabled 
                placeholder="Pergunte algo sobre sua barbearia..." 
                className="h-14 bg-zinc-950 border-gold/10 rounded-2xl text-white/20 font-bold pr-12 cursor-not-allowed"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/10">
                <Zap className="h-5 w-5" />
              </div>
            </div>
          </div>
        </Card>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card className="bg-zinc-900/40 border-gold/10 rounded-3xl shadow-xl">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-gold">
                <HelpCircle className="h-4 w-4" />
                Exemplos de Perguntas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {suggestedQuestions.map((q, i) => (
                <div 
                  key={i} 
                  className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 text-xs font-bold text-white/60 hover:text-gold hover:border-gold/30 transition-all cursor-default"
                >
                  {q}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/40 border-gold/10 rounded-3xl shadow-xl overflow-hidden group">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                <Database className="h-4 w-4" />
                Fontes de Dados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="flex flex-wrap gap-2">
                  {['Financeiro', 'Agenda', 'CRM', 'Produtos', 'KPIs', 'Assinaturas'].map(tag => (
                    <Badge key={tag} variant="outline" className="bg-zinc-950/50 border-white/5 text-[10px] text-white/40 font-bold uppercase tracking-widest">
                      {tag}
                    </Badge>
                  ))}
               </div>
               <p className="text-[10px] text-white/30 font-medium leading-relaxed">
                 O assistente utiliza os cálculos consolidados da sua Central de KPIs e ERP. Nenhuma informação privada é compartilhada fora do seu tenant.
               </p>
            </CardContent>
            <div className="h-1 w-full bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
          </Card>
        </div>
      </div>

      {/* Security Notice */}
      <div className="p-6 rounded-3xl bg-blue-500/5 border border-blue-500/10 flex gap-4 items-start">
         <AlertCircle className="h-5 w-5 text-blue-400 shrink-0 mt-1" />
         <div className="space-y-1">
            <h4 className="text-sm font-bold text-blue-400">Política de Privacidade e IA</h4>
            <p className="text-xs text-blue-400/60 font-medium leading-relaxed">
              Respeitamos a LGPD. Dados sensíveis como CPF, telefones e e-mails são mascarados antes do processamento. O histórico de conversas é isolado por usuário e tenant.
            </p>
         </div>
      </div>
    </div>
  );
}
