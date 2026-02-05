// Supabase Edge Function for Gemini AI image processing
// This keeps your API key secure on the server

import { GoogleGenAI } from "npm:@google/genai@^1.38.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "https://carveoo.netlify.app",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL_IMAGE = "gemini-2.5-flash-image";

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

        const ai = new GoogleGenAI({ apiKey });

        const { action, payload } = await req.json();

        if (action === "detect-angle") {
            const result = await detectCarAngle(ai, payload.base64Image);
            return new Response(JSON.stringify({ angle: result }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (action === "process-image") {
            const result = await processCarImage(
                ai,
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

        return new Response(JSON.stringify({ error: "Unknown action" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Edge function error:", error);
        return new Response(
            JSON.stringify({ error: error.message || "Internal server error" }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});

/** Detect if image is interior or exterior */
async function detectCarAngle(ai: GoogleGenAI, base64Image: string): Promise<string> {
    const prompt = `
    Analyze this automotive photo and classify it into exactly one of the following categories:
    - front
    - rear
    - left
    - right
    - front_left_34
    - front_right_34
    - rear_left_34
    - rear_right_34
    - interior (Select this if the photo shows the inside of the car, dashboard, seats, or cabin)

    Return ONLY the label string.
  `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: base64Image.includes(",") ? base64Image.split(",")[1] : base64Image,
                            mimeType: "image/png",
                        },
                    },
                    { text: prompt },
                ],
            },
        });

        const detected = response.text?.trim().toLowerCase();
        const validAngles = [
            "front", "rear", "left", "right",
            "front_left_34", "front_right_34", "rear_left_34", "rear_right_34",
            "interior",
        ];

        return validAngles.includes(detected!) ? detected! : "front";
    } catch (error) {
        console.error("Detection Error:", error);
        return "front";
    }
}

/** Process car image with studio background */
async function processCarImage(
    ai: GoogleGenAI,
    originalBase64: string,
    studioImageBase64: string,
    angle: string,
    taskType: string = "bg-replacement",
    branding?: { isEnabled?: boolean; logoUrl?: string | null }
): Promise<string> {
    const hasLogo = Boolean(branding?.isEnabled && branding?.logoUrl);

    const taskPrompt = `
You are an AI that composites cars into studio environments. You must follow these steps IN ORDER.

#####################################################################
CRITICAL FIRST RULE - READ THIS BEFORE ANYTHING ELSE:
THE VIEWING ANGLE OF THE CAR MUST NOT CHANGE.
- If the input shows the REAR of the car → output must show the REAR
- If the input shows the FRONT of the car → output must show the FRONT  
- If the input shows the LEFT SIDE → output must show the LEFT SIDE
- If the input shows the RIGHT SIDE → output must show the RIGHT SIDE
- The angle is: "${angle}"
- DO NOT rotate the car. DO NOT show a different side. SAME ANGLE.
IF YOU CHANGE THE ANGLE, THE ENTIRE OUTPUT IS REJECTED.
#####################################################################

== STEP 1: UNDERSTAND INPUTS ==
- IMAGE 1 = The car photo. ANGLE: ${angle}. Keep this EXACT angle.
- IMAGE 2 = The studio (white infinity cove with gray floor - USE THIS EXACTLY)

== STEP 2: EXTRACT THE CAR ==
- Mentally segment the car from Image 1
- Keep EVERY pixel of the car's shape, angle, position
- Do NOT modify: scratches, dents, dirt, badges, wheels, glass tint

== STEP 3: PLACE INTO STUDIO ==
- Put the car into Image 2's environment
- Match the floor perspective and wall gradient EXACTLY from Image 2
- Add realistic contact shadow under tires
- Add subtle floor reflection (not mirror-sharp)

== STEP 4: REMOVE ALL SUNLIGHT (MANDATORY) ==
Scan the ENTIRE car surface for these and REMOVE them:
✗ Yellow/warm color cast on any panel
✗ Hard directional shadows (sun shadows)
✗ Bright hotspots on hood, roof, or trunk
✗ Blue sky tint in shadows
✗ Any lighting that comes from ONE direction

REPLACE WITH:
✓ Neutral 6500K white balance everywhere
✓ Soft, even illumination from large overhead softbox
✓ Gentle gradients, no harsh transitions

== STEP 5: REPLACE ALL REFLECTIONS (MANDATORY) ==
This is the MOST IMPORTANT step. Scan EVERY reflective surface:

FOR DARK/BLACK PAINT:
- Look at doors, fenders, hood, trunk lid
- If you see green (trees), blue (sky), brown (buildings), gray lines (road) → PAINT OVER with white/gray studio gradients
- The dark paint should show smooth white gradient from studio walls

FOR LIGHT/WHITE/SILVER PAINT:
- Reflections are subtle but check for color contamination
- Remove any warm yellow tones that indicate sun
- Should show neutral gray/white studio tones

FOR GLASS/WINDOWS:
- Remove any outdoor scenery visible through or reflected in glass
- Windows should show dark interior or white studio environment
- No trees, no sky, no buildings

FOR CHROME/TRIM:
- Remove colorful reflections
- Should show white/gray studio tones

== STEP 6: FINAL QUALITY CHECK ==
Before outputting, verify:
□ Is there ANY green/blue/brown color in the car's reflections? → If yes, go back to Step 5
□ Is there ANY warm yellow cast on the car? → If yes, go back to Step 4
□ Does the background match Image 2 exactly? → If no, go back to Step 3
□ Is the car shape/angle identical to Image 1? → If no, go back to Step 2

== LICENSE PLATE ==
${hasLogo ? "Replace plate with dealership logo plate." : "Make plate neutral gray/white."}

== OUTPUT ==
One photorealistic studio image. Return ONLY the image data.
`.trim();

    const parts: any[] = [
        {
            inlineData: {
                data: originalBase64.includes(",") ? originalBase64.split(",")[1] : originalBase64,
                mimeType: "image/png",
            },
        },
        {
            inlineData: {
                data: studioImageBase64.includes(",") ? studioImageBase64.split(",")[1] : studioImageBase64,
                mimeType: "image/png",
            },
        },
    ];

    if (hasLogo && branding?.logoUrl) {
        parts.push({
            inlineData: {
                data: branding.logoUrl.includes(",") ? branding.logoUrl.split(",")[1] : branding.logoUrl,
                mimeType: "image/png",
            },
        });
    }

    parts.push({ text: taskPrompt });

    const response = await ai.models.generateContent({
        model: MODEL_IMAGE,
        contents: { parts },
    });

    const candidate = response.candidates?.[0];
    const outPart = candidate?.content?.parts?.find((p: any) => p.inlineData?.data);

    if (!outPart?.inlineData?.data) {
        throw new Error("No image data returned from AI");
    }

    return `data:image/png;base64,${outPart.inlineData.data}`;
}
