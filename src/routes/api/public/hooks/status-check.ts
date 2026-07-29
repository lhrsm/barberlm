import { createFileRoute } from "@tanstack/react-router";
import { assertCronOrSuperAdmin } from "@/lib/cron-auth";
import { createClient } from "@supabase/supabase-js";

// Public monitoring endpoint — pings each service and stores a check row.
// Called by pg_cron periodically; safe to call manually from admin UI.
export const Route = createFileRoute("/api/public/hooks/status-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await assertCronOrSuperAdmin(request);
        if (denied) return denied;

        const url = process.env.SUPABASE_URL!;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

        const { data: services } = await admin.from("status_services").select("id, slug").eq("enabled", true);
        if (!services) return Response.json({ ok: false, error: "no services" });

        const baseUrl = "https://barbex.shop";
        const results: any[] = [];

        const checkUrl = async (target: string): Promise<{ ok: boolean; latency: number; msg?: string }> => {
          const t0 = Date.now();
          try {
            const ctl = new AbortController();
            const timer = setTimeout(() => ctl.abort(), 8000);
            const r = await fetch(target, { method: "GET", signal: ctl.signal });
            clearTimeout(timer);
            return { ok: r.ok, latency: Date.now() - t0, msg: r.ok ? undefined : `HTTP ${r.status}` };
          } catch (e: any) {
            return { ok: false, latency: Date.now() - t0, msg: e?.message || "fetch failed" };
          }
        };

        const checkDb = async (): Promise<{ ok: boolean; latency: number; msg?: string }> => {
          const t0 = Date.now();
          try {
            const { error } = await admin.from("status_services").select("id").limit(1);
            return { ok: !error, latency: Date.now() - t0, msg: error?.message };
          } catch (e: any) { return { ok: false, latency: Date.now() - t0, msg: e?.message }; }
        };

        for (const svc of services) {
          let r: { ok: boolean; latency: number; msg?: string };
          switch (svc.slug) {
            case "frontend": r = await checkUrl(baseUrl); break;
            case "admin-panel": r = await checkUrl(`${baseUrl}/auth`); break;
            case "client-portal": r = await checkUrl(`${baseUrl}/auth`); break;
            case "barber-panel": r = await checkUrl(`${baseUrl}/auth`); break;
            case "api": r = await checkUrl(`${baseUrl}/api/public/hooks/status-check`); break;
            case "database":
            case "realtime":
            case "storage":
            case "uploads":
            case "notifications":
            case "automations":
              r = await checkDb(); break;
            case "stripe": r = await checkUrl("https://status.stripe.com/"); break;
            case "whatsapp": r = await checkUrl("https://www.whatsapp.com/"); break;
            case "ai": r = await checkUrl("https://status.openai.com/"); break;
            default: r = await checkDb();
          }

          let status: string;
          if (!r.ok) status = "down";
          else if (r.latency > 3000) status = "partial";
          else if (r.latency > 1500) status = "degraded";
          else status = "operational";

          await admin.from("status_checks").insert({
            service_id: svc.id,
            status,
            latency_ms: r.latency,
            success: r.ok,
            message: r.msg || null,
          });

          results.push({ slug: svc.slug, status, latency_ms: r.latency });
        }

        // Auto-alert: create admin_notification when any service is down (best-effort)
        const downs = results.filter(r => r.status === "down");
        if (downs.length > 0) {
          await admin.from("admin_notifications").insert(
            downs.map(d => ({
              type: "system",
              title: `🔴 ${d.slug} indisponível`,
              message: `Verificação automática detectou que ${d.slug} está indisponível.`,
              priority: "high",
            }))
          ).then(() => {}, () => {});
        }

        return Response.json({ ok: true, checked: results.length, results });
      },
    },
  },
});
