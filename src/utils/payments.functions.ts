import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  console.log("[resolveOrCreateCustomer] 🔍 Iniciando busca/criação de cliente para:", options);
  
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    console.error("[resolveOrCreateCustomer] ❌ UserID inválido:", options.userId);
    throw new Error("Invalid userId");
  }
  
  if (options.userId) {
    console.log("[resolveOrCreateCustomer] 🔍 Buscando cliente por metadata.userId:", options.userId);
    try {
      const found = await stripe.customers.search({
        query: `metadata['userId']:'${options.userId}'`,
        limit: 1,
      });
      console.log("[resolveOrCreateCustomer] 📡 Resposta do Stripe Search:", found.data.length, "encontrados");
      if (found.data.length) {
        console.log("[resolveOrCreateCustomer] ✅ Cliente encontrado por metadata:", found.data[0].id);
        return found.data[0].id;
      }
    } catch (err) {
      console.error("[resolveOrCreateCustomer] ⚠️ Erro ao buscar por metadata (pode ser delay de indexação):", err);
    }
  }
  
  if (options.email) {
    console.log("[resolveOrCreateCustomer] 🔍 Buscando cliente por email:", options.email);
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      console.log("[resolveOrCreateCustomer] ✅ Cliente encontrado por email:", customer.id);
      if (options.userId && customer.metadata?.userId !== options.userId) {
        console.log("[resolveOrCreateCustomer] 📝 Atualizando metadata.userId do cliente existente");
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  
  console.log("[resolveOrCreateCustomer] 🆕 Criando novo cliente no Stripe...");
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  console.log("[resolveOrCreateCustomer] ✅ Novo cliente criado:", created.id);
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
    console.log("[Checkout Server] 🚀 INICIANDO handler de createCheckoutSession");
    console.log("[Checkout Server] 🆔 User ID do contexto:", userId);
    console.log("[Checkout Server] 📦 Input data:", { 
      priceId: data.priceId, 
      environment: data.environment,
      email: data.customerEmail,
      userId: data.userId 
    });
    
    try {
      const stripe = createStripeClient(data.environment);
      console.log("[Checkout Server] 💳 Cliente Stripe criado com sucesso");
    
    // Search for price
    let stripePrice;
    try {
      // Tentamos buscar por ID direto primeiro (mais seguro para LIVE)
      if (data.priceId.startsWith('price_')) {
        console.log("[Checkout Server] 🔍 Buscando preço por ID direto:", data.priceId);
        stripePrice = await stripe.prices.retrieve(data.priceId, { expand: ['product'] });
      } else {
        console.log("[Checkout Server] 🔍 Buscando preço por lookup_key:", data.priceId);
        const prices = await stripe.prices.list({ 
          lookup_keys: [data.priceId],
          active: true,
          limit: 1,
          expand: ['data.product']
        });

        if (prices.data.length > 0) {
          stripePrice = prices.data[0];
        } else {
          // Fallback: search by product metadata
          console.warn("[Checkout Server] ⚠️ lookup_key não encontrada, buscando por metadata do produto");
          const allPrices = await stripe.prices.list({ 
            active: true,
            limit: 100,
            expand: ['data.product']
          });
          
          stripePrice = allPrices.data.find(p => {
            const product = p.product as any;
            return product.metadata?.plan_id === data.priceId || p.lookup_key === data.priceId;
          });
        }
      }
    } catch (err) {
      console.error("[Checkout Server] ❌ Erro na API do Stripe ao buscar preço:", err);
      throw err;
    }

    if (!stripePrice) {
      console.error("[Checkout Server] ❌ Nenhum preço encontrado para:", data.priceId);
      throw new Error(`Plano não encontrado no Stripe (${data.priceId}). Por favor, verifique se o produto e o preço estão configurados corretamente como ATIVOS no Stripe Dashboard.`);
    }

    const isRecurring = stripePrice.type === "recurring";
    const product = stripePrice.product as any;
    const productName = product?.name || "Plano";
    
    console.log("[Checkout Server] ✅ Preço encontrado:", {
      id: stripePrice.id,
      product: productName,
      amount: stripePrice.unit_amount,
      recurring: isRecurring
    });

    console.log("[Checkout Server] 👤 Iniciando resolveOrCreateCustomer...");
    const customerId = await resolveOrCreateCustomer(stripe, {
      email: data.customerEmail,
      userId: userId,
    });

    console.log("[Checkout Server] ✅ Customer ID obtido:", customerId);

    // Determinar se deve aplicar trial (Pro Plan)
    // Usamos price_1TVtOVPKG6q10Ujre6zMGYpk (LIVE) ou lookup_key pro_monthly
    const isProPlan = stripePrice.id === "price_1TVtOVPKG6q10Ujre6zMGYpk" || 
                     stripePrice.lookup_key === "pro_monthly" || 
                     productName.toLowerCase().includes("pro");
    
    const trialDays = isProPlan ? 15 : undefined;
    if (trialDays) {
      console.log(`[Checkout Server] 🎁 Aplicando ${trialDays} dias de teste grátis (Plano Pro)`);
    }

    console.log("[Checkout Server] 🏗️ Criando sessão de checkout Stripe...");
    try {
      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: data.quantity || 1 }],
        mode: isRecurring ? "subscription" : "payment",
        ui_mode: "embedded",
        customer_update: {
          address: 'auto',
          name: 'auto',
        },
        billing_address_collection: 'required',
        return_url: data.returnUrl,
        ...(customerId && { customer: customerId }),
        ...(userId && {
          metadata: { userId: userId, plan: productName },
          ...(isRecurring && { 
            subscription_data: { 
              metadata: { userId: userId },
              ...(trialDays && { trial_period_days: trialDays })
            } 
          }),
        }),
      } as any);

      console.log("[Checkout Server] ✨ Sessão criada com sucesso. ID:", session.id, "LiveMode:", session.livemode);
      return session.client_secret;
    } catch (err: any) {
      console.error("[Checkout Server] ❌ Erro ao criar sessão no Stripe:", err);
      throw err;
    }
  } catch (err: any) {
    console.error("[Checkout Server] 💥 Erro fatal no handler:", err);
    throw err;
  }
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