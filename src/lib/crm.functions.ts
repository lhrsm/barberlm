import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getCrmData = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ tenant_id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { tenant_id } = data;
    const { supabase } = await import("@/integrations/supabase/client");
    
    const [customers, subscriptions] = await Promise.all([
      supabase.from("customers").select("*").eq("tenant_id", tenant_id).order("name"),
      supabase.from("customer_subscriptions").select("*, subscription_plans(*)").eq("tenant_id", tenant_id).eq("status", "active")
    ]);

    return {
      customers: customers.data || [],
      subscriptions: subscriptions.data || []
    };
  });

export const getCustomerInteractions = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ customer_id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: interactions } = await supabase
      .from("customer_interactions")
      .select("*")
      .eq("customer_id", data.customer_id)
      .order("created_at", { ascending: false });
    return interactions || [];
  });

export const addCustomerInteraction = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ 
    customer_id: z.string(),
    tenant_id: z.string(),
    author_id: z.string(),
    type: z.string(),
    content: z.string()
  }).parse(data))
  .handler(async ({ data }) => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { error } = await supabase.from("customer_interactions").insert(data);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const getCustomerTasks = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ customer_id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: tasks } = await supabase
      .from("customer_tasks")
      .select("*")
      .eq("customer_id", data.customer_id)
      .order("due_at", { ascending: true, nullsFirst: false });
    return tasks || [];
  });

export const addCustomerTask = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ 
    customer_id: z.string(),
    tenant_id: z.string(),
    author_id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    due_at: z.string().optional()
  }).parse(data))
  .handler(async ({ data }) => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { error } = await supabase.from("customer_tasks").insert(data);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const toggleTaskStatus = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string(), status: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { error } = await supabase.from("customer_tasks").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

