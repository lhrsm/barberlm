import { createFileRoute } from "@tanstack/react-router";
import webpush from "web-push";
import { z } from "zod";

const bodySchema = z.object({
  secret: z.string().min(1),
  target: z.object({
    user_id: z.string().uuid().optional(),
    customer_phone: z.string().optional(),
    tenant_id: z.string().uuid().optional(),
    audience: z.enum(["customer", "staff", "owner"]).optional(),
    endpoint: z.string().optional(),
  }),
  payload: z.object({
    title: z.string().min(1),
    body: z.string().optional(),
    url: z.string().optional(),
    icon: z.string().optional(),
    image: z.string().optional(),
    tag: z.string().optional(),
  }),
});

async function handler({ request }: { request: Request }) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return new Response("Invalid body", { status: 400 });

  const internal = process.env.PUSH_INTERNAL_SECRET || process.env.VAPID_PRIVATE_KEY!;
  if (parsed.data.secret !== internal) return new Response("Unauthorized", { status: 401 });

  const pub = process.env.VAPID_PUBLIC_KEY!;
  const priv = process.env.VAPID_PRIVATE_KEY!;
  const subject = process.env.VAPID_SUBJECT || "mailto:contato@barbex.shop";
  if (!pub || !priv) return new Response("VAPID not configured", { status: 500 });
  webpush.setVapidDetails(subject, pub, priv);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let query = supabaseAdmin.from("push_subscriptions").select("*").eq("active", true);
  const t = parsed.data.target;
  if (t.endpoint) query = query.eq("endpoint", t.endpoint);
  if (t.user_id) query = query.eq("user_id", t.user_id);
  if (t.customer_phone) query = query.eq("customer_phone", t.customer_phone);
  if (t.tenant_id) query = query.eq("tenant_id", t.tenant_id);
  if (t.audience) query = query.eq("audience", t.audience);

  const { data: subs, error } = await query;
  if (error) return new Response(error.message, { status: 500 });
  if (!subs || subs.length === 0) return Response.json({ sent: 0, failed: 0 });

  let sent = 0;
  let failed = 0;
  const stale: string[] = [];
  await Promise.all(
    subs.map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(parsed.data.payload),
        );
        sent++;
      } catch (e: any) {
        failed++;
        if (e?.statusCode === 404 || e?.statusCode === 410) stale.push(s.endpoint);
      }
    }),
  );
  if (stale.length)
    await supabaseAdmin.from("push_subscriptions").update({ active: false }).in("endpoint", stale);
  return Response.json({ sent, failed, cleaned: stale.length });
}

export const Route = createFileRoute("/api/public/send-push")({
  server: {
    handlers: {
      POST: handler,
      OPTIONS: () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "content-type",
          },
        }),
    },
  },
});
