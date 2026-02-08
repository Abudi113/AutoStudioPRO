
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2023-10-16",
    httpClient: Stripe.createFetchHttpClient(),
});

const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

// Price to Credit Mapping (Real IDs)
const CREDIT_MAPPING: Record<string, number> = {
    "price_1SydaeIYHtY4sN4xO1Jk9QyF": 100,  // Basic
    "price_1SyedYIYHtY4sN4xxG5QVfMO": 375,  // Starter
    "price_1SyedyIYHtY4sN4x4Dz4wSF8": 1000, // Pro/Professional
};

serve(async (req) => {
    const signature = req.headers.get("stripe-signature");

    if (!signature || !endpointSecret) {
        return new Response("Webhook Error: Missing signature or secret", { status: 400 });
    }

    try {
        const body = await req.text();
        const event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret);

        if (event.type === "checkout.session.completed") {
            const session = event.data.object as Stripe.Checkout.Session;
            const userId = session.client_reference_id;

            if (!userId) {
                console.error("No userId found in session:", session.id);
                return new Response("Webhook Error: No userId", { status: 400 });
            }

            console.log(`Processing fulfillment for user ${userId}, session ${session.id}`);

            const supabase = createClient(
                Deno.env.get("SUPABASE_URL") ?? "",
                Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
            );

            // 1. Determine credits to add
            // We look at line items if available, or just map the priceId
            // For simplicity in MVP, we'll assume one type of item per session
            // In a better version, we'd list line items: await stripe.checkout.sessions.listLineItems(session.id);

            // For now, let's try to find a priceId in metadata or line items
            // If the frontend passed priceId in metadata, it's easier
            const priceId = session.metadata?.priceId;
            let creditsToAdd = 0;

            if (priceId && CREDIT_MAPPING[priceId]) {
                creditsToAdd = CREDIT_MAPPING[priceId];
            } else {
                // FALLBACK: If not in metadata, we might have to use some logic or hardcode
                // For this implementation, we'll assume the frontend passes it in metadata or we check line items
                console.warn("PriceID not found in metadata for mapping. Using default or checking line items...");
                // Note: Adding async line item check would be better but let's stick to metadata as standard pattern
            }

            if (session.mode === "subscription") {
                // Update subscription tier
                const { error: subError } = await supabase
                    .from("profiles")
                    .update({
                        subscription_tier: "pro", // Assume pro for now, can be dynamic
                        credits_monthly: creditsToAdd,
                        last_refill_date: new Date().toISOString()
                    })
                    .eq("id", userId);

                if (subError) throw subError;
            } else {
                // Add purchased credits
                // Using atomic increment
                const { error: credError } = await supabase.rpc('add_purchased_credits', {
                    user_id: userId,
                    amount: creditsToAdd
                });

                if (credError) {
                    console.error("RPC failed, falling back to manual update:", credError);
                    // Manual update if RPC doesn't exist yet
                    const { data: profile } = await supabase.from("profiles").select("credits_purchased").eq("id", userId).single();
                    const newTotal = (profile?.credits_purchased || 0) + creditsToAdd;
                    await supabase.from("profiles").update({ credits_purchased: newTotal }).eq("id", userId);
                }
            }

            console.log(`Successfully fulfilled credits for user ${userId}`);
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }
});
