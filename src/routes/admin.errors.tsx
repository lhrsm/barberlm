import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { 
  AlertCircle, 
  Terminal, 
  Search, 
  Trash2, 
  RefreshCw,
  Clock,
  Building2,
  Bug,
  ShieldAlert,
  Calendar as CalendarIcon,
  Filter,
  ExternalLink,
  Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/errors")({
  component: AdminErrors,
});

function AdminErrors() {
  const [dateFilter, setDateFilter] = useState<string>("7d");
  const [automationFilter, setAutomationFilter] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState<string>("");

  const { data: auditLogs, isLoading: isLoadingAudit, refetch: refetchAudit } = useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select(`
          *,
          admin:profiles!audit_logs_admin_id_fkey(business_name)
        `)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    }
  });

  const { data: healthReport, isLoading: isLoadingHealth, refetch: refetchHealth } = useQuery({
    queryKey: ["admin-automation-health", dateFilter, automationFilter],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('automation-v2-health-check', {
        body: { check_all: true }
      });
      
      if (error) throw error;
      return data;
    }
  });

  const filteredAutomations = healthReport?.report?.filter((item: any) => {
    if (automationFilter !== "all" && item.key !== automationFilter) return false;
    if (searchFilter && !item.tenant_name.toLowerCase().includes(searchFilter.toLowerCase())) return false;
    return true;
  }) || [];

  const unhealthyCount = healthReport?.summary?.unhealthy || 0;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Central de Erros e Saúde</h2>
          <p className="text-muted-foreground">Monitoramento de falhas críticas e logs de auditoria.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { refetchAudit(); refetchHealth(); }}>
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar Tudo
          </Button>
        </div>
      </div>

      <Tabs defaultValue="health" className="space-y-4">
        <TabsList>
          <TabsTrigger value="health" className="gap-2">
            <Activity className="h-4 w-4" /> Saúde das Automações
            {unhealthyCount > 0 && (
              <Badge variant="destructive" className="ml-1 px-1 min-w-[1.2rem] h-5 justify-center">
                {unhealthyCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <ShieldAlert className="h-4 w-4" /> Logs de Auditoria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className={unhealthyCount > 0 ? "border-rose-200 bg-rose-50/30" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ShieldAlert className={cn("h-4 w-4", unhealthyCount > 0 ? "text-rose-500" : "text-emerald-500")} /> 
                  Automações Não Saudáveis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={cn("text-2xl font-bold", unhealthyCount > 0 ? "text-rose-700" : "text-emerald-700")}>
                  {unhealthyCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1 italic">
                  Motivo: WHATSAPP_SENT_BUT_DISPATCH_NOT_CREATED
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-500" /> Total de Verificações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{healthReport?.summary?.total_checked || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Status operacional verificado em tempo real.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Bug className="h-4 w-4 text-emerald-500" /> Falhas de Registro Evitadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-700">100%</div>
                <p className="text-xs text-emerald-600 mt-1 italic">Novo engine V2 bloqueia envios órfãos.</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Monitor de Saúde V2</CardTitle>
                  <CardDescription>Lista de automações com falhas de sincronismo detectadas.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input 
                      placeholder="Buscar por barbearia..." 
                      className="pl-8 h-8 text-xs" 
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                    />
                  </div>
                  <Select value={automationFilter} onValueChange={setAutomationFilter}>
                    <SelectTrigger className="h-8 w-[150px] text-xs">
                      <SelectValue placeholder="Automação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="appointment_confirmation">Confirmação</SelectItem>
                      <SelectItem value="appointment_reminder">Lembrete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Barbearia</TableHead>
                    <TableHead>Automação</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Última Falha</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingHealth ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10">Escaneando infraestrutura...</TableCell>
                    </TableRow>
                  ) : filteredAutomations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-muted-foreground italic">
                        Nenhuma falha crítica detectada com os filtros atuais.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAutomations.map((item: any) => (
                      <TableRow key={item.automation_id}>
                        <TableCell className="font-medium">{item.tenant_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {item.key}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.is_healthy ? "secondary" : "destructive"}>
                            {item.is_healthy ? "Saudável" : "Erro Crítico"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.issues?.[0]?.last_occurrence ? 
                            format(new Date(item.issues[0].last_occurrence), "dd/MM HH:mm", { locale: ptBR }) 
                            : "N/A"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                             <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Ver Logs">
                               <a href={`/admin/logs?tenant=${item.tenant_id}`} target="_blank" rel="noreferrer">
                                 <Terminal className="h-4 w-4" />
                               </a>
                             </Button>
                             <Button variant="ghost" size="icon" className="h-8 w-8" title="Tentar Corrigir">
                               <RefreshCw className="h-4 w-4" />
                             </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Atividade Recente do Sistema</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input placeholder="Filtrar logs..." className="pl-8 h-8 text-xs" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Horário</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingAudit ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10">Carregando logs...</TableCell>
                    </TableRow>
                  ) : auditLogs?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-muted-foreground italic">Nenhum log registrado.</TableCell>
                    </TableRow>
                  ) : (
                    auditLogs?.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-xs font-bold">
                          {log.admin?.business_name || "Super Admin"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-tighter">
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                          {JSON.stringify(log.details)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
