import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const getAdmin = async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
};

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

function applyFilters(query: any, filters: Filter[]) {
  let q = query;
  filters.forEach((f: Filter) => {
    if (f.op === "eq") q = q.eq(f.field, f.value);
    else if (f.op === "neq") q = q.neq(f.field, f.value);
    else if (f.op === "gt") q = q.gt(f.field, f.value);
    else if (f.op === "gte") q = q.gte(f.field, f.value);
    else if (f.op === "lt") q = q.lt(f.field, f.value);
    else if (f.op === "lte") q = q.lte(f.field, f.value);
    else if (f.op === "like") q = q.ilike(f.field, `%${f.value}%`);
    else if (f.op === "in") q = q.in(f.field, Array.isArray(f.value) ? f.value : [f.value]);
  });
  return q;
}

export const getAudienceCount = createServerFn({ method: "POST" })
  .inputValidator((data: AudienceQuery) => AudienceQuerySchema.parse(data))
  .handler(async ({ data }) => {
    const { tenantId, filters, logic } = data;
    const admin = await getAdmin();
    let query = admin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("whatsapp_marketing_consent", true);

    if (logic === "AND") {
      query = applyFilters(query, filters);
    }

    const { count, error } = await query;
    if (error) throw new Error(error.message);
    return { count: count || 0 };
  });

export const getAudienceCustomers = createServerFn({ method: "POST" })
  .inputValidator((data: AudienceQuery) => AudienceQuerySchema.parse(data))
  .handler(async ({ data }) => {
    const { tenantId, filters, logic, limit, offset } = data;
    const admin = await getAdmin();
    let query = admin
      .from("customers")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("whatsapp_marketing_consent", true)
      .range(offset, offset + limit - 1);

    if (logic === "AND") {
      query = applyFilters(query, filters);
    }

    const { data: customers, error } = await query;
    if (error) throw new Error(error.message);
    return { customers: customers || [] };
  });

export const scheduleCampaignDispatch = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    tenantId: z.string(),
    campaignId: z.string(),
    filters: z.array(z.any()),
    logic: z.string(),
    message: z.string()
  }).parse(data))
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    const { data: job, error } = await admin
      .from("background_jobs")
      .insert({
        tenant_id: data.tenantId,
        type: "marketing_campaign_dispatch",
        payload: {
          campaign_id: data.campaignId,
          filters: data.filters,
          logic: data.logic,
          message: data.message
        },
        priority: 5
      } as any)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { jobId: job.id };
  });
