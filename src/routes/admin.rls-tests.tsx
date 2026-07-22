import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, Loader2, PlayCircle } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/rls-tests")({
  component: AdminRlsTests,
  head: () => ({
    meta: [
      { title: "Testes de RLS · Módulos Pagos — Barbex Admin" },
      { name: "description", content: "Diagnóstico automatizado das políticas RLS de módulos premium." },
    ],
  }),
});

type Row = {
  table_name: string;
  operation: string;
  expected: string;
  actual: string;
  passed: boolean;
};

function AdminRlsTests() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [running, setRunning] = useState(false);

  const runTests = async () => {
    setRunning(true);
    setRows(null);
    const { data, error } = await supabase.rpc("test_rls_module_guards");
    setRunning(false);
    if (error) {
      toast.error("Falha ao executar", { description: error.message });
      return;
    }
    setRows((data ?? []) as Row[]);
    const passed = (data ?? []).filter((r: Row) => r.passed).length;
    const total = (data ?? []).length;
    if (passed === total) toast.success(`✅ ${passed}/${total} tabelas protegidas`);
    else toast.warning(`⚠️ ${passed}/${total} passaram — revise falhas`);
  };

  const passedCount = rows?.filter((r) => r.passed).length ?? 0;
  const total = rows?.length ?? 0;
  const allPassed = rows && passedCount === total;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Testes de RLS — Módulos Pagos
              </CardTitle>
              <CardDescription>
                Simula um usuário autenticado sem plano ou add-on e tenta inserir em cada tabela premium.
                Todas devem ser bloqueadas pelas políticas RESTRICTIVE.
              </CardDescription>
            </div>
            <Button onClick={runTests} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />}
              {running ? "Executando..." : "Executar testes"}
            </Button>
          </div>
        </CardHeader>
        {rows && (
          <CardContent>
            <div className={`mb-4 p-3 rounded-lg border ${allPassed ? "bg-green-500/10 border-green-500/30" : "bg-orange-500/10 border-orange-500/30"}`}>
              <div className="flex items-center gap-2 font-semibold">
                {allPassed ? <ShieldCheck className="h-5 w-5 text-green-500" /> : <ShieldAlert className="h-5 w-5 text-orange-500" />}
                {passedCount} / {total} tabelas protegidas corretamente
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tabela</TableHead>
                  <TableHead>Operação</TableHead>
                  <TableHead>Esperado</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.table_name}>
                    <TableCell className="font-mono text-xs">{r.table_name}</TableCell>
                    <TableCell>{r.operation}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.expected}</TableCell>
                    <TableCell className="text-xs max-w-md truncate" title={r.actual}>{r.actual}</TableCell>
                    <TableCell className="text-right">
                      {r.passed ? (
                        <Badge className="bg-green-500/20 text-green-500 border-green-500/30">PASS</Badge>
                      ) : (
                        <Badge className="bg-red-500/20 text-red-500 border-red-500/30">FAIL</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
