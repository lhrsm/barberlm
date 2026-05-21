import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  CreditCard, 
  Search, 
  Filter, 
  User, 
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/subscriptions")({
  component: AdminSubscriptions,
});

function AdminSubscriptions() {
  const [search, setSearch] = useState("");

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: async () => {
      // Usando query direta para garantir que o join funcione mesmo sem FK explícita no cliente
      const { data, error } = await supabase
        .from("subscriptions")
        .select(`
          *,
          profiles:user_id (
            business_name,
            whatsapp_number
          )
        `)
        .order('created_at', { ascending: false }) as any;

      if (error) {
        console.error("Error fetching subscriptions:", error);
        throw error;
      }
      return data || [];
    }
  });

  const filteredSubscriptions = subscriptions?.filter((sub: any) => {
    const bizName = sub.profiles?.business_name || \"\";
    const stripeId = sub.stripe_subscription_id || \"\";
    return bizName.toLowerCase().includes(search.toLowerCase()) ||
           stripeId.toLowerCase().includes(search.toLowerCase());
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-none shadow-[0_0_10px_rgba(16,185,129,0.2)]">Ativa</Badge>;
      case 'trialing':
        return <Badge className="bg-blue-500/20 text-blue-400 border-none">Trial</Badge>;
      case 'past_due':
        return <Badge className="bg-amber-500/20 text-amber-400 border-none">Atrasada</Badge>;
      case 'canceled':
        return <Badge className="bg-rose-500/20 text-rose-400 border-none">Cancelada</Badge>;
      default:
        return <Badge variant="outline" className="text-gray-400 border-white/10">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tight text-white italic">ASSINATURAS SAAS</h2>
          <p className="text-gray-400 font-medium">Controle de pagamentos e ciclos de faturamento.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input 
              placeholder="Buscar por barbearia ou ID..." 
              className="pl-12 h-12 bg-white/5 border-white/10 rounded-2xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon" className="h-12 w-12 rounded-2xl bg-white/5 border-white/10">
            <Filter className="h-5 w-5 text-gray-400" />
          </Button>
        </div>
      </div>

      <Card className="glass border-white/5 rounded-[2.5rem] overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-gray-400 font-bold uppercase tracking-widest text-[10px] py-6 pl-8">Cliente / Empresa</TableHead>
                <TableHead className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Plano / Preço</TableHead>
                <TableHead className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Status</TableHead>
                <TableHead className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Vencimento</TableHead>
                <TableHead className="text-right text-gray-400 font-bold uppercase tracking-widest text-[10px] pr-8">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-white/5">
                    <TableCell colSpan={5} className="py-8 text-center animate-pulse text-gray-500">Carregando dados...</TableCell>
                  </TableRow>
                ))
              ) : filteredSubscriptions?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20 text-gray-500 italic">
                    Nenhuma assinatura encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filteredSubscriptions?.map((sub: any) => (
                  <TableRow key={sub.id} className="border-white/5 hover:bg-white/5 transition-colors group">
                    <TableCell className="py-6 pl-8">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                          <User className="w-5 h-5 text-purple-400" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-white group-hover:text-purple-400 transition-colors">
                            {sub.profiles?.business_name || "Usuário SaaS"}
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono tracking-tighter uppercase">ID: {sub.stripe_subscription_id || "Manual"}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <Badge variant="outline" className="w-fit text-[10px] border-purple-500/30 text-purple-400 bg-purple-500/5 uppercase italic font-black">
                          {sub.product_id?.split('_').pop() || "PREMIUM"}
                        </Badge>
                        <span className="text-xs text-gray-400 mt-1">Recorrente mensal</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(sub.status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-gray-300">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">
                          {sub.current_period_end 
                            ? format(new Date(sub.current_period_end), "dd 'de' MMM", { locale: ptBR })
                            : "Sem data"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <Button variant="ghost" size="icon" className="hover:bg-purple-500/20 hover:text-purple-400 rounded-xl transition-all">
                        <ExternalLink className="h-5 w-5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
