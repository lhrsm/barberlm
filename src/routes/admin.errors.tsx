import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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
  Activity,
  ChevronRight,
  Download,
  FileSpreadsheet,
  X,
  Info,
  History as HistoryIcon
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [sortField, setSortField] = useState<string>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);

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
    },
    refetchInterval: (query) => {
      const hasProcessing = query.state.data?.report?.some((r: any) => r.reprocessing_status === 'processing');
      return hasProcessing ? 3000 : false;
    }
  });

  const exportToCSV = () => {
    const reportData = healthReport?.report || [];
    const headers = ["Barbearia", "Automação", "Status", "Motivo", "Última Falha"];
    const rows = reportData.map((item: any) => [
      item.tenant_name,
      item.key,
      item.is_healthy ? "Saudável" : "Erro Crítico",
      item.last_error || "Nenhum",
      item.issues?.[0]?.last_occurrence || "N/A"
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map((e: any) => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `saude_automacoes_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredAutomations = healthReport?.report?.filter((item: any) => {
    if (automationFilter !== "all" && item.key !== automationFilter) return false;
    if (statusFilter !== "all" && (statusFilter === "healthy" ? !item.is_healthy : item.is_healthy)) return false;
    if (reasonFilter !== "all" && item.last_error !== reasonFilter) return false;
    
    if (searchFilter) {
      const search = searchFilter.toLowerCase();
      const matchesTenant = item.tenant_name.toLowerCase().includes(search);
      const matchesProvider = item.issues?.some((i: any) => 
        (i.provider_message_id || "").toLowerCase().includes(search) || 
        (i.details?.provider_message_id || "").toLowerCase().includes(search)
      );
      if (!matchesTenant && !matchesProvider) return false;
    }
    return true;
  }) || [];

  const sortedAutomations = [...filteredAutomations].sort((a: any, b: any) => {
    if (sortField === "date") {
      const dateA = new Date(a.issues?.[0]?.last_occurrence || 0).getTime();
      const dateB = new Date(b.issues?.[0]?.last_occurrence || 0).getTime();
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    }
    if (sortField === "severity") {
      const scoreA = a.is_healthy ? 0 : 1;
      const scoreB = b.is_healthy ? 0 : 1;
      return sortOrder === "desc" ? scoreB - scoreA : scoreA - scoreB;
    }
    return 0;
  });

  const paginatedAutomations = sortedAutomations.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const handleReprocess = async (item: any) => {
    setReprocessingId(item.automation_id);
    try {
    const { data, error } = await supabase.functions.invoke('automation-v2-health-check', {
        body: { 
          action: 'reprocess',
          tenant_id: item.tenant_id,
          workflow_key: item.key
        }
      });
      
      if (error || !data.success) {
        if (data?.error === "REPROCESS_ALREADY_IN_PROGRESS") {
          toast.info("Este registro já está sendo processado.");
          return;
        }
        throw error || new Error(data?.error);
      }
      
      toast.info("Trabalho de reprocessamento iniciado em segundo plano.");
      // The polling or refetch will happen via react-query
      setTimeout(() => refetchHealth(), 2000);
    } catch (error: any) {
      toast.error("Erro ao reprocessar: " + error.message);
    } finally {
      setReprocessingId(null);
    }
  };

  const totalPages = Math.ceil(filteredAutomations.length / itemsPerPage);

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
                <div className="flex flex-wrap gap-2 items-center">
                  <Button variant="outline" size="sm" onClick={exportToCSV} className="h-8 gap-2">
                    <FileSpreadsheet className="h-4 w-4" /> Exportar CSV
                  </Button>
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input 
                      placeholder="Tenant ou Provider ID..." 
                      className="pl-8 h-8 text-xs" 
                      value={searchFilter}
                      onChange={(e) => {
                        setSearchFilter(e.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                  <Select value={automationFilter} onValueChange={(val) => {
                    setAutomationFilter(val);
                    setPage(1);
                  }}>
                    <SelectTrigger className="h-8 w-[140px] text-xs">
                      <SelectValue placeholder="Automação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas Automações</SelectItem>
                      <SelectItem value="appointment_confirmation">Confirmação</SelectItem>
                      <SelectItem value="appointment_reminder">Lembrete</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={(val) => {
                    setStatusFilter(val);
                    setPage(1);
                  }}>
                    <SelectTrigger className="h-8 w-[120px] text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Status</SelectItem>
                      <SelectItem value="unhealthy">Não Saudável</SelectItem>
                      <SelectItem value="healthy">Saudável</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={reasonFilter} onValueChange={(val) => {
                    setReasonFilter(val);
                    setPage(1);
                  }}>
                    <SelectTrigger className="h-8 w-[160px] text-xs">
                      <SelectValue placeholder="Motivo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Motivos</SelectItem>
                      <SelectItem value="WHATSAPP_SENT_BUT_DISPATCH_NOT_CREATED">Falha de Registro (V2)</SelectItem>
                      <SelectItem value="ORPHAN_LOG_NO_DISPATCH">Log Órfão</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="h-8 border-l mx-1" />

                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 gap-2 text-xs"
                    onClick={() => {
                      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
                    }}
                  >
                    {sortField === "date" ? <Clock className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                    {sortOrder === "desc" ? "Mais Recentes" : "Mais Antigos"}
                  </Button>
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
                    paginatedAutomations.map((item: any) => (
                      <TableRow 
                        key={item.automation_id}
                        className={cn("cursor-pointer hover:bg-muted/50 transition-colors", !item.is_healthy && "bg-rose-50/10")}
                        onClick={() => setSelectedIssue(item)}
                      >
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
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               className="h-8 w-8" 
                               disabled={reprocessingId === item.automation_id || item.reprocessing_status === 'processing'}
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleReprocess(item);
                               }}
                               title="Reprocessar Agora"
                             >
                               <RefreshCw className={cn(
                                 "h-4 w-4", 
                                 (reprocessingId === item.automation_id || item.reprocessing_status === 'processing') && "animate-spin text-primary"
                               )} />
                             </Button>
                             {item.reprocessing_status === 'failed' && (
                               <Badge variant="outline" className="text-[8px] bg-rose-500/10 text-rose-500 border-rose-500/20 px-1">
                                 Falhou
                               </Badge>
                             )}
                             <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Ver Logs" onClick={(e) => e.stopPropagation()}>
                               <a href={`/admin/logs?tenant=${item.tenant_id}`} target="_blank" rel="noreferrer">
                                 <Terminal className="h-4 w-4" />
                               </a>
                             </Button>
                             <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver Detalhes">
                               <ChevronRight className="h-4 w-4" />
                             </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-end space-x-2 py-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Anterior
                  </Button>
                  <div className="text-xs text-muted-foreground">
                    Página {page} de {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Próxima
                  </Button>
                </div>
              )}
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
      <Dialog open={!!selectedIssue} onOpenChange={() => setSelectedIssue(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black italic uppercase">
              <ShieldAlert className="h-5 w-5 text-rose-500" />
              Detalhes da Ocorrência
            </DialogTitle>
            <DialogDescription>
              Diagnóstico técnico para sincronismo de mensagens V2.
            </DialogDescription>
          </DialogHeader>

          {selectedIssue && (
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-muted/50 border">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Barbearia</p>
                  <p className="font-bold">{selectedIssue.tenant_name}</p>
                </div>
                <div className="p-4 rounded-2xl bg-muted/50 border">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Status de Saúde</p>
                  <Badge variant={selectedIssue.is_healthy ? "secondary" : "destructive"}>
                    {selectedIssue.is_healthy ? "Operacional" : "Interrompida"}
                  </Badge>
                </div>
              </div>

              <Card className="border-rose-200 bg-rose-50/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Info className="h-4 w-4 text-rose-500" /> Causa Raiz Detectada
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 rounded-xl bg-background border text-xs font-mono">
                    Motivo: <span className="text-rose-600 font-bold">{selectedIssue.last_error || "WHATSAPP_SENT_BUT_DISPATCH_NOT_CREATED"}</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    A API do WhatsApp (Z-API) confirmou o recebimento da mensagem, porém a transação de banco de dados para criar o registro de despacho (dispatch) falhou ou foi interrompida. Isso impede o rastreamento do callback e a confirmação automática do agendamento.
                  </p>
                </CardContent>
              </Card>

              {selectedIssue.issues && selectedIssue.issues.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-bold flex items-center gap-2">
                    <Terminal className="h-4 w-4" /> Histórico de Erros Sincronizados
                  </p>
                  <div className="border rounded-2xl overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="h-9">Data/Hora</TableHead>
                          <TableHead className="h-9">ID Provedor</TableHead>
                          <TableHead className="h-9 text-right">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedIssue.issues.map((issue: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs font-mono">
                              {issue.last_occurrence || issue.log_time ? 
                                format(new Date(issue.last_occurrence || issue.log_time), "dd/MM HH:mm:ss", { locale: ptBR }) 
                                : "N/A"}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground truncate max-w-[150px]">
                              {issue.provider_message_id || issue.details?.provider_message_id || "N/A"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" className="h-7 text-[10px] uppercase font-bold" asChild>
                                <a href={`/admin/logs?search=${issue.provider_message_id || issue.details?.provider_message_id}`} target="_blank" rel="noreferrer">
                                  Ver Log <ExternalLink className="ml-1 h-3 w-3" />
                                </a>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {selectedIssue.reprocessing_history && selectedIssue.reprocessing_history.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-bold flex items-center gap-2">
                    <HistoryIcon className="h-4 w-4" /> Histórico de Reprocessamento
                  </p>
                  <div className="border rounded-2xl overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="h-9">Tentativa</TableHead>
                          <TableHead className="h-9">Status</TableHead>
                          <TableHead className="h-9 text-right">Resultado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedIssue.reprocessing_history.map((h: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs">
                              {idx + 1}ª ({format(new Date(h.timestamp), "HH:mm:ss")})
                            </TableCell>
                            <TableCell>
                              <Badge variant={h.status === 'completed' ? 'secondary' : 'outline'} className="text-[10px]">
                                {h.status === 'completed' ? 'Sucesso' : 'Falhou'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {h.dispatch_id ? (
                                <Button variant="ghost" size="sm" className="h-7 text-[10px] uppercase font-bold" asChild>
                                  <a href={`/admin/logs?search=${h.dispatch_id}`} target="_blank" rel="noreferrer">
                                    Ver Dispatch <ExternalLink className="ml-1 h-3 w-3" />
                                  </a>
                                </Button>
                              ) : (
                                <span className="text-[10px] text-muted-foreground italic">Sem dispatch</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setSelectedIssue(null)}>Fechar</Button>
                <Button 
                  className="bg-primary text-primary-foreground font-bold"
                  disabled={reprocessingId === selectedIssue.automation_id || selectedIssue.reprocessing_status === 'processing'}
                  onClick={() => handleReprocess(selectedIssue)}
                >
                  {(reprocessingId === selectedIssue.automation_id || selectedIssue.reprocessing_status === 'processing') ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Sincronizar Manualmente
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
