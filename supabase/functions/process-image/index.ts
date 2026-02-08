// Supabase Edge Function for Gemini AI image processing
// This keeps your API key secure on the server

// @ts-ignore
import { GoogleGenerativeAI } from "npm:@google/generative-ai";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Use Gemini 3.0 Pro Image Preview for generation (Supports Image Output)
const MODEL_IMAGE = "gemini-3-pro-image-preview";

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const apiKey = Deno.env.get("GEMINI_API_KEY");
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY not configured");
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const { action, payload } = await req.json();

        if (action === "detect-angle") {
            console.log('🎯 Detect-angle action received');
            const result = await detectCarAngle(genAI, payload.base64Image);
            return new Response(JSON.stringify(result), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (action === "process-image") {
            const result = await processCarImage(
                genAI,
                payload.originalBase64,
                payload.studioImageBase64,
                payload.angle,
                payload.taskType,
                payload.branding
            );
            return new Response(JSON.stringify({ processedImage: result }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
    } catch (e) {
        console.error("Function error:", e);
        const errorMessage = e instanceof Error ? e.message : "Internal server error";
        return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: corsHeaders });
    }
});

/** Detect if image is interior, exterior, detail, or open car shot */
/** Detect if image is interior, exterior, detail, or open car shot */
async function detectCarAngle(ai: GoogleGenerativeAI, base64Image: string): Promise<{ angle: string; confidence: number }> {
    console.log('🚀 Starting angle detection with Gemini 1.5 Pro...');

    const prompt = `ROLE: Vision Classification System

TASK:
You must classify the input image into exactly ONE of the following categories:

- EXTERIOR_CAR
- INTERIOR_CAR
- DETAIL_CAR
- OTHER

DEFINITIONS:
- EXTERIOR_CAR: The outside of a vehicle is visible (body, doors, wheels, mirrors, headlights, exterior panels).
- INTERIOR_CAR: The inside of a vehicle is visible (seats, dashboard, steering wheel, center console, interior trim).
- DETAIL_CAR: Close-up or partial view of a vehicle component (wheel, headlight, badge, seat detail).
- OTHER: Image does not clearly show a vehicle interior or exterior.

STRICT RULES:
- Return ONLY valid JSON.
- Do NOT describe the image.
- Do NOT explain your decision.
- Do NOT suggest edits, enhancements, or generation.
- Do NOT mention lighting, studio, background, or quality.
- Do NOT assume context beyond what is visually dominant.

OUTPUT FORMAT (JSON ONLY):
{
  "category": "EXTERIOR_CAR | INTERIOR_CAR | DETAIL_CAR | OTHER",
  "confidence": 0.00
}

CONFIDENCE RULE:
- confidence = how visually dominant the category is in the image
- Use values between 0.00 and 1.00

FINAL CHECK:
- If the steering wheel, dashboard, or seats dominate → INTERIOR_CAR
- If the vehicle body or wheels dominate → EXTERIOR_CAR
- If unsure → use DETAIL_CAR or OTHER`;

    try {
        const cleanBase64 = base64Image.includes(",") ? base64Image.split(",")[1] : base64Image;
        // Use the latest stable Pro model for best vision reasoning
        const model = ai.getGenerativeModel({
            model: "gemini-1.5-pro",
            generationConfig: { responseMimeType: "application/json" } // Force JSON
        });

        const response = await model.generateContent({
            contents: [{
                role: "user",
                parts: [
                    { inlineData: { data: cleanBase64, mimeType: "image/png" } },
                    { text: prompt },
                ],
            }],
        });

        const text = response.response.text();
        console.log('✅ Visual Analysis Raw:', text);

        // Simple JSON parse (Gemini 1.5 Pro with responseMimeType usually returns clean JSON)
        const data = JSON.parse(text);
        const category = data.category?.toUpperCase() || "EXTERIOR_CAR";
        const confidence = typeof data.confidence === 'number' ? data.confidence : 0;

        console.log(`✅ Parsed Category: ${category} (Confidence: ${confidence})`);

        // Map to valid internal keys if needed, but we used the exact keys requested
        return { angle: category, confidence };

    } catch (error) {
        console.error("❌ Detection failed, defaulting to EXTERIOR_CAR:", error);
        return { angle: "EXTERIOR_CAR", confidence: 0 };
    }
}

/** Core processing logic routing */
async function processCarImage(
    ai: GoogleGenerativeAI,
    originalBase64: string,
    studioImageBase64: string,
    angle: string,
    taskType: string = "bg-replacement",
    branding?: { isEnabled?: boolean; logoUrl?: string | null }
): Promise<string> {
    // 1. Route to specialized interior handling
    if (angle === "INTERIOR_CAR" || angle === "interior" || taskType === "interior") {
        return processGenAI(ai, originalBase64, studioImageBase64, branding, `
            Retouch this car interior. 
            Rules:
            1. CRITICAL: Keep camera angle, frame, and perspective EXACTLY 1:1 with the original. Any change is a FAILURE.
            2. Remove all outdoor reflections from windows/screens.
            3. Fix lighting to be soft neutral studio lighting.
            4. If windows show outside, replace view with the provided studio background.
            5. If no windows are visible (or full interior shot), do NOT replace the background.
            6. Output 4:3 aspect ratio.
            7. The output must overlap perfectly with the original image.
        `);
    }

    // 2. Route to detail handling
    if (angle === "DETAIL_CAR" || angle === "detail") {
        return processGenAI(ai, originalBase64, studioImageBase64, branding, `
            Composite this car detail shot into the studio.
            Rules:
            1. CRITICAL: Keep object geometry, angle, and perspective EXACTLY 1:1. Any shift in view is a FAILURE.
            2. Replace background with the provided studio environment.
            3. Remove harsh shadows and reflections.
            4. Output 4:3 aspect ratio.
            5. The result must look distinctively like the original photo, just with a studio background.
        `);
    }

    // 3. Default Exterior logic (covers EXTERIOR_CAR, OTHER, and older keys)
    const anglePrompt = angle.replace(/_/g, " ").replace("CAR", "").trim();
    return processGenAI(ai, originalBase64, studioImageBase64, branding, `
        Composite this car into the provided studio background.
        Car View: ${anglePrompt}.
        
        Rules:
        1. CRITICAL: Keep the car geometry, angle, and perspective EXACTLY 1:1. Any rotation or camera move is a FAILURE.
        2. DAMAGED CARS: CRITICAL - PRESERVE ALL DAMAGE, RUST, DENTS, SCRATCHES, AND IMPERFECTIONS EXACTLY AS THEY ARE. DO NOT REPAIR THE VEHICLE.
        3. Remove the original background completely.
        4. Place car on the studio floor with realistic contact shadows.
        5. Remove outdoor reflections from paint and glass; replace with soft studio reflections.
        6. LIGHTING: Neutralize all sunlight and harsh shadows. Use soft, diffuse 6500K studio white lighting.
        7. Output 4:3 aspect ratio.
        ${branding?.isEnabled ? "8. Place the provided logo on the top left and on the the centre of the license plate area IF visible." : ""}
        9. The car must look IDENTICAL to the original file (including any damage), merely transported to a studio.
    `);
}

/** Generic generation function using Gemini SDK */
async function processGenAI(
    ai: GoogleGenerativeAI,
    image1Base64: string,
    image2Base64: string,
    branding: { isEnabled?: boolean; logoUrl?: string | null } | undefined,
    promptText: string
): Promise<string> {
    const clean1 = image1Base64.includes(",") ? image1Base64.split(",")[1] : image1Base64;
    const clean2 = image2Base64.includes(",") ? image2Base64.split(",")[1] : image2Base64;

    const parts: any[] = [
        { inlineData: { data: clean1, mimeType: "image/png" } },
        { inlineData: { data: clean2, mimeType: "image/png" } },
    ];

    if (branding?.isEnabled && branding?.logoUrl) {
        const cleanLogo = branding.logoUrl.includes(",") ? branding.logoUrl.split(",")[1] : branding.logoUrl;
        parts.push({ inlineData: { data: cleanLogo, mimeType: "image/png" } });
    }

    parts.push({ text: promptText });

    console.log(`🎨 Generating with ${MODEL_IMAGE} (SDK)...`);
    const model = ai.getGenerativeModel({
        model: MODEL_IMAGE,
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ]
    });

    try {
        const response = await model.generateContent({
            contents: [{ role: "user", parts }],
        });

        const candidate = response.response.candidates?.[0];
        const imagePart = candidate?.content?.parts?.find((p: any) => p.inlineData);

        if (!imagePart?.inlineData?.data) {
            console.error("FULL AI RESPONSE:", JSON.stringify(response, null, 2));

            const finishReason = candidate?.finishReason;
            const safetyRatings = candidate?.safetyRatings;
            const textPart = candidate?.content?.parts?.find((p: any) => p.text)?.text;

            throw new Error(`AI Failure. Model: ${MODEL_IMAGE}. FinishReason: ${finishReason}. Text: "${textPart?.substring(0, 50)}...". Check logs for full response.`);
        }

        return `data:image/png;base64,${imagePart.inlineData.data}`;
    } catch (err) {
        console.error("Gemini GenAI Error:", err);
        throw err;
    }
}
