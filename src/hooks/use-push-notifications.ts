import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/push-config";

export type PushAudience = "customer" | "staff" | "owner";

interface Options {
  customerPhone?: string | null;
  tenantId?: string | null;
  audience?: PushAudience;
}

export function usePushNotifications(opts: Options = {}) {
  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  const [permission, setPermission] = useState<NotificationPermission | "default">(
    supported ? Notification.permission : "default",
  );
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supported) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/sw-push.js");
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        setSubscribed(!!sub);
      } catch {}
    })();
  }, [supported]);

  const subscribe = useCallback(async () => {
    if (!supported) return { ok: false, error: "unsupported" as const };
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return { ok: false, error: "denied" as const };

      const reg =
        (await navigator.serviceWorker.getRegistration("/sw-push.js")) ||
        (await navigator.serviceWorker.register("/sw-push.js"));
      await navigator.serviceWorker.ready;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key.buffer as ArrayBuffer,
        });
      }
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      const { error } = await supabase.rpc("register_push_subscription", {
        _endpoint: json.endpoint!,
        _p256dh: json.keys!.p256dh!,
        _auth: json.keys!.auth!,
        _user_agent: navigator.userAgent,
        _customer_phone: opts.customerPhone ?? undefined,
        _tenant_id: opts.tenantId ?? undefined,
        _audience: opts.audience ?? "customer",
      });
      if (error) throw error;
      setSubscribed(true);
      return { ok: true as const };
    } catch (e: any) {
      return { ok: false as const, error: e?.message || "error" };
    } finally {
      setLoading(false);
    }
  }, [supported, opts.customerPhone, opts.tenantId, opts.audience]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw-push.js");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await supabase.rpc("unregister_push_subscription", { _endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, [supported]);

  return { supported, permission, subscribed, loading, subscribe, unsubscribe };
}
