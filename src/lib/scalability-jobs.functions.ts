import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { bxLog, bxTrace } from "./observability";
import { bxLock } from "./scalability-resilience";

/**
 * Interface para Payload de Job
 */
export interface JobPayload {
  type: string;
  data: any;
  metadata?: Record<string, any>;
}

/**
 * Agendamento de Background Job
 */
export const enqueueJob = createServerFn({ method: "POST" })
  .input(z.object({
    tenant_id: z.string().uuid(),
    queue_name: z.string().default("default"),
    payload: z.any(),
    priority: z.number().default(0),
    next_run_at: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    return bxTrace(`enqueue_job:${data.queue_name}`, async () => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      
      const { data: job, error } = await supabaseAdmin
        .from("background_jobs")
        .insert({
          tenant_id: data.tenant_id,
          queue_name: data.queue_name,
          payload: data.payload,
          priority: data.priority,
          next_run_at: data.next_run_at || new Date().toISOString(),
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        bxLog("error", `Failed to enqueue job: ${error.message}`, { error });
        throw new Error("Erro ao agendar tarefa em background.");
      }

      bxLog("info", `Job enqueued: ${job.id}`, { metadata: { jobId: job.id, queue: data.queue_name } });
      return job;
    });
  });

/**
 * Processamento de Job (Simulação do Worker)
 * Na prática, isso seria chamado por um Edge Function (Cron) ou via Webhook.
 */
export const processNextJob = createServerFn({ method: "POST" })
  .handler(async () => {
    return bxTrace("process_next_job", async () => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const anySupabase = supabaseAdmin as any;

      // 1. Buscar próximo job disponível com Lock Otimista (bxLock)
      return await bxLock("worker:process_next", async () => {
        const { data: job, error: fetchError } = await anySupabase
          .from("background_jobs")
          .select("*")
          .eq("status", "pending")
          .lte("next_run_at", new Date().toISOString())
          .order("priority", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (fetchError || !job) return { status: "no_jobs" };

        // 2. Marcar como em processamento
        await anySupabase
          .from("background_jobs")
          .update({ status: "processing", updated_at: new Date().toISOString() })
          .eq("id", job.id);

        bxLog("info", `Processing job ${job.id}`, { metadata: { jobId: job.id } });

        // 3. Execução (Mock de lógica de despacho)
        // Aqui entraria a lógica de roteamento baseada no payload.type
        try {
          // Simulando sucesso
          await anySupabase
            .from("background_jobs")
            .update({ 
              status: "completed", 
              completed_at: new Date().toISOString() 
            })
            .eq("id", job.id);
            
          return { status: "success", jobId: job.id };
        } catch (e: any) {
          bxLog("error", `Job execution failed: ${e.message}`, { error: e, metadata: { jobId: job.id } });
          
          const newAttempts = (job.attempts || 0) + 1;
          const status = newAttempts >= (job.max_attempts || 3) ? "failed" : "retry";
          
          await anySupabase
            .from("background_jobs")
            .update({ 
              status,
              attempts: newAttempts,
              last_error: e.message,
              next_run_at: new Date(Date.now() + Math.pow(2, newAttempts) * 1000 * 60).toISOString() // Backoff exponencial
            })
            .eq("id", job.id);
            
          return { status, jobId: job.id, error: e.message };
        }
      });
    });
  });
