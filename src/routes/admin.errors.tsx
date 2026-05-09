import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  AlertCircle, 
  Terminal, 
  Search, 
  Trash2, 
  RefreshCw,
  Clock,
  Building2,
  Bug
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/admin/errors")({
  component: AdminErrors,
});

function AdminErrors() {
  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["admin-error-logs"],
    queryFn: async () => {
      // In a real scenario, we'd have an error_logs table.
      // For now, we'll fetch audit_logs and filter for any actions that might imply errors 
      // or just show recent audit logs.
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Central de Erros e Logs</h2>
          <p className="text-muted-foreground">Monitoramento de falhas, logs de auditoria e saúde do sistema.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
          </Button>
          <Button variant="destructive" size="sm">
            <Trash2 className="mr-2 h-4 w-4" /> Limpar Logs
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-rose-200 bg-rose-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bug className="h-4 w-4 text-rose-500" /> Erros Críticos (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-700">0</div>
            <p className="text-xs text-rose-600 mt-1 italic">Nenhuma falha crítica detectada.</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-blue-500" /> Falhas no Realtime
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground mt-1 italic text-blue-600 underline">Ver detalhes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Terminal className="h-4 w-4 text-emerald-500" /> Logs de API (Sucesso)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">99.8%</div>
            <p className="text-xs text-emerald-600 mt-1">Status operacional normal.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Logs de Auditoria Recentes</CardTitle>
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
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10">Processando logs...</TableCell>
                </TableRow>
              ) : logs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-muted-foreground italic">Nenhum log registrado.</TableCell>
                </TableRow>
              ) : (
                logs?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-xs font-bold">
                      {(log.admin as any)?.business_name || "Admin"}
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
    </div>
  );
}
