import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Play, Bug, Info } from "lucide-react";

export function AutomationDebugger() {
  const [loading, setLoading] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [result, setResult] = useState<any>(null);

  const simulateClick = async () => {
    if (!tenantId) {
      toast.error("Informe o Tenant ID");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      // 1. Get latest active session with group and multiple appointments
      const { data: session, error: sessionError } = await supabase
        .from("conversation_sessions")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .not("appointment_group_id", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessionError || !session) {
        throw new Error("Nenhuma sessão ativa com grupo encontrada para este tenant.");
      }

      // Safe access to JSON context
      const context = session.context as Record<string, any>;
      const appointmentsCount = context?.appointment_ids?.length || 0;
      
      toast.info(`Simulando clique para sessão ${session.id} (${appointmentsCount} agendamentos)`);

      const payload = {
        phone: session.phone,
        referenceMessageId: session.provider_message_id,
        buttonsResponseMessage: {
          buttonId: "main_confirm",
          message: "Confirmar agendamento"
        },
        type: "ReceivedCallback"
      };

      // Fixing headers/options for invoke
      const { data, error } = await supabase.functions.invoke("zapi-webhook", {
        body: payload,
        headers: {
          "x-tenant-id": tenantId // Some functions use headers, we'll also pass it as query param via full URL if needed
        }
      });

      // If invoke doesn't support queryParams directly in the options object, 
      // we might need to use a different approach, but let's try this first.
      
      if (error) throw error;
      
      setResult({
        session_id: session.id,
        appointments_count: appointmentsCount,
        payload_sent: payload,
        response: data
      });
      
      toast.success("Simulação concluída! Verifique os logs de automação.");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message);
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-white/10 bg-black/40 backdrop-blur-md overflow-hidden">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bug className="text-primary h-5 w-5" />
          <CardTitle>Depurador de Automação</CardTitle>
        </div>
        <CardDescription>
          Ferramentas práticas para diagnosticar o fluxo de agendamentos agrupados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Tenant ID</label>
          <div className="flex gap-2">
            <Input 
              placeholder="UUID do Tenant" 
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="bg-white/5 border-white/10"
            />
            <Button 
              onClick={simulateClick} 
              disabled={loading}
              className="gap-2"
            >
              {loading ? "Processando..." : (
                <>
                  <Play size={16} /> Simular clique main_confirm agrupado
                </>
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground italic">
            * Busca a última sessão ativa com múltiplos agendamentos e simula o clique no botão principal.
          </p>
        </div>

        {result && (
          <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded-lg overflow-auto max-h-[300px]">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase text-primary">
              <Info size={12} /> Resultado da Simulação
            </div>
            <pre className="text-[10px] font-mono text-gray-300">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
