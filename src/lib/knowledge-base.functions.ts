import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Admin-only: Manage Tutorials
export const adminSaveTutorial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    
    // Check role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .single();
      
    if (!roleData) throw new Error("Unauthorized: Only admins can manage content.");

    const { id, ...values } = data;
    
    // 1. If existing, create a version record before updating
    if (id) {
      const { data: current } = await supabase
        .from("tutorials")
        .select("*")
        .eq("id", id)
        .single();
        
      if (current) {
        await supabase.from("article_versions").insert({
          tutorial_id: id,
          version_number: current.version || 1,
          title: current.title,
          content: current.description || "",
          summary: current.description?.substring(0, 100),
          author_id: userId,
          change_reason: data.change_reason || "Update"
        });
        
        values.version = (current.version || 1) + 1;
      }
    }

    const { data: result, error } = await supabase
      .from("tutorials")
      .upsert({ 
        id, 
        ...values,
        author_id: userId,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // 2. Log workflow
    await supabase.from("content_workflow_logs").insert({
      content_type: "tutorial",
      content_id: result.id,
      from_status: data.from_status || "draft",
      to_status: values.status || "published",
      user_id: userId,
      notes: data.change_reason
    });

    return result;
  });

// Admin-only: Manage Academy Lessons
export const adminSaveAcademyLesson = createServerFn({ method: "POST" })
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

    const { data: result, error } = await supabase
      .from("academy_lessons")
      .upsert({ id, ...values })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return result;
  });

// Public/Auth: Analytics reporting
export const reportContentView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { contentType: string; contentId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    
    const { error } = await supabase.rpc('increment_content_views', {
      c_type: data.contentType,
      c_id: data.contentId
    });

    return { ok: !error };
  });
