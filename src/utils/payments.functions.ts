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
    try {
      console.log("[resolveOrCreateCustomer] 📡 Chamando stripe.customers.search para userId:", options.userId);
      
      const searchPromise = stripe.customers.search({
        query: `metadata['userId']:'${options.userId}'`,
        limit: 1,
      });

      // Timeout de 30s para busca no Stripe
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Stripe Search Timeout (30s)")), 30000));
      const found = await Promise.race([searchPromise, timeout]) as any;
      
      console.log("[resolveOrCreateCustomer] 📡 Resposta do Stripe Search:", found.data?.length || 0, "encontrados");
      if (found.data?.length) {
        console.log("[resolveOrCreateCustomer] ✅ Cliente encontrado por metadata:", found.data[0].id);
        return found.data[0].id;
      }
    } catch (err) {
      console.error("[resolveOrCreateCustomer] ⚠️ Erro ao buscar por metadata:", err instanceof Error ? err.message : err);
    }
  }
  
  if (options.email) {
    console.log("[resolveOrCreateCustomer] 🔍 Buscando cliente por email:", options.email);
    try {
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
    } catch (err) {
      console.error("[resolveOrCreateCustomer] ⚠️ Erro ao buscar por email:", err instanceof Error ? err.message : err);
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
    const { userId, supabase: supabaseClient } = context;
    const startTime = Date.now();
    console.log("[Checkout Server] 🚀 INICIANDO handler de createCheckoutSession", {
      priceId: data.priceId,
      environment: data.environment,
      userId: userId,
      timestamp: new Date().toISOString()
    });
    
    try {
      // Buscar trial atual do banco de dados
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("trial_end")
        .eq("id", userId)
        .maybeSingle();
      
      const trialEnd = profile?.trial_end ? new Date(profile.trial_end) : null;
      const now = new Date();
      const trialRemainingSeconds = trialEnd && trialEnd > now 
        ? Math.floor((trialEnd.getTime() - now.getTime()) / 1000)
        : 0;

      const stripe = createStripeClient(data.environment);
      console.log("[Checkout Server] 💳 Cliente Stripe criado para ambiente:", data.environment, "Trial remaining (s):", trialRemainingSeconds);
    
      let stripePrice;
      try {
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
          }
        }
      } catch (err: any) {
        console.error("[Checkout Server] ❌ Erro na API do Stripe ao buscar preço:", err.message);
        throw new Error(`Erro ao buscar preço no Stripe: ${err.message}`);
      }

      if (!stripePrice) {
        console.error("[Checkout Server] ❌ Nenhum preço encontrado para:", data.priceId);
        throw new Error(`Plano não encontrado no Stripe (${data.priceId}). Verifique se o ID ou lookup_key está correto no ambiente ${data.environment}.`);
      }

      const isRecurring = stripePrice.type === "recurring";
      const product = stripePrice.product as any;
      const productName = product?.name || "Plano";
      
      console.log(`[Checkout Server] ✅ Preço identificado em ${Date.now() - startTime}ms:`, stripePrice.id, "Product:", productName);

      console.log("[Checkout Server] 👤 Chamando resolveOrCreateCustomer...");
      const customerId = await resolveOrCreateCustomer(stripe, {
        email: data.customerEmail,
        userId: userId,
      });

      console.log(`[Checkout Server] ✅ Customer ID obtido em ${Date.now() - startTime}ms:`, customerId);

      // Usar o trial_end existente para que a cobrança só inicie após o trial de 15 dias inicial
      // Se o trial já expirou, não adicionamos trial_end na sessão (cobrança imediata)
      const stripeTrialEnd = trialRemainingSeconds > 60 // Pelo menos 1 minuto sobrando
        ? Math.floor(Date.now() / 1000) + trialRemainingSeconds
        : undefined;

      console.log("[Checkout Server] 🏗️ Criando sessão de checkout...", {
        priceId: stripePrice.id,
        customerId,
        trialEnd: stripeTrialEnd ? new Date(stripeTrialEnd * 1000).toISOString() : "Imediato",
        mode: isRecurring ? "subscription" : "payment"
      });

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
          metadata: { 
            userId: userId, 
            plan: productName,
            environment: data.environment 
          },
          ...(isRecurring && { 
            subscription_data: { 
              metadata: { userId: userId, environment: data.environment },
              ...(trialDays && { trial_period_days: trialDays })
            } 
          }),
        }),
      } as any);

      console.log(`[Checkout Server] ✨ Checkout Session criada com sucesso em ${Date.now() - startTime}ms:`, {
        id: session.id,
        livemode: session.livemode
      });
      
      return session.client_secret;
    } catch (err: any) {
      console.error("[Checkout Server] 💥 Erro crítico no handler:", err.message);
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
