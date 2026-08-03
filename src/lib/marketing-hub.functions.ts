import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FilterSchema = z.object({
  field: z.string(),
  op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "like", "in"]),
  value: z.any(),
});

type Filter = z.infer<typeof FilterSchema>;

const AudienceQuerySchema = z.object({
  tenantId: z.string(),
  filters: z.array(FilterSchema),
  logic: z.enum(["AND", "OR"]).default("AND"),
  limit: z.number().optional().default(100),
  offset: z.number().optional().default(0),
});

type AudienceQuery = z.infer<typeof AudienceQuerySchema>;

export const getAudienceCount = createServerFn({ method: "POST" })
  .inputValidator((data: AudienceQuery) => AudienceQuerySchema.parse(data))
  .handler(async ({ data }) => {
    const { tenantId, filters, logic } = data;
    
    let query = supabaseAdmin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("whatsapp_marketing_consent", true); // Default LGPD protection

    if (logic === "AND") {
      filters.forEach((f: Filter) => {
        if (f.op === "eq") query = query.eq(f.field as any, f.value);
        if (f.op === "neq") query = query.neq(f.field as any, f.value);
        if (f.op === "gt") query = query.gt(f.field as any, f.value);
        if (f.op === "gte") query = query.gte(f.field as any, f.value);
        if (f.op === "lt") query = query.lt(f.field as any, f.value);
        if (f.op === "lte") query = query.lte(f.field as any, f.value);
        if (f.op === "like") query = query.ilike(f.field as any, `%${f.value}%`);
        if (f.op === "in") query = query.in(f.field as any, Array.isArray(f.value) ? f.value : [f.value]);
      });
    }

    const { count, error } = await query;
    if (error) throw new Error(error.message);
    
    return { count: count || 0 };
  });

export const getAudienceCustomers = createServerFn({ method: "POST" })
  .inputValidator((data: AudienceQuery) => AudienceQuerySchema.parse(data))
  .handler(async ({ data }) => {
    const { tenantId, filters, logic, limit, offset } = data;
    
    let query = supabaseAdmin
      .from("customers")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("whatsapp_marketing_consent", true)
      .range(offset, offset + limit - 1);

    if (logic === "AND") {
      filters.forEach((f: Filter) => {
        if (f.op === "eq") query = query.eq(f.field as any, f.value);
        if (f.op === "neq") query = query.neq(f.field as any, f.value);
        if (f.op === "gt") query = query.gt(f.field as any, f.value);
        if (f.op === "gte") query = query.gte(f.field as any, f.value);
        if (f.op === "lt") query = query.lt(f.field as any, f.value);
        if (f.op === "lte") query = query.lte(f.field as any, f.value);
        if (f.op === "like") query = query.ilike(f.field as any, `%${f.value}%`);
        if (f.op === "in") query = query.in(f.field as any, Array.isArray(f.value) ? f.value : [f.value]);
      });
    }

    const { data: customers, error } = await query;
    if (error) throw new Error(error.message);
    
    return { customers: customers || [] };
  });

/**
 * Agenda o disparo de uma campanha de marketing em background
 */
export const scheduleCampaignDispatch = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    tenantId: z.string(),
    campaignId: z.string(),
    filters: z.array(z.any()),
    logic: z.string(),
    message: z.string()
  }).parse(data))
  .handler(async ({ data }) => {
    const { enqueueJob } = await import("./scalability-jobs.functions");
    
    // Cria um job para o "Dispatcher" da campanha
    // Este job irá, por sua vez, fragmentar os envios individuais para não travar o worker
    const job = await (enqueueJob as any)({
      data: {
        tenant_id: data.tenantId,
        queue_name: "marketing",
        priority: 10,
        payload: {
          type: "MARKETING_CAMPAIGN_DISPATCH",
          campaignId: data.campaignId,
          filters: data.filters,
          logic: data.logic,
          message: data.message
        }
      }
    });

    return { success: true, jobId: job?.id };
  });
