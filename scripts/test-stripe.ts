
import Stripe from 'stripe';

const STRIPE_LIVE_API_KEY = process.env.STRIPE_LIVE_API_KEY;
const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;

if (!STRIPE_LIVE_API_KEY || !LOVABLE_API_KEY) {
  console.error("Missing API keys");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_LIVE_API_KEY, {
  apiVersion: '2025-01-27.acacia' as any,
  httpClient: Stripe.createFetchHttpClient(((url: any, init?: RequestInit) => {
    const gatewayUrl = url.toString().replace('https://api.stripe.com', 'https://connector-gateway.lovable.dev/stripe');
    return fetch(gatewayUrl, {
      ...init,
      headers: {
        ...Object.fromEntries(new Headers(init?.headers).entries()),
        'X-Connection-Api-Key': STRIPE_LIVE_API_KEY,
        'Lovable-API-Key': LOVABLE_API_KEY,
      },
    });
  }) as any),
});

async function main() {
  console.log("Listing active prices...");
  try {
    const prices = await stripe.prices.list({ active: true, expand: ['data.product'] });
    console.log(`Found ${prices.data.length} prices:`);
    prices.data.forEach(p => {
      const product = p.product as any;
      console.log(`- Plan: ${product.name}, Price ID: ${p.id}, Lookup Key: ${p.lookup_key}, Amount: ${p.unit_amount / 100}`);
    });
  } catch (err) {
    console.error("Error listing prices:", err);
  }
}

main();
