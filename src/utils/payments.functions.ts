import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((data: {
    priceId: string;
    quantity?: number;
    customerEmail?: string;
    userId?: string;
    returnUrl: string;
    environment: StripeEnv;
  }) => {
    return data;
  })
  .handler(async ({ data }) => {
    console.log("[Checkout] Creating session for:", data.priceId);
    const stripe = createStripeClient(data.environment);

    // Use priceId as lookup_key as defined in the creation step
    console.log("[Checkout] Searching for price with lookup_key:", data.priceId);
    const prices = await stripe.prices.list({ 
      lookup_keys: [data.priceId],
      active: true,
      limit: 1
    });

    if (!prices.data.length) {
      console.error("[Checkout] Price not found for lookup_key:", data.priceId);
      // Fallback: try to list all prices to see what's available
      const allPrices = await stripe.prices.list({ limit: 10, active: true });
      console.log("[Checkout] Available prices:", allPrices.data.map(p => ({ id: p.id, lookup_key: p.lookup_key })));
      throw new Error(`Price not found: ${data.priceId}`);
    }

    const stripePrice = prices.data[0];
    const isRecurring = stripePrice.type === "recurring";
    console.log("[Checkout] Found price:", stripePrice.id, "recurring:", isRecurring);

    const customerId = (data.customerEmail || data.userId)
      ? await resolveOrCreateCustomer(stripe, {
          email: data.customerEmail,
          userId: data.userId,
        })
      : undefined;

    console.log("[Checkout] Customer ID:", customerId);

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: data.quantity || 1 }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded", // Changed from embedded_page to embedded
      return_url: data.returnUrl,
      ...(customerId && { customer: customerId }),
      ...(data.userId && {
        metadata: { userId: data.userId },
        ...(isRecurring && { subscription_data: { metadata: { userId: data.userId } } }),
      }),
    } as any);

    console.log("[Checkout] Session created, client_secret available:", !!session.client_secret);
    return session.client_secret;
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string; environment: StripeEnv }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: sub, error: subError } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subError || !sub?.stripe_customer_id) throw new Error("No subscription found");

    const stripe = createStripeClient(data.environment);
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id as string,
      ...(data.returnUrl && { return_url: data.returnUrl }),
    });
    return portal.url;
  });
