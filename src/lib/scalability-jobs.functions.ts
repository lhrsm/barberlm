import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { bxLog, bxTrace } from "./observability";

const getAdmin = async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
};

const getLock = async () => {
  const { bxLock } = await import("./scalability-resilience");
  return bxLock;
};

const jobSchema = z.object({
  tenant_id: z.string().uuid(),
  queue_name: z.string().default("default"),
  payload: z.any(),
  priority: z.number().default(0),
  next_run_at: z.string().optional(),
});

/**
 * Agendamento de Background Job
 */
export const enqueueJob = createServerFn({ method: "POST" })
  .handler(async ({ data }: any) => {
    return bxTrace(`enqueue_job:${data?.queue_name || 'default'}`, async () => {
      const validated = jobSchema.parse(data);
      const admin = await getAdmin();
      
      const { data: job, error } = await admin
        .from("background_jobs")
        .insert({
          tenant_id: validated.tenant_id,
          queue_name: validated.queue_name,
          payload: validated.payload,
          priority: validated.priority,
          next_run_at: validated.next_run_at || new Date().toISOString(),
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        bxLog("error", `Failed to enqueue job: ${error.message}`, { error });
        throw new Error("Erro ao agendar tarefa em background.");
      }

      bxLog("info", `Job enqueued: ${job.id}`, { metadata: { jobId: job.id, queue: validated.queue_name } });
      return job;
    });
  });

/**
 * Processamento de Job
 */
export const processNextJob = createServerFn({ method: "POST" })
  .handler(async () => {
    return bxTrace("process_next_job", async () => {
      const admin = await getAdmin();
      const anySupabase = admin as any;
      const lock = await getLock();

      return await lock("worker:process_next", async () => {
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

        await anySupabase
          .from("background_jobs")
          .update({ status: "processing", updated_at: new Date().toISOString() })
          .eq("id", job.id);

        bxLog("info", `Processing job ${job.id}`, { metadata: { jobId: job.id } });

        try {
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
              next_run_at: new Date(Date.now() + Math.pow(2, newAttempts) * 1000 * 60).toISOString()
            })
            .eq("id", job.id);
            
          return { status, jobId: job.id, error: e.message };
        }
      });
    });
  });






