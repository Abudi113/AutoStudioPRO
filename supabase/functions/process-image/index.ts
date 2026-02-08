// Supabase Edge Function for Gemini AI image processing
// This keeps your API key secure on the server

// @ts-ignore
import { GoogleGenerativeAI } from "npm:@google/generative-ai";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Use the model we verified works in testing
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
            return new Response(JSON.stringify({ angle: result }), {
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
async function detectCarAngle(ai: GoogleGenerativeAI, base64Image: string): Promise<string> {
    console.log('🚀 Starting angle detection...');

    // Simple classification prompt
    const prompt = `Classify this car image into ONE category.
    
    Categories:
    - interior: steering wheel, dashboard, seats inside cabin
    - door_open: car with doors open
    - trunk_open: car with trunk/boot open
    - hood_open: car with hood/bonnet open
    - detail: close-up of wheel, headlight, or badge (no full car)
    - front: full car front view
    - rear: full car rear view
    - left: full car left side
    - right: full car right side
    - front_left_34: front diagonal view
    - front_right_34: front diagonal view
    - rear_left_34: rear diagonal view
    - rear_right_34: rear diagonal view
    
    Return ONLY the category name.`;

    try {
        const cleanBase64 = base64Image.includes(",") ? base64Image.split(",")[1] : base64Image;
        const model = ai.getGenerativeModel({ model: "gemini-1.5-pro-002" });

        const response = await model.generateContent({
            contents: [{
                role: "user",
                parts: [
                    { inlineData: { data: cleanBase64, mimeType: "image/png" } },
                    { text: prompt },
                ],
            }],
        });

        const result = response.response.text().trim().toLowerCase();
        console.log('✅ Detected angle:', result);

        // Clean up response to ensure it matches a valid key
        const validKey = [
            "interior", "door_open", "trunk_open", "hood_open", "detail",
            "front", "rear", "left", "right",
            "front_left_34", "front_right_34", "rear_left_34", "rear_right_34"
        ].find(k => result.includes(k));

        return validKey || "front";

    } catch (error) {
        console.error("❌ Detection failed, defaulting to front:", error);
        return "front";
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
    if (angle === "interior" || taskType === "interior") {
        return processGenAI(ai, originalBase64, studioImageBase64, branding, `
            Retouch this car interior. 
            Rules:
            1. Keep frame and geometry EXACTLY the same.
            2. Remove all outdoor reflections from windows/screens.
            3. Fix lighting to be soft neutral studio lighting.
            4. If windows show outside, replace view with the provided studio background.
            5. Output 4:3 aspect ratio.
        `);
    }

    // 2. Route to detail handling
    if (angle === "detail") {
        return processGenAI(ai, originalBase64, studioImageBase64, branding, `
            Composite this car detail shot into the studio.
            Rules:
            1. Keep the object geometry EXACTLY the same.
            2. Replace background with the provided studio environment.
            3. Remove harsh shadows and reflections.
            4. Output 4:3 aspect ratio.
        `);
    }

    // 3. Route to open car handling
    if (["door_open", "trunk_open", "hood_open"].includes(angle)) {
        return processGenAI(ai, originalBase64, studioImageBase64, branding, `
            Composite this car into the studio background.
            CRITICAL: The car doors/hood/trunk are OPEN. You MUST keep them OPEN exactly as they are.
            1. Segment the car perfectly.
            2. Place into the studio environment provided.
            3. Match lighting and shadows.
            4. Do NOT close the doors or change the car's state.
            5. Output 4:3 aspect ratio.
        `);
    }

    // 4. Default Exterior logic
    const anglePrompt = angle.replace(/_/g, " ");
    return processGenAI(ai, originalBase64, studioImageBase64, branding, `
        Composite this car into the provided studio background.
        Car Angle: ${anglePrompt}.
        
        Rules:
        1. Keep the car geometry, angle, and perspective EXACTLY 1:1.
        2. Remove the original background completely.
        3. Place car on the studio floor with realistic contact shadows.
        4. Remove outdoor reflections from paint and glass; replace with soft studio reflections.
        5. Neutralize lighting to 6500K studio white.
        6. Output 4:3 aspect ratio.
        ${branding?.isEnabled ? "7. Place the provided logo on the license plate area IF visible." : ""}
    `);
}

/** Generic generation function using Gemini 3 Pro (SDK) */
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

    console.log(`🎨 Generating with ${MODEL_IMAGE}...`);
    const model = ai.getGenerativeModel({ model: MODEL_IMAGE });

    try {
        const response = await model.generateContent({
            contents: [{ role: "user", parts }],
        });

        const candidate = response.response.candidates?.[0];
        const imagePart = candidate?.content?.parts?.find((p: any) => p.inlineData);

        if (!imagePart?.inlineData?.data) {
            console.error("No image in response:", JSON.stringify(response.response));
            throw new Error("AI successfully processed but returned no image data.");
        }

        return `data:image/png;base64,${imagePart.inlineData.data}`;
    } catch (err) {
        console.error("Gemini GenAI Error:", err);
        throw err;
    }
}
