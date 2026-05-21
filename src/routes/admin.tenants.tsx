import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Search, 
  MoreVertical, 
  Ban, 
  Unlock, 
  ExternalLink, 
  KeyRound,
  History,
  AlertTriangle,
  Users,
  CalendarDays,
  DollarSign,
  Filter,
  CreditCard,
  Building2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/admin/tenants")({
  component: AdminTenants,
});

function AdminTenants() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: async () => {
      const [{ data: profiles, error }, { data: roles, error: rolesError }] = await Promise.all([
        supabase
          .from("profiles")
          .select(`
            id, 
            business_name, 
            plan, 
            status, 
            created_at,
            whatsapp_number
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from("user_roles")
          .select("user_id, role"),
      ]);

      if (error) throw error;
      if (rolesError) throw rolesError;
      if (!profiles) return [];

      const tenantIds = new Set(
        (roles || [])
          .filter((entry) => entry.role === 'tenant_admin')
          .map((entry) => entry.user_id)
      );

      const onlyTenants = profiles.filter((profile) => tenantIds.has(profile.id));

      // Fetch additional stats for each tenant (in parallel)
      const tenantsWithStats = await Promise.all(onlyTenants.map(async (tenant) => {
        const { count: customers } = await supabase
          .from("customers")
          .select("*", { count: 'exact', head: true })
          .eq("user_id", tenant.id);

        const { count: barbers } = await supabase
          .from("barbers")
          .select("*", { count: 'exact', head: true })
          .eq("user_id", tenant.id);

        const { data: revenueData } = await supabase
          .from("appointments")
          .select("final_amount")
          .eq("user_id", tenant.id)
          .eq("status", "completed");

        const revenue = revenueData?.reduce((acc, curr) => acc + (curr.final_amount || 0), 0) || 0;

        return {
          ...tenant,
          stats: {
            customers: customers || 0,
            barbers: barbers || 0,
            revenue
          }
        };
      }));

      return tenantsWithStats;
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ status, blocked_at: status === 'blocked' ? new Date().toISOString() : null })
        .eq("id", id);
      
      if (error) throw error;
      
      // Log action
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("audit_logs").insert({
          admin_id: user.id,
          target_id: id,
          action: status === 'blocked' ? 'block_tenant' : 'reactivate_tenant',
          details: { status }
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
      toast.success("Status atualizado com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar status: " + error.message);
    }
  });

  const impersonate = async (tenantId: string) => {
    sessionStorage.setItem("impersonated_tenant_id", tenantId);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("audit_logs").insert({
        admin_id: user.id,
        target_id: tenantId,
        action: 'impersonate',
        details: { impersonated_at: new Date().toISOString() }
      });
    }

    toast.success("Entrando como barbearia...");
    navigate({ to: "/dashboard" });
  };

  const filteredTenants = tenants?.filter(t => 
    t.business_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.whatsapp_number?.includes(search)
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tight text-white italic">GESTOR DE BARBEARIAS</h2>
          <p className="text-gray-400 font-medium">Controle total sobre os parceiros da plataforma.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
            <Input 
              placeholder="Buscar barbearia..." 
              className="pl-12 h-12 bg-white/5 border-white/10 rounded-2xl focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon" className="h-12 w-12 rounded-2xl bg-white/5 border-white/10 hover:bg-white/10">
            <Filter className="h-5 w-5 text-gray-400" />
          </Button>
        </div>
      </div>

      <Card className="glass border-white/5 rounded-[2.5rem] overflow-hidden shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-gray-400 font-bold uppercase tracking-widest text-[10px] py-6 pl-8">Barbearia</TableHead>
                <TableHead className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Status</TableHead>
                <TableHead className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Plano</TableHead>
                <TableHead className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Métricas</TableHead>
                <TableHead className="text-right text-gray-400 font-bold uppercase tracking-widest text-[10px] pr-8">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-white/5">
                    <TableCell className="pl-8"><Skeleton className="h-10 w-40 bg-white/5 rounded-xl" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 bg-white/5 rounded-lg" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 bg-white/5 rounded-lg" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-32 bg-white/5 rounded-lg" /></TableCell>
                    <TableCell className="pr-8"><Skeleton className="h-8 w-8 bg-white/5 rounded-lg ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredTenants?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20 text-gray-500 italic">
                    Nenhuma barbearia encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTenants?.map((tenant) => (
                  <TableRow key={tenant.id} className="border-white/5 hover:bg-white/5 transition-colors group">
                    <TableCell className="py-6 pl-8">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-white/5">
                          <Building2 className="w-5 h-5 text-purple-400" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-white group-hover:text-purple-400 transition-colors">{tenant.business_name || "Sem nome"}</span>
                          <span className="text-xs text-gray-500 font-medium">{tenant.whatsapp_number || "Sem WhatsApp"}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "rounded-lg px-2 py-0.5 text-[10px] border-none font-bold uppercase tracking-tighter",
                        tenant.status === 'blocked' 
                          ? "bg-rose-500/20 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.2)]" 
                          : "bg-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                      )}>
                        {tenant.status === 'blocked' ? 'Bloqueado' : 'Ativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="rounded-lg px-2 py-0.5 text-[10px] border-white/10 bg-white/5 text-purple-400 font-bold uppercase italic">
                        {tenant.plan || 'Free'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-gray-500 font-bold uppercase">Clientes</span>
                          <span className="text-sm font-bold text-white">{tenant.stats.customers}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-gray-500 font-bold uppercase">Receita</span>
                          <span className="text-sm font-bold text-emerald-400">R$ {tenant.stats.revenue.toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="hover:bg-purple-500/20 hover:text-purple-400 rounded-xl transition-all">
                            <MoreVertical className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64 glass border-white/10 rounded-2xl p-2 text-white">
                          <DropdownMenuLabel className="text-gray-400 text-[10px] uppercase font-bold tracking-widest px-3 py-2">Comandos do Sistema</DropdownMenuLabel>
                          <DropdownMenuItem className="rounded-xl focus:bg-white/10 cursor-pointer transition-all" onClick={() => impersonate(tenant.id)}>
                            <ExternalLink className="mr-3 h-4 w-4 text-purple-400" />
                            <span className="font-medium">Modo Visualização</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/5 my-2" />
                          <DropdownMenuItem className="rounded-xl focus:bg-white/10 cursor-pointer transition-all" onClick={() => navigate({ to: `/admin/plans` })}>
                            <CreditCard className="mr-3 h-4 w-4 text-blue-400" />
                            <span className="font-medium">Gestão de Plano</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/5 my-2" />
                          {tenant.status === 'blocked' ? (
                            <DropdownMenuItem 
                              className="rounded-xl focus:bg-emerald-500/20 text-emerald-400 cursor-pointer transition-all"
                              onClick={() => updateStatusMutation.mutate({ id: tenant.id, status: 'active' })}
                            >
                              <Unlock className="mr-3 h-4 w-4" />
                              <span className="font-bold">Desbloquear</span>
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem 
                              className="rounded-xl focus:bg-rose-500/20 text-rose-400 cursor-pointer transition-all"
                              onClick={() => {
                                if (confirm(`BLOQUEAR ACESSO: ${tenant.business_name}?`)) {
                                  updateStatusMutation.mutate({ id: tenant.id, status: 'blocked' });
                                }
                              }}
                            >
                              <Ban className="mr-3 h-4 w-4" />
                              <span className="font-bold">Suspender</span>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <div className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-6 flex gap-4 backdrop-blur-md">
        <AlertTriangle className="text-rose-400 shrink-0 w-6 h-6" />
        <div className="space-y-1">
          <p className="text-sm font-bold text-white uppercase tracking-tight">Protocolo de Segurança</p>
          <p className="text-xs text-gray-400 leading-relaxed font-medium">
            A suspensão de um tenant bloqueia imediatamente o acesso de todos os profissionais e clientes vinculados. Os dados financeiros e históricos permanecem criptografados e preservados no cluster.
          </p>
        </div>
      </div>
    </div>
  );
}
