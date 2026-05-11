import { createStripeClient } from "./src/lib/stripe.server";
import dotenv from "dotenv";

dotenv.config();

async function listLiveProducts() {
  try {
    const stripe = createStripeClient('live');
    const products = await stripe.products.list({ expand: ['data.default_price'] });
    console.log("ALL PRODUCTS (Active & Inactive):");
    products.data.forEach(p => {
      console.log(`- Product: ${p.name} (${p.id}) [Active: ${p.active}]`);
      console.log(`  Metadata: ${JSON.stringify(p.metadata)}`);
      // @ts-ignore
      const price = p.default_price;
      if (price) {
        console.log(`  Price: ${price.id} (lookup_key: ${price.lookup_key}, amount: ${price.unit_amount}, recurring: ${!!price.recurring})`);
      }
    });

    const prices = await stripe.prices.list({ expand: ['data.product'] });
    console.log("\nALL PRICES:");
    prices.data.forEach(p => {
      const prod = p.product as any;
      console.log(`- Price: ${p.id} for Product: ${prod.name} (${prod.id}) [Active: ${p.active}]`);
      console.log(`  lookup_key: ${p.lookup_key}`);
      console.log(`  unit_amount: ${p.unit_amount}`);
    });
  } catch (err) {
    console.error("Error listing live products:", err);
  }
}

listLiveProducts();
