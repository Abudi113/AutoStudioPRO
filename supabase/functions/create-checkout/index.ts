// Supabase Edge Function: create-checkout
// Receives { planId, successUrl, cancelUrl } from the frontend,
// creates a Stripe Checkout Session, and returns { url }.
//
// ── Stripe products to create in your dashboard ──────────────
// Monthly subscriptions:
//   starter  → 99 €/mo   → replace PRICE_STARTER below
//   growth   → 299 €/mo  → replace PRICE_GROWTH below
//   pro      → 699 €/mo  → replace PRICE_PRO below
// One-time add-ons:
//   addon_100  → 39 €    → replace PRICE_ADDON_100 below
//   addon_300  → 99 €    → replace PRICE_ADDON_300 below
//   addon_800  → 199 €   → replace PRICE_ADDON_800 below
// ─────────────────────────────────────────────────────────────

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Price ID map (TEST MODE) ──
// ⚠️  You must create new Stripe prices for the updated plans/addons and paste the IDs here.
const STRIPE_PRICES: Record<string, { priceId: string; mode: "subscription" | "payment" }> = {
    starter: { priceId: "price_1T4QEwIJEJVuNvynxLyfSigi", mode: "subscription" },   // TODO: update to new €99/mo price
    growth: { priceId: "price_1T4QG5IJEJVuNvynXf6vFt5d", mode: "subscription" },    // TODO: update to new €299/mo price
    pro: { priceId: "price_1T4QH1IJEJVuNvynH5XSrQ6n", mode: "subscription" },       // TODO: update to new €699/mo price
    addon_100: { priceId: "REPLACE_ME_ADDON_100", mode: "payment" },    // 100 images → €39
    addon_300: { priceId: "REPLACE_ME_ADDON_300", mode: "payment" },    // 300 images → €99
    addon_800: { priceId: "REPLACE_ME_ADDON_800", mode: "payment" },    // 800 images → €199
};
// ── LIVE Price IDs (switch back for production) ──
// starter:    price_1SydaeIYHtY4sN4xO1Jk9QyF   // TODO: update to new €99/mo price
// growth:     price_1SyedYIYHtY4sN4xxG5QVfMO    // TODO: update to new €299/mo price
// pro:        price_1SyedyIYHtY4sN4x4Dz4wSF8   // TODO: update to new €699/mo price
// addon_100:  REPLACE_ME   // 100 images → €39
// addon_300:  REPLACE_ME   // 300 images → €99
// addon_800:  REPLACE_ME   // 800 images → €199

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

    try {
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

        const authHeader = req.headers.get("Authorization") ?? "";
        const { planId, successUrl, cancelUrl, userId } = await req.json();

        const plan = STRIPE_PRICES[planId];
        if (!plan) throw new Error(`Unknown planId: ${planId}`);

        // Build Stripe Checkout Session
        const body = new URLSearchParams();
        body.set("mode", plan.mode);
        body.set("line_items[0][price]", plan.priceId);
        body.set("line_items[0][quantity]", "1");
        body.set("success_url", successUrl ?? "http://localhost:3000/pricing/success?session_id={CHECKOUT_SESSION_ID}");
        body.set("cancel_url", cancelUrl ?? "http://localhost:3000/pricing");
        body.set("metadata[user_id]", userId ?? "");
        body.set("metadata[plan_id]", planId);
        // Allow promotion codes
        body.set("allow_promotion_codes", "true");

        const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${stripeKey}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: body.toString(),
        });

        const session = await stripeRes.json();

        if (!stripeRes.ok) {
            throw new Error(session?.error?.message ?? "Stripe error");
        }

        return new Response(JSON.stringify({ url: session.url }), {
            headers: { ...CORS, "Content-Type": "application/json" },
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { ...CORS, "Content-Type": "application/json" },
        });
    }
});
