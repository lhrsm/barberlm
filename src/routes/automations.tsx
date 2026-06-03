import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/automations")({
  component: AutomationsComponent,
});

function AutomationsComponent() {
  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Motor de Automação</h1>
        
        <Tabs defaultValue="automations" className="space-y-4">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="automations">Automações</TabsTrigger>
            <TabsTrigger value="queue">Fila</TabsTrigger>
            <TabsTrigger value="conversations">Conversas</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="tests">Testes</TabsTrigger>
            <TabsTrigger value="integrations">Integrações</TabsTrigger>
          </TabsList>
          
          <TabsContent value="automations" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Automações</CardTitle></CardHeader>
              <CardContent>Em breve: Painel de gerenciamento de fluxos.</CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="queue" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Fila de Processamento</CardTitle></CardHeader>
              <CardContent>Em breve: Status da fila.</CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="conversations" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Sessões de Conversa</CardTitle></CardHeader>
              <CardContent>Em breve: Sessões ativas.</CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Logs Detalhados</CardTitle></CardHeader>
              <CardContent>Em breve: Histórico de execuções.</CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="webhooks" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Debug de Webhooks</CardTitle></CardHeader>
              <CardContent>Em breve: Inspeção de carga recebida.</CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tests" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Testes</CardTitle></CardHeader>
              <CardContent>Em breve: Simulação de eventos.</CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Provedores de Mensagem</CardTitle></CardHeader>
              <CardContent>Em breve: Integrações ativas.</CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
