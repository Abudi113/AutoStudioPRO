
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        if (!stripeKey) throw new Error("Missing STRIPE_SECRET_KEY");

        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

        if (!supabaseUrl || !supabaseAnonKey) throw new Error("Missing Supabase configuration");

        const authHeader = req.headers.get("Authorization");
        if (!authHeader) throw new Error("Missing Authorization header");

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
        });

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) throw new Error("Invalid user session");

        const stripe = new Stripe(stripeKey, {
            apiVersion: "2023-10-16",
            httpClient: Stripe.createFetchHttpClient(),
        });

        const { priceId, mode = "payment", quantity = 1, successUrl, cancelUrl } = await req.json();

        if (!priceId) throw new Error("Missing priceId");

        console.log(`Creating ${mode} session for user ${user.id} and price ${priceId}`);

        const session = await stripe.checkout.sessions.create({
            line_items: [
                {
                    price: priceId,
                    quantity: quantity,
                },
            ],
            mode: mode,
            success_url: successUrl || `${req.headers.get("origin")}/dashboard?success=true`,
            cancel_url: cancelUrl || `${req.headers.get("origin")}/pricing`,
            customer_email: user.email,
            client_reference_id: user.id,
            metadata: {
                userId: user.id,
                priceId: priceId,
            }
        });

        return new Response(JSON.stringify({ url: session.url }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
