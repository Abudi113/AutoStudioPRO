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
- DOOR_OPEN (Priority: Any car door is visibly open)
- TRUNK_OPEN (Priority: Trunk, tailgate, or boot is open)
- HOOD_OPEN (Priority: Hood/bonnet is open)
- OTHER

DEFINITIONS:
- EXTERIOR_CAR: The outside of a vehicle is visible and fully closed.
- INTERIOR_CAR: The inside of a vehicle is visible from the driver/passenger perspective.
- DETAIL_CAR: Close-up of a component (wheel, badge, headlight).
- DOOR_OPEN: A vehicle door is physically open, showing both exterior and partial interior.
- TRUNK_OPEN: The rear hatch or trunk is open.
- HOOD_OPEN: The engine bay is exposed via an open hood.
- OTHER: Not a vehicle.

STRICT RULES:
- PRIORITIZE "OPEN" categories if any component is open.
- Return ONLY valid JSON.
- Do NOT describe the image.

OUTPUT FORMAT (JSON ONLY):
{
  "category": "EXTERIOR_CAR | INTERIOR_CAR | DETAIL_CAR | DOOR_OPEN | TRUNK_OPEN | HOOD_OPEN | OTHER",
  "confidence": 0.00
}

FINAL CHECK:
- If a door is open → DOOR_OPEN
- If the trunk is open → TRUNK_OPEN
- If the hood is open → HOOD_OPEN
- If the steering wheel dominates → INTERIOR_CAR
- If the vehicle body dominates and is closed → EXTERIOR_CAR`;

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
            ROLE: AI IMAGE EXECUTION ENGINE (Master Retoucher)
            TASK: Precise Interior Enhancment & Rendering

            INPUTS: Image 1 (Car Interior), Image 2 (Studio Environment/Window View).

            STRICT EXECUTION RULES:
            1. PIXEL LOCK: Keep camera angle, frame, dashboard geometry, and steering wheel perspective EXACTLY 1:1 with the original. Any alteration to the car's structures is a CRITICAL FAILURE.
            2. LIGHTING NEUTRALIZATION: Remove all direct sunlight patches, sunbeams, and harsh directional shadows. Replace with soft, diffuse, 6500K neutral studio ambience.
            3. REFLECTION ERASURE: Erase all outdoor reflections from infotainment screens, digital clusters, piano black trim, and mirrors. Replace with clean studio gradients or solid blacks.
            4. WINDOW TREATMENT: Replace all visible outdoor scenery through windows with the provided Studio Environment (Image 2).
            5. GEOMETRY FIXATION: Do NOT "complete" the image or hallucinate unseen parts. If a component is cut off by the frame, it must stay cut off.
            6. OUTPUT SPEC: 4:3 Aspect Ratio.
            7. FAITHFULNESS: Every button, stitch, and trim pattern must remain IDENTICAL to the original.

            GOAL: A perfectly clean, studio-lit version of the original cabin.

        `);
    }

    // 2. Route to detail handling
    if (angle === "DETAIL_CAR" || angle === "detail") {
        return processGenAI(ai, originalBase64, studioImageBase64, branding, `
            ROLE: AI IMAGE EXECUTION ENGINE (Master Compositor)
            TASK: Precise Detail Shot Background Replacement

            INPUTS: Image 1 (Car Detail/Component), Image 2 (Studio Background).

            STRICT EXECUTION RULES:
            1. PIXEL LOCK: Keep object geometry, viewing angle, and perspective EXACTLY 1:1. The component must not rotate or shift.
            2. IDENTITY PRESERVATION: Maintain every detail of the original component (texture, wear, imperfections).
            3. STUDIO COMPOSITING: Replace the background with the provided Studio Environment (Image 2).
            4. LIGHTING: Remove harsh outdoor shadows and sunlight. Use soft, diffuse studio lighting.
            5. OUTPUT SPEC: 4:3 Aspect Ratio.

            GOAL: The original component, untouched, placed in a premium studio setting.
        `);
    }

    // 4. Default Exterior logic (FULL GENERATION PIPELINE)
    const anglePrompt = angle.replace(/_/g, " ").replace("CAR", "").trim();

    return processGenAI(ai, originalBase64, studioImageBase64, branding, `
        ROLE: AI IMAGE EXECUTION ENGINE (Professional Studio Retoucher)
        TASK: Deep Photo Retouching & Background Replacement (Tripod Locked)

        INPUTS:
        - RAW_FILE: Image 1 (Car). This is the "Base Layer".
        - STUDIO_PLATE: Image 2 (Studio Background). This is the "Background Layer".

        STRICT EDITING RULES:
        1. "TRIPOD LOCK": The camera MUST NOT MOVE. The car's geometry, angle, and perspective must be IDENTICAL to the RAW_FILE.
        2. "MASK & COMPOSE": Mask the car from Image 1. Place it into Image 2.
        3. "LIGHTING MATCH": Adjust the car's lighting to match the soft, white studio lights of Image 2.
        4. "REFLECTION CLEANUP": Remove trees/buildings from the car's reflections. Replace them with the white studio walls.
        5. "SHADOW CASTING": Cast a realistic shadow on the floor of Image 2.

        VERIFICATION:
        - If the car angle changes -> FAIL.
        - If the car looks like a cartoon -> FAIL.
        - If the background is not Image 2 -> FAIL.

        OUTPUT: High-fidelity photo-composite. 4:3 Aspect Ratio.
        ${branding?.isEnabled ? "BRANDING: Place the logo on the top left." : ""}
    `);
}

/** Generic generation function using Gemini SDK */
async function processGenAI(
    ai: GoogleGenerativeAI,
    image1Base64: string,
    image2Base64: string | null,
    branding: { isEnabled?: boolean; logoUrl?: string | null } | undefined,
    promptText: string
): Promise<string> {
    const clean1 = image1Base64.includes(",") ? image1Base64.split(",")[1] : image1Base64;

    const parts: any[] = [
        { inlineData: { data: clean1, mimeType: "image/png" } }
    ];

    if (image2Base64) {
        const clean2 = image2Base64.includes(",") ? image2Base64.split(",")[1] : image2Base64;
        parts.push({ inlineData: { data: clean2, mimeType: "image/png" } });
    }

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