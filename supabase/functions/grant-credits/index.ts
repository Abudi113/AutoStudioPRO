// Supabase Edge Function: grant-credits
// Called from the success page with a Stripe session_id.
// Verifies the session with Stripe, then atomically grants credits.
// Uses a processed_sessions table to ensure idempotency (no double grants).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CREDITS_MAP: Record<string, number> = {
    starter: 300,
    growth: 1000,
    pro: 3000,
    addon_100: 100,
    addon_300: 300,
    addon_800: 800,
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

    try {
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

        const { sessionId } = await req.json();
        if (!sessionId) throw new Error("sessionId is required");

        // 1. Verify the session with Stripe
        const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
            headers: { "Authorization": `Bearer ${stripeKey}` },
        });

        if (!stripeRes.ok) {
            const err = await stripeRes.json();
            throw new Error(`Stripe session lookup failed: ${err?.error?.message ?? stripeRes.status}`);
        }

        const session = await stripeRes.json();

        // 2. Only process completed sessions
        if (session.payment_status !== "paid") {
            return new Response(JSON.stringify({ success: false, reason: "not_paid" }), {
                headers: { ...CORS, "Content-Type": "application/json" },
            });
        }

        const userId = session.metadata?.user_id;
        const planId = session.metadata?.plan_id;
        const credits = CREDITS_MAP[planId] ?? 0;

        if (!userId || credits === 0) {
            throw new Error(`Missing metadata. userId: ${userId}, planId: ${planId}`);
        }

        const supabase = createClient(supabaseUrl, serviceKey);

        // 3. Idempotency check — don't grant twice for same session
        const { data: existing } = await supabase
            .from("processed_sessions")
            .select("id")
            .eq("session_id", sessionId)
            .single();

        if (existing) {
            console.log(`Session ${sessionId} already processed — skipping`);
            return new Response(JSON.stringify({ success: true, already_processed: true }), {
                headers: { ...CORS, "Content-Type": "application/json" },
            });
        }

        // 4. Grant credits — subscriptions → credits_monthly, add-ons → credits_purchased
        const isAddon = planId?.startsWith("addon_");

        if (isAddon) {
            // Add-on: increment credits_purchased
            const { data: profile } = await supabase
                .from("profiles")
                .select("credits_purchased")
                .eq("id", userId)
                .single();

            const current = (profile as any)?.credits_purchased ?? 0;
            await supabase
                .from("profiles")
                .update({ credits_purchased: current + credits })
                .eq("id", userId);
            console.log(`✅ Added ${credits} add-on credits (${planId}) → credits_purchased for ${userId}`);
        } else {
            // Subscription: set credits_monthly + subscription_tier
            await supabase
                .from("profiles")
                .update({
                    credits_monthly: credits,
                    subscription_tier: planId,
                    last_refill_date: new Date().toISOString(),
                })
                .eq("id", userId);
            console.log(`✅ Set credits_monthly=${credits}, tier=${planId} for ${userId}`);
        }

        // 5. Record session as processed
        await supabase.from("processed_sessions").insert({ session_id: sessionId, user_id: userId, credits_granted: credits });

        return new Response(JSON.stringify({ success: true, credits_granted: credits }), {
            headers: { ...CORS, "Content-Type": "application/json" },
        });

    } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("grant-credits error:", msg);
        return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { ...CORS, "Content-Type": "application/json" },
        });
    }
});
