import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getUpdates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number; profile?: string; tenantId?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    
    let query = supabase
      .from("changelog_entries")
      .select(`
        *,
        interactions:changelog_interactions(status)
      `)
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (data.limit) query = query.limit(data.limit);
    
    // Filter by profile if provided (or get from context)
    // Note: Complex array filtering might need a more specific query
    
    const { data: entries, error } = await query;
    if (error) throw new Error(error.message);

    return { items: entries || [] };
  });

export const markUpdateRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { entryId: string; status?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    
    // Get tenant_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .single();

    const { error } = await supabase
      .from("changelog_interactions")
      .upsert({
        entry_id: data.entryId,
        user_id: userId,
        tenant_id: profile?.tenant_id,
        status: data.status || 'read',
        interacted_at: new Date().toISOString()
      }, { onConflict: 'entry_id,user_id' });

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSaveUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .single();
      
    if (!roleData) throw new Error("Unauthorized");

    const { id, ...values } = data;
    
    if (values.status === 'published' && !values.published_at) {
      values.published_at = new Date().toISOString();
    }

    const { data: result, error } = await supabase
      .from("changelog_entries")
      .upsert({ 
        id, 
        ...values,
        author_id: userId,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return result;
  });
