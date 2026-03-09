// Supabase Edge Function: enterprise-inquiry
// Saves Enterprise contact form submissions to the enterprise_inquiries table.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: CORS });
    }

    try {
        const { name, email, company, phone, message } = await req.json();

        if (!name || !email) {
            return new Response(
                JSON.stringify({ error: "Name und E-Mail sind erforderlich." }),
                { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
            );
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const { error } = await supabase
            .from("enterprise_inquiries")
            .insert({
                name,
                email,
                company: company || null,
                phone: phone || null,
                message: message || null,
            });

        if (error) {
            console.error("Insert error:", error);
            return new Response(
                JSON.stringify({ error: "Fehler beim Speichern der Anfrage." }),
                { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ success: true }),
            { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
        );
    } catch (e) {
        console.error("Function error:", e);
        return new Response(
            JSON.stringify({ error: "Interner Serverfehler." }),
            { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
        );
    }
});
