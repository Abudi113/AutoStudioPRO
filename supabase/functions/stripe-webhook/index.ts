// Supabase Edge Function: stripe-webhook
// Verifies Stripe webhook signature, then grants credits on purchase
// and resets subscription credits on renewal.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Credits granted per plan / add-on
const CREDITS_MAP: Record<string, number> = {
    starter: 300,
    growth: 1000,
    pro: 3000,
    addon_100: 100,
    addon_300: 300,
    addon_800: 800,
};

/** Stripe webhook signature verification (HMAC-SHA256) */
async function verifyStripeSignature(
    payload: string,
    sigHeader: string,
    secret: string,
): Promise<boolean> {
    const parts = Object.fromEntries(sigHeader.split(",").map((p) => p.split("=")));
    const timestamp = parts["t"];
    const sig = parts["v1"];
    if (!timestamp || !sig) return false;

    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );
    const signedData = `${timestamp}.${payload}`;
    const signatureBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedData));
    const computedSig = Array.from(new Uint8Array(signatureBytes))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    return computedSig === sig;
}

// Subscription plan IDs (not add-ons)
const SUBSCRIPTION_PLANS = new Set(["starter", "growth", "pro"]);

// ── helpers ──
const isAddon = (planId: string) => planId?.startsWith("addon_");

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!webhookSecret) {
        return new Response(JSON.stringify({ error: "STRIPE_WEBHOOK_SECRET not configured" }), { status: 500, headers: CORS });
    }

    const payload = await req.text();
    const sigHeader = req.headers.get("stripe-signature") ?? "";

    const valid = await verifyStripeSignature(payload, sigHeader, webhookSecret);
    if (!valid) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400, headers: CORS });
    }

    const event = JSON.parse(payload);
    const supabase = createClient(supabaseUrl, serviceKey);

    try {
        // ── checkout.session.completed (first purchase / add-on) ──
        if (event.type === "checkout.session.completed") {
            const session = event.data.object;
            const userId = session.metadata?.user_id;
            const planId = session.metadata?.plan_id;
            const credits = CREDITS_MAP[planId] ?? 0;
            const sessionId = session.id;

            if (userId && credits > 0) {
                // ── Idempotency: skip if this session was already processed ──
                const { data: existing } = await supabase
                    .from("processed_sessions")
                    .select("session_id")
                    .eq("session_id", sessionId)
                    .maybeSingle();

                if (existing) {
                    console.log(`⏭️ Session ${sessionId} already processed, skipping`);
                } else {
                    if (isAddon(planId)) {
                        // Add-on: add to credits_purchased
                        await supabase.rpc("add_purchased_credits", {
                            p_user_id: userId,
                            p_amount: credits,
                        }).catch(async () => {
                            await supabase.from("profiles")
                                .select("credits_purchased")
                                .eq("id", userId)
                                .single()
                                .then(async ({ data }: { data: any }) => {
                                    const current = data?.credits_purchased ?? 0;
                                    await supabase.from("profiles")
                                        .update({ credits_purchased: current + credits })
                                        .eq("id", userId);
                                });
                        });
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
                        console.log(`✅ Set credits_monthly=${credits}, tier=${planId} for initial subscription (${userId})`);
                    }

                    // Record this session to prevent double-processing
                    await supabase.from("processed_sessions").insert({
                        session_id: sessionId,
                        user_id: userId,
                        credits_granted: credits,
                    });
                }
            }
        }

        // ── invoice.paid (subscription renewal) ──
        // Resets credits to the plan amount each billing cycle
        if (event.type === "invoice.paid") {
            const invoice = event.data.object;
            // Only process subscription renewals, not first payment
            if (invoice.billing_reason === "subscription_cycle") {
                const subId = invoice.subscription;
                // Look up the subscription to find user and plan
                const { data: sub } = await supabase
                    .from("subscriptions")
                    .select("user_id, plan")
                    .eq("stripe_subscription_id", subId)
                    .single();

                if (sub) {
                    const credits = CREDITS_MAP[sub.plan] ?? 0;
                    if (credits > 0) {
                        // Reset monthly credits to plan amount (replaces, no rollover)
                        await supabase
                            .from("profiles")
                            .update({
                                credits_monthly: credits,
                                last_refill_date: new Date().toISOString(),
                            })
                            .eq("id", sub.user_id);
                        console.log(`🔄 Refilled credits_monthly to ${credits} for subscription renewal (${sub.plan})`);
                    }
                }
            }
        }

        // ── customer.subscription.updated / created ──
        if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created") {
            const sub = event.data.object;
            const userId = sub.metadata?.user_id;
            const planId = sub.metadata?.plan_id;

            if (userId) {
                await supabase.from("subscriptions").upsert({
                    user_id: userId,
                    stripe_customer_id: sub.customer,
                    stripe_subscription_id: sub.id,
                    plan: planId,
                    status: sub.status,
                    images_per_month: CREDITS_MAP[planId] ?? 0,
                    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
                    updated_at: new Date().toISOString(),
                }, { onConflict: "user_id" });

                // Keep profiles.subscription_tier in sync
                await supabase
                    .from("profiles")
                    .update({ subscription_tier: planId ?? "free" })
                    .eq("id", userId);
            }
        }

        // ── customer.subscription.deleted ──
        if (event.type === "customer.subscription.deleted") {
            const sub = event.data.object;
            const userId = sub.metadata?.user_id;

            await supabase
                .from("subscriptions")
                .update({ status: "canceled", updated_at: new Date().toISOString() })
                .eq("stripe_subscription_id", sub.id);

            // Reset profile tier and monthly credits
            if (userId) {
                await supabase
                    .from("profiles")
                    .update({ subscription_tier: "free", credits_monthly: 0 })
                    .eq("id", userId);
            }
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { ...CORS, "Content-Type": "application/json" },
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("Webhook error:", msg);
        return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { ...CORS, "Content-Type": "application/json" },
        });
    }
});
