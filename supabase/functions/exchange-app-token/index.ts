import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { token } = await req.json();

        if (!token || typeof token !== "string" || token.trim().length === 0) {
            return new Response(
                JSON.stringify({ error: "Access token is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Use the service role key to bypass RLS and look up the token
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Look up the token in app_tokens table
        const { data: tokenRecord, error: tokenError } = await supabaseAdmin
            .from("app_tokens")
            .select("*")
            .eq("token", token.trim())
            .eq("is_active", true)
            .single();

        if (tokenError || !tokenRecord) {
            return new Response(
                JSON.stringify({ error: "Invalid or expired access token" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Update last_used_at
        await supabaseAdmin
            .from("app_tokens")
            .update({ last_used_at: new Date().toISOString() })
            .eq("id", tokenRecord.id);

        // Get the user from auth
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(
            tokenRecord.user_id
        );

        if (userError || !userData?.user) {
            return new Response(
                JSON.stringify({ error: "User not found for this token" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const userEmail = userData.user.email;
        if (!userEmail) {
            return new Response(
                JSON.stringify({ error: "User has no email address" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Generate a magic link - this returns the hashed token we can verify immediately
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: "magiclink",
            email: userEmail,
        });

        if (linkError || !linkData) {
            console.error("generateLink error:", linkError);
            return new Response(
                JSON.stringify({ error: "Failed to generate session: " + (linkError?.message || "unknown") }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Extract the token_hash from the generated link properties
        const tokenHash = linkData.properties?.hashed_token;

        if (!tokenHash) {
            console.error("No hashed_token in linkData:", JSON.stringify(linkData));
            return new Response(
                JSON.stringify({ error: "Failed to generate authentication token" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Immediately verify the OTP to get a real session
        const { data: verifyData, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
            token_hash: tokenHash,
            type: "magiclink",
        });

        if (verifyError || !verifyData?.session) {
            console.error("verifyOtp error:", verifyError, "data:", JSON.stringify(verifyData));
            return new Response(
                JSON.stringify({ error: "Failed to create session: " + (verifyError?.message || "no session returned") }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Return the session to the mobile app
        return new Response(
            JSON.stringify({
                access_token: verifyData.session.access_token,
                refresh_token: verifyData.session.refresh_token,
                expires_in: verifyData.session.expires_in,
                user: {
                    id: verifyData.session.user.id,
                    email: verifyData.session.user.email,
                },
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        console.error("Exchange token error:", err);
        return new Response(
            JSON.stringify({ error: "Internal server error: " + (err as Error).message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
