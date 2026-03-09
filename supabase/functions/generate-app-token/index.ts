// Supabase Edge Function: generate-app-token
// Returns the user's permanent app access token.
// If one already exists, returns it. Otherwise creates a new one.
//
// Request: { access_token: string }
// Response: { token: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function generateShortToken(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 to avoid confusion
    const segments: string[] = [];
    for (let s = 0; s < 4; s++) {
        let segment = '';
        for (let i = 0; i < 4; i++) {
            segment += chars[Math.floor(Math.random() * chars.length)];
        }
        segments.push(segment);
    }
    return segments.join('-');
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

    try {
        const { access_token } = await req.json();

        if (!access_token) {
            return new Response(
                JSON.stringify({ error: 'Missing access_token' }),
                { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
            );
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Verify the user's access token
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(access_token);
        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: 'Invalid or expired session' }),
                { status: 401, headers: { ...CORS, "Content-Type": "application/json" } }
            );
        }

        // Check if user already has an active token
        const { data: existing } = await supabaseAdmin
            .from('app_tokens')
            .select('token')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .maybeSingle();

        if (existing?.token) {
            return new Response(
                JSON.stringify({ token: existing.token }),
                { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
            );
        }

        // Generate a new permanent token
        const token = generateShortToken();

        const { error: insertError } = await supabaseAdmin
            .from('app_tokens')
            .insert({
                user_id: user.id,
                token,
                is_active: true,
            });

        if (insertError) {
            console.error('Insert error:', insertError);
            return new Response(
                JSON.stringify({ error: 'Failed to store token' }),
                { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ token }),
            { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
        );

    } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return new Response(
            JSON.stringify({ error: msg }),
            { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
        );
    }
});
