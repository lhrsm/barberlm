
import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useTenant } from "@/hooks/use-tenant";
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  MessageSquare, 
  Zap, 
  RefreshCw,
  Loader2,
  Play,
  Settings2,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  RotateCcw,
  ExternalLink,
  MessageCircle,
  AlertTriangle,
  SendHorizontal,
  Search,
  Filter,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Send,
  Smartphone,
  Check,
  CheckCheck,
  FileCode,
  Terminal,
  Activity,
  ArrowRight,
  X,
  Copy,
  ChevronDown,
  ChevronUp,
  Code2,
  Info,
  MousePointer2
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AutomationEditModal } from "@/components/admin/automations/AutomationEditModal";
import { AutomationTestModal } from "@/components/admin/automations/AutomationTestModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Casting to any to bypass type errors for new table
const anySupabase = supabase as any;

export const Route = createFileRoute("/automations")({
  component: AutomationsComponent,
});

function AutomationsComponent() {
  const { tenantId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [automations, setAutomations] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedAutomation, setSelectedAutomation] = useState<any>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isTestOpen, setIsTestOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [queueStats, setQueueStats] = useState({ pending: 0, sent: 0, failed: 0, lastRun: null });
  const [logStats, setLogStats] = useState({ sent: 0, success: 0, failed: 0, lastSent: null, duplicateBlocked: 0, notFound: 0, pendingCallbacks: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [lastManualUpdate, setLastManualUpdate] = useState<Date | null>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    if (tenantId) fetchData();
  }, [tenantId, currentPage, filterStatus, filterPeriod]);

  const fetchData = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      // 1. Fetch automations
      const { data: automationsData } = await anySupabase
        .from("automation_templates")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name");
      
      setAutomations(automationsData || []);

      // 2. Fetch queue stats
      const { data: qData } = await anySupabase.rpc('get_automation_queue_stats', { p_tenant_id: tenantId });
      if (qData) setQueueStats(qData);

      // 3. Fetch logs
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      let query = anySupabase.from("automation_v2_dispatches").select("*", { count: 'exact' }).eq("tenant_id", tenantId);
      
      if (filterStatus !== "all") query = query.eq("status", filterStatus);
      if (searchTerm) query = query.or(`phone.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%`);
      
      const { data: logsData, count } = await query.order("sent_at", { ascending: false }).range(from, to);
      setLogs(logsData || []);
      setTotalLogs(count || 0);

      // 4. Global stats
      const { count: totalSuccess } = await anySupabase.from("automation_v2_dispatches").select("*", { count: 'exact', head: true }).eq("tenant_id", tenantId).eq("status", "sent");
      const { count: totalFailed } = await anySupabase.from("automation_v2_dispatches").select("*", { count: 'exact', head: true }).eq("tenant_id", tenantId).eq("status", "error");
      setLogStats(prev => ({ ...prev, success: totalSuccess || 0, failed: totalFailed || 0 }));

    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const runQueueNow = async () => {
    setIsProcessingQueue(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-automation-queue', {
        body: { tenant_id: tenantId }
      });
      if (error) throw error;
      toast.success("Fila processada com sucesso!");
      fetchData();
    } catch (e: any) {
      toast.error("Erro ao processar fila: " + e.message);
    } finally {
      setIsProcessingQueue(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">Automações</h1>
          <Button onClick={runQueueNow} disabled={isProcessingQueue} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
            {isProcessingQueue ? <Loader2 className="animate-spin mr-2" /> : <Play className="mr-2" />} Processar Fila Agora
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-[#0F172A] border-white/5 p-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase">Fila Pendente</p>
            <p className="text-2xl font-black text-amber-500">{queueStats.pending}</p>
          </Card>
          <Card className="bg-[#0F172A] border-white/5 p-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase">Sucessos</p>
            <p className="text-2xl font-black text-emerald-500">{logStats.success}</p>
          </Card>
          <Card className="bg-[#0F172A] border-white/5 p-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase">Falhas</p>
            <p className="text-2xl font-black text-rose-500">{logStats.failed}</p>
          </Card>
          <Card className="bg-[#0F172A] border-white/5 p-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase">Última Execução</p>
            <p className="text-sm font-bold text-white">{queueStats.lastRun ? new Date(queueStats.lastRun).toLocaleString() : '---'}</p>
          </Card>
        </div>

        <Tabs defaultValue="automations">
          <TabsList className="bg-[#0F172A] border-white/5">
            <TabsTrigger value="automations">Configurações</TabsTrigger>
            <TabsTrigger value="logs">Histórico</TabsTrigger>
          </TabsList>
          
          <TabsContent value="automations" className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {automations.map(auto => (
                <Card key={auto.id} className="bg-[#0F172A] border-white/5 overflow-hidden">
                  <div className="p-6 border-b border-white/5 flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-black text-white uppercase tracking-tighter">{auto.name}</h3>
                      <Badge className={auto.active ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-500/10 text-slate-500"}>
                        {auto.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-6">
                    <p className="text-xs text-slate-400 line-clamp-3 italic mb-6">"{auto.template}"</p>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => { setSelectedAutomation(auto); setIsEditOpen(true); }}>
                        <Settings2 className="mr-2 h-4 w-4" /> Editar
                      </Button>
                      <Button className="flex-1 bg-amber-500 text-black hover:bg-amber-600" onClick={() => { setSelectedAutomation(auto); setIsTestOpen(true); }}>
                        <Play className="mr-2 h-4 w-4" /> Testar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="logs" className="pt-6">
             <Card className="bg-[#0F172A] border-white/5">
                <div className="p-4 border-b border-white/5 flex gap-4 overflow-x-auto">
                  <Input 
                    placeholder="Buscar destinatário..." 
                    className="max-w-xs" 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                  />
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="sent">Enviado</SelectItem>
                      <SelectItem value="error">Erro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/5 text-[10px] uppercase font-bold text-slate-500">
                        <th className="p-4">Data</th>
                        <th className="p-4">Cliente</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Mensagem</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {logs.map(log => (
                        <tr key={log.id} className="border-b border-white/5 text-slate-300">
                          <td className="p-4">{new Date(log.sent_at || log.created_at).toLocaleString()}</td>
                          <td className="p-4">
                            <p className="font-bold">{log.customer_name}</p>
                            <p className="text-xs text-slate-500">{log.phone}</p>
                          </td>
                          <td className="p-4">
                            <Badge className={log.status === 'sent' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}>
                              {log.status}
                            </Badge>
                          </td>
                          <td className="p-4 max-w-xs truncate">{log.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
             </Card>
          </TabsContent>
        </Tabs>

        {isEditOpen && selectedAutomation && (
          <AutomationEditModal 
            isOpen={isEditOpen} 
            onClose={() => setIsEditOpen(false)} 
            automation={selectedAutomation} 
            onSuccess={fetchData} 
          />
        )}
        
        {isTestOpen && selectedAutomation && (
          <AutomationTestModal 
            isOpen={isTestOpen} 
            onClose={() => setIsTestOpen(false)} 
            automation={selectedAutomation} 
          />
        )}
      </div>
    </AppLayout>
  );
}

export default AutomationsComponent;
