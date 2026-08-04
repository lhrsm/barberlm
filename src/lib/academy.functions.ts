import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAcademyPaths = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { profile_target?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    
    let query = supabase
      .from("academy_paths")
      .select("*")
      .order("order", { ascending: true });
      
    if (data.profile_target) {
      query = query.eq("profile_target", data.profile_target);
    }
    
    const { data: paths, error } = await query;
    if (error) throw new Error(error.message);
    
    return { items: paths || [] };
  });

export const getAcademyPathDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pathId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    
    const { data: path, error: pathError } = await supabase
      .from("academy_paths")
      .select("*")
      .eq("id", data.pathId)
      .single();
      
    if (pathError) throw new Error(pathError.message);
    
    const { data: modules, error: modulesError } = await supabase
      .from("academy_modules")
      .select(`
        *,
        lessons:academy_lessons(*)
      `)
      .eq("path_id", data.pathId)
      .order("order", { ascending: true });
      
    if (modulesError) throw new Error(modulesError.message);
    
    // Enrich lessons with progress
    const { data: progress } = await supabase
      .from("academy_progress")
      .select("lesson_id, status")
      .eq("user_id", (context as any).userId)
      .eq("path_id", data.pathId);
      
    const progressMap = new Map((progress || []).map((p: any) => [p.lesson_id, p.status]));
    
    const enrichedModules = (modules || []).map((m: any) => ({
      ...m,
      lessons: (m.lessons || []).sort((a: any, b: any) => (a.order || 0) - (b.order || 0)).map((l: any) => ({
        ...l,
        progress: progressMap.get(l.id) || "not_started"
      }))
    }));
    
    return { 
      path, 
      modules: enrichedModules,
      stats: {
        totalLessons: enrichedModules.reduce((acc: number, m: any) => acc + m.lessons.length, 0),
        completedLessons: progress?.filter((p: any) => p.status === 'completed').length || 0
      }
    };
  });

export const markLessonProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pathId: string; lessonId: string; status: "started" | "completed" }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    
    // Get tenant_id from user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .single();
      
    const tenantId = profile?.tenant_id || userId;
    
    const { error } = await supabase
      .from("academy_progress")
      .upsert({
        user_id: userId,
        tenant_id: tenantId,
        path_id: data.pathId,
        lesson_id: data.lessonId,
        status: data.status,
        completed_at: data.status === 'completed' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,lesson_id' });
      
    if (error) throw new Error(error.message);
    
    return { ok: true };
  });

export const getRecommendedPaths = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();
      
    const { data: paths, error } = await supabase
      .from("academy_paths")
      .select("*")
      .eq("profile_target", profile?.role || 'user')
      .eq("status", "published")
      .limit(3);
      
    if (error) throw new Error(error.message);
    
    return { items: paths || [] };
  });
