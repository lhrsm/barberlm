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
  .middleware([requireSupabaseAuth])
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
  .handler(async ({ data, context }) => {
    const { userId } = context;
    console.log("[Checkout Server] Starting for userId:", userId, "priceId:", data.priceId);
    
    const stripe = createStripeClient(data.environment);
    
    // Search for price
    let stripePrice;
    console.log("[Checkout Server] Searching price by lookup_key:", data.priceId);
    try {
      const prices = await stripe.prices.list({ 
        lookup_keys: [data.priceId],
        active: true,
        limit: 1
      });

      if (prices.data.length > 0) {
        stripePrice = prices.data[0];
      } else {
        console.warn("[Checkout Server] lookup_key not found, searching by product metadata or ID");
        const allPrices = await stripe.prices.list({ 
          active: true,
          limit: 100,
          expand: ['data.product']
        });
        
        stripePrice = allPrices.data.find(p => {
          const product = p.product as any;
          return product.metadata?.plan_id === data.priceId || p.id === data.priceId || p.lookup_key === data.priceId;
        });
      }
    } catch (err) {
      console.error("[Checkout Server] Stripe API error during price search:", err);
      throw err;
    }

    if (!stripePrice) {
      console.error("[Checkout Server] No price found for:", data.priceId);
      throw new Error(`Plano não encontrado no Stripe: ${data.priceId}. Certifique-se de que o preço existe no Stripe Dashboard.`);
    }

    const isRecurring = stripePrice.type === "recurring";
    console.log("[Checkout Server] Found price:", stripePrice.id, "recurring:", isRecurring);

    const customerId = await resolveOrCreateCustomer(stripe, {
      email: data.customerEmail,
      userId: userId,
    });

    console.log("[Checkout Server] Customer ID:", customerId);

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: data.quantity || 1 }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded_page",
      return_url: data.returnUrl,
      ...(customerId && { customer: customerId }),
      ...(userId && {
        metadata: { userId: userId },
        ...(isRecurring && { subscription_data: { metadata: { userId: userId } } }),
      }),
    } as any);

    console.log("[Checkout Server] Session created, client_secret available:", !!session.client_secret);
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
    
    if (subError || !sub?.stripe_customer_id) {
      // Fallback: search customer in Stripe by metadata
      const stripe = createStripeClient(data.environment);
      const found = await stripe.customers.search({
        query: `metadata['userId']:'${userId}'`,
        limit: 1,
      });
      if (found.data.length) {
        const portal = await stripe.billingPortal.sessions.create({
          customer: found.data[0].id,
          ...(data.returnUrl && { return_url: data.returnUrl }),
        });
        return portal.url;
      }
      throw new Error("No subscription or customer found");
    }

    const stripe = createStripeClient(data.environment);
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id as string,
      ...(data.returnUrl && { return_url: data.returnUrl }),
    });
    return portal.url;
  });