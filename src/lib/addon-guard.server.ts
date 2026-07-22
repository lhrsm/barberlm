/**
 * Backend guard for premium add-on modules.
 *
 * Use this inside any server function that exposes premium-module functionality
 * to ensure the caller actually has an active `tenant_addons` row for the
 * required add-on key. The UI-level `ModuleGuard` is UX-only; this is the
 * authoritative check.
 *
 * Usage inside a `createServerFn().middleware([requireSupabaseAuth]).handler`:
 *
 *   await requireAddon(context.supabase, context.userId, "cashback", env);
 */
import type { StripeEnv } from "@/lib/stripe.server";

export class AddonAccessDeniedError extends Error {
  code = "ADDON_REQUIRED" as const;
  constructor(public addonKey: string) {
    super(`Este recurso requer o add-on "${addonKey}". Contrate em /subscription/addons`);
  }
}

export async function hasActiveAddon(
  sb: any,
  userId: string,
  addonKey: string,
  env: StripeEnv,
): Promise<boolean> {
  const { data, error } = await sb.rpc("has_active_addon" as any, {
    _user_id: userId,
    _addon_key: addonKey,
    _env: env,
  });
  if (error) {
    console.error("[addon-guard] rpc error", addonKey, error.message);
    return false;
  }
  return !!data;
}

export async function requireAddon(
  sb: any,
  userId: string,
  addonKey: string,
  env: StripeEnv,
): Promise<void> {
  const ok = await hasActiveAddon(sb, userId, addonKey, env);
  if (!ok) throw new AddonAccessDeniedError(addonKey);
}
