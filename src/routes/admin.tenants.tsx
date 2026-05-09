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
  CreditCard
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select(`
          id, 
          business_name, 
          plan, 
          status, 
          created_at, 
          role,
          whatsapp_number
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!profiles) return [];

      // Filter out super admins
      const onlyTenants = profiles.filter(p => p.role !== 'super_admin');

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
          .eq("status", "concluded");

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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Gestão de Barbearias</h2>
          <p className="text-muted-foreground">Visualize e gerencie todos os clientes da plataforma.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome ou WhatsApp..." 
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Barbearia</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead>Métricas</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-5 w-32 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-5 w-20 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-5 w-16 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-5 w-24 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-5 w-40 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell className="text-right"><div className="h-8 w-8 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredTenants?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground italic">
                    Nenhuma barbearia encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTenants?.map((tenant) => (
                  <TableRow key={tenant.id} className="group">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground">{tenant.business_name || "Sem nome"}</span>
                        <span className="text-xs text-muted-foreground">{tenant.whatsapp_number || "Sem WhatsApp"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={tenant.status === 'blocked' ? 'destructive' : 'default'} className="capitalize">
                        {tenant.status === 'blocked' ? 'Bloqueado' : tenant.status || 'Ativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize bg-primary/5 text-primary border-primary/20">
                        {tenant.plan || 'Free'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(tenant.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1" title="Clientes">
                          <Users size={12} className="text-blue-500" />
                          {tenant.stats.customers}
                        </div>
                        <div className="flex items-center gap-1" title="Barbeiros">
                          <CalendarDays size={12} className="text-green-500" />
                          {tenant.stats.barbers}
                        </div>
                        <div className="flex items-center gap-1" title="Faturamento total">
                          <DollarSign size={12} className="text-amber-500" />
                          R$ {tenant.stats.revenue.toLocaleString('pt-BR')}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>Ações Administrativas</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => impersonate(tenant.id)}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Entrar como barbearia
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => navigate({ to: `/admin/plans` })}>
                            <CreditCard className="mr-2 h-4 w-4" />
                            Alterar Plano
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.info("Funcionalidade em desenvolvimento")}>
                            <KeyRound className="mr-2 h-4 w-4" />
                            Resetar Senha
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate({ to: `/admin/analytics` })}>
                            <History className="mr-2 h-4 w-4" />
                            Ver Histórico
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {tenant.status === 'blocked' ? (
                            <DropdownMenuItem 
                              className="text-green-600 focus:text-green-600"
                              onClick={() => updateStatusMutation.mutate({ id: tenant.id, status: 'active' })}
                            >
                              <Unlock className="mr-2 h-4 w-4" />
                              Desbloquear Acesso
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                if (confirm(`Tem certeza que deseja bloquear o acesso de ${tenant.business_name}?`)) {
                                  updateStatusMutation.mutate({ id: tenant.id, status: 'blocked' });
                                }
                              }}
                            >
                              <Ban className="mr-2 h-4 w-4" />
                              Bloquear Tenant
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
      
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
        <AlertTriangle className="text-amber-500 shrink-0" />
        <p className="text-sm text-amber-800">
          <strong>Atenção:</strong> Bloquear um tenant impedirá que qualquer usuário associado a essa barbearia acesse o sistema. O faturamento e os dados permanecerão preservados.
        </p>
      </div>
    </div>
  );
}
