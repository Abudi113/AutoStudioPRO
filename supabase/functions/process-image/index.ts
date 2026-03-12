// ============================================================
// AUTOMOTIVE STUDIO COMPOSITOR — Supabase Edge Function
// Optimized for consistency with Gemini image generation
// ============================================================

// @ts-ignore
import { GoogleGenerativeAI } from "npm:@google/generative-ai";

// -----------------------------------------------------------
// MODEL CONFIG
// -----------------------------------------------------------
const MODEL_IMAGE = "gemini-2.5-flash-image";
const MODEL_IMAGE_INTERIOR = "gemini-3.1-flash-image-preview";  // Interior detail model (Dev B)
//const MODEL_VISION = "gemini-1.5-pro";
//const MODEL_IMAGE = "gemini-3-pro-image-preview";
//const MODEL_VISION = "gemini-1.5-pro";
const MODEL_VISION = "gemini-2.5-flash";
const REMBG_API = "https://api.remove.bg/v1.0/removebg";
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 2000;

// -----------------------------------------------------------
// RETRY HELPER — exponential backoff for flaky model calls
// -----------------------------------------------------------
async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = RETRY_ATTEMPTS): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      const msg = err?.message || String(err);
      const is500 = msg.includes("500") || msg.includes("Internal Server Error") || msg.includes("internal error");
      const is429 = msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED");
      const isRetryable = is500 || is429;

      if (!isRetryable || i === attempts - 1) {
        console.error(`❌ [RETRY] ${label} failed after ${i + 1}/${attempts} attempts: ${msg.slice(0, 150)}`);
        throw err;
      }

      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, i) + Math.random() * 1000;
      console.warn(`⚠️ [RETRY] ${label} attempt ${i + 1}/${attempts} failed (${is500 ? '500' : '429'}). Retrying in ${Math.round(delay)}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error(`[RETRY] ${label}: should not reach here`);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// -----------------------------------------------------------
// ENTRY POINT
// -----------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKeysRaw = Deno.env.get("GEMINI_API_KEY");
    const removeBgKey = Deno.env.get("REMOVE_BG_API_KEY");

    if (!apiKeysRaw) throw new Error("GEMINI_API_KEY not configured");

    // Support comma-separated key pool for parallel load distribution
    const apiKeys = apiKeysRaw.split(",").map(k => k.trim()).filter(Boolean);
    const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];
    console.log(`🔑 [KEY-POOL] Using key ${apiKeys.indexOf(apiKey) + 1}/${apiKeys.length}`);

    const genAI = new GoogleGenerativeAI(apiKey);
    const { action, payload } = await req.json();



    // ── process-image ─────────────────────────────────────
    if (action === "process-image") {
      const result = await processCarImage(
        genAI,
        payload.originalBase64,
        payload.studioImageBase64,
        payload.angle,
        payload.branding,
        removeBgKey,
        payload.studioHints
      );
      return new Response(JSON.stringify({ processedImage: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: corsHeaders,
    });

  } catch (e) {
    console.error("Function error:", e);
    const msg = e instanceof Error ? e.message : "Internal server error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});



// -----------------------------------------------------------
// IMAGE CLASSIFICATION (Dev B)
// Returns: category, confidence, angle_family, quality_issues
// -----------------------------------------------------------
type ClassificationResult = {
  category: "EXTERIOR" | "EXTERIOR_DETAIL" | "INTERIOR" | "INTERIOR_DETAIL" | "REJECT";
  confidence: number;
  subject_type: string;
  angle_family: string;
  crop_lock: boolean;
  notes: string[];
  quality_issues: string[];
};

async function classifyImage(
  ai: GoogleGenerativeAI,
  originalBase64: string,
  originalAngle: string
): Promise<ClassificationResult> {
  try {
    const clean = stripDataPrefix(originalBase64);
    const model = ai.getGenerativeModel({
      model: MODEL_VISION,
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
    });
    const response = await model.generateContent({
      contents: [{
        role: "user",
        parts: [
          {
            text: [
              "Classify this automotive photo for a studio retouch pipeline.",
              "",
              "TASK 1 — CATEGORY: Choose from EXTERIOR, EXTERIOR_DETAIL, INTERIOR, INTERIOR_DETAIL, REJECT.",
              "  • EXTERIOR: any shot where the vehicle body (or significant portion of it) is visible from outside — including close-up front/rear/side shots, three-quarter views, and partial car shots where the vehicle fills most of the frame. When in doubt between EXTERIOR and EXTERIOR_DETAIL, prefer EXTERIOR.",
              "  • EXTERIOR_DETAIL: ONLY use this for an isolated single component shot — e.g. a wheel arch close-up with NO body panels visible, a badge close-up, or a headlight unit photographed in isolation. If the car body, bonnet, or door panels are visible anywhere in the frame, use EXTERIOR instead.",
              "  • INTERIOR: full cabin/interior shot.",
              "  • INTERIOR_DETAIL: close-up of a specific interior component (gauge cluster, stitching, screen, etc.).",
              "  • REJECT: no vehicle present, completely unusable.",
              "  crop_lock = true for detail shots or any view where crop must stay identical.",
              "  Use the provided angle only as a weak hint, never as the final truth.",
              "",
              "TASK 2 — QUALITY ISSUES: Inspect the photo carefully and list ALL quality problems present.",
              "  • photographer_visible: a person's hands, arms, body, or phone device is directly visible in the frame.",
              "  • photographer_reflection: the photographer's silhouette, hands, or phone is reflected in the car's painted panels, chrome trim, glass, mirrors, instrument-cluster glass, infotainment screens, glossy piano-black trim, glossy wood trim, or chrome bezels.",
              "  • camera_obstruction: a finger, phone case edge, or other object partially blocks the lens/frame edge.",
              "  • motion_blur: the image is blurry due to camera shake or movement during capture.",
              "  • out_of_focus: the main subject (vehicle/component) is soft or unfocused.",
              "  • severe_noise: the image is very grainy or noisy (typical of low-light phone shots).",
              "  • underexposed: the image is too dark to clearly see vehicle details.",
              "  • overexposed: large areas are blown out / pure white with lost detail.",
              "  • flash_glare: harsh flash reflection creates a bright glare spot on the vehicle surface.",
              '  • none: the image is clean with none of the above issues.',
              '  List every issue that is present. If the image is clean, return ["none"].',
              "",
              "OUTPUT — JSON only with these exact fields:",
              '{ "category": "EXTERIOR"|"EXTERIOR_DETAIL"|"INTERIOR"|"INTERIOR_DETAIL"|"REJECT",',
              '  "confidence": 0.0-1.0,',
              '  "subject_type": "full_vehicle"|"cabin"|"component"|"invalid",',
              '  "angle_family": "front"|"rear"|"side"|"three_quarter"|"interior"|"detail"|"unknown",',
              '  "crop_lock": true|false,',
              '  "notes": ["..."],',
              '  "quality_issues": ["none"|"photographer_visible"|"photographer_reflection"|...] }',
            ].join("\n"),
          },
          { text: `Original angle hint: ${originalAngle || "unknown"}` },
          { inlineData: { data: clean, mimeType: "image/jpeg" } },
        ],
      }],
    });
    const data = JSON.parse(response.response.text());
    console.log(`📊 [TOKENS] classifyImage → in:${response.response.usageMetadata?.promptTokenCount} out:${response.response.usageMetadata?.candidatesTokenCount} total:${response.response.usageMetadata?.totalTokenCount}`);
    console.log(`🔍 [CLASSIFY] category=${data.category} confidence=${data.confidence} angle=${data.angle_family} issues=${JSON.stringify(data.quality_issues)}`);

    return {
      category: data.category || "REJECT",
      confidence: typeof data.confidence === "number" ? data.confidence : 0,
      subject_type: data.subject_type || "invalid",
      angle_family: data.angle_family || "unknown",
      crop_lock: Boolean(data.crop_lock),
      notes: Array.isArray(data.notes) ? data.notes : [],
      quality_issues: Array.isArray(data.quality_issues) ? data.quality_issues : ["none"],
    };
  } catch (err) {
    console.warn("⚠️ [CLASSIFY] classifyImage failed:", err);
    return {
      category: "EXTERIOR",
      confidence: 0,
      subject_type: "full_vehicle",
      angle_family: "unknown",
      crop_lock: false,
      notes: ["classification failed — defaulting to EXTERIOR"],
      quality_issues: ["none"],
    };
  }
}

// -----------------------------------------------------------
// MAIN PIPELINE ROUTER
// -----------------------------------------------------------
async function processCarImage(
  ai: GoogleGenerativeAI,
  originalBase64: string,
  studioBase64: string,
  angle: string,
  branding?: { isEnabled?: boolean; logoUrl?: string | null },
  removeBgKey?: string,
  studioHints?: { lightingProfile?: string; studioTone?: string; floorFinish?: string; exposureNote?: string; platformType?: string; name?: string }
): Promise<string> {

  console.log(`\n════════════════════════════════════════════`);
  console.log(`🚀 [ROUTER] PIPELINE START — angle: ${angle}`);
  console.log(`════════════════════════════════════════════`);

  // Interior & Detail shots: no bg removal needed
  if (angle === "INTERIOR_CAR") {
    console.log("📷 [ROUTER] → Interior path");
    //const cleanedImage = await fixSunArtifacts(ai, originalBase64);
    //const result = await refineInterior(ai, cleanedImage, studioBase64, branding);
    const result = await refineInterior(ai, originalBase64, studioBase64, branding);
    console.log("✅ [ROUTER] PIPELINE COMPLETE");
    return result;
  }

  if (angle === "DETAIL_CAR") {
    console.log("✨ [ROUTER] → Detail path — classifying...");
    const classification = await classifyImage(ai, originalBase64, angle);
    const detailType = classification.category === "INTERIOR_DETAIL" || classification.category === "INTERIOR" ? "INTERIOR" : "EXTERIOR";
    console.log(`✨ [CLASSIFY] Detail sub-type: ${detailType} (raw: ${classification.category}, confidence: ${classification.confidence})`);
    if (detailType === "INTERIOR") {
      return refineDetailInterior(ai, originalBase64, studioBase64, branding, studioHints);
    } else {
      // Detail exterior: skip remove.bg — send original directly
      // remove.bg fails on tight close-ups, producing bad cutouts
      // that cause Gemini to hallucinate a full car (zoom-out bug)
      console.log("🔧 [DETAIL-EXT] Direct composite (no bg removal)");
      const carFixed = await fixReflectionsDetailExterior(ai, originalBase64);
      const result = await refineDetailExterior(
        ai,
        carFixed,
        studioBase64,
        angle,
        branding
      );

      console.log("✅ [ROUTER] PIPELINE COMPLETE");
      return result;
    }
  }

  if (angle === "INTERIOR_DETAIL_CAR") {
    console.log("🔎 [ROUTER] → Interior Detail path (explicit angle)");
    return refineDetailInterior(ai, originalBase64, studioBase64, branding, studioHints);
  }

  // AUTO or unknown angle — classify first, then route
  if (angle === "AUTO" || !angle) {
    console.log("🔍 [ROUTER] AUTO — running classification...");
    const classification = await classifyImage(ai, originalBase64, angle || "AUTO");
    console.log(`🔍 [CLASSIFY] Result: ${classification.category} (confidence: ${classification.confidence}, angle: ${classification.angle_family}, issues: ${JSON.stringify(classification.quality_issues)})`);

    if (classification.category === "INTERIOR") {
      console.log("📷 [ROUTER] AUTO → Interior");
      const result = await refineInterior(ai, originalBase64, studioBase64, branding);
      console.log("✅ [ROUTER] PIPELINE COMPLETE");
      return result;
    }
    if (classification.category === "INTERIOR_DETAIL") {
      console.log("🔎 [ROUTER] AUTO → Interior Detail");
      return refineDetailInterior(ai, originalBase64, studioBase64, branding, studioHints);
    }
    if (classification.category === "EXTERIOR_DETAIL") {
      console.log("✨ [ROUTER] AUTO → Exterior Detail");
      const carFixed = await fixReflectionsDetailExterior(ai, originalBase64);
      const result = await refineDetailExterior(ai, carFixed, studioBase64, angle, branding);
      console.log("✅ [ROUTER] PIPELINE COMPLETE");
      return result;
    }
    if (classification.category === "REJECT") {
      console.warn("❌ [ROUTER] AUTO → REJECT — fallback to Exterior");
    }
    // Confidence guard: if classified as EXTERIOR but confidence is low, prefer interior (safer pipeline)
    if (classification.category === "EXTERIOR" && classification.confidence < 0.7) {
      console.warn(`⚠️ [ROUTER] AUTO → EXTERIOR but low confidence (${classification.confidence}) — rerouting to Interior as safety fallback`);
      const result = await refineInterior(ai, originalBase64, studioBase64, branding);
      console.log("✅ [ROUTER] PIPELINE COMPLETE");
      return result;
    }
    // EXTERIOR or REJECT fallthrough → exterior pipeline below
    console.log("🚗 [ROUTER] AUTO → Exterior");
  }

  // Exterior path: remove bg → composite JSON → AI studio compositor
  // Wrapped with fallback: if model detects interior shot, re-route automatically
  try {
    console.log("📸 [EXTERIOR] Step 1/3: Background removal");
    const carNoBg = await removeBackground(originalBase64, removeBgKey);
    const carFixed = await fixReflections(ai, carNoBg);

    console.log("🎨 [EXTERIOR] Step 2/3: Packaging composite payload");
    const compositePayload = JSON.stringify({
      car: carFixed, //carNoBg,
      background: studioBase64,
      operation: "composite",
    });

    console.log("✨ [EXTERIOR] Step 3/3: AI studio compositor");
    const result = await refineExterior(ai, compositePayload, angle, branding);

    console.log("✅ [ROUTER] PIPELINE COMPLETE\n");
    return result;
  } catch (extErr: any) {
    const errMsg = (extErr?.message || String(extErr)).toLowerCase();
    if (errMsg.includes("interior") || errMsg.includes("steering wheel") || errMsg.includes("not the full car") || errMsg.includes("not a full car")) {
      console.warn("⚠️ [ROUTER] Exterior pipeline detected interior shot — re-routing to Interior pipeline...");
      const result = await refineInterior(ai, originalBase64, studioBase64, branding);
      console.log("✅ [ROUTER] PIPELINE COMPLETE (re-routed from Exterior → Interior)");
      return result;
    }
    throw extErr; // Re-throw if it's a different error
  }
}

// -----------------------------------------------------------
// STEP 1.5 — REFLECTION FIX
// -----------------------------------------------------------
async function fixReflections(ai: GoogleGenerativeAI, carBase64: string): Promise<string> {
  const clean = stripDataPrefix(carBase64);
  const model = ai.getGenerativeModel({
    model: MODEL_IMAGE,
    generationConfig: { temperature: 0.35, topP: 0.6, topK: 20, candidateCount: 1 },
  });
  try {
    const response = await model.generateContent({
      contents: [{
        role: "user", parts: [
          {
            text: `Remove all environment-specific reflections from this car's paint.
Strip: dealership walls, indoor ceiling colors, window light streaks, floor color bleed, any location-specific color visible in the paint.
Replace with: neutral flat mid-tone reflections — no color, no warmth, no coolness.
Keep everything else identical — shape, color, plate, lights, wheels.
The goal is a clean neutral base so the final compositor can apply correct reflections from the actual studio background.` },
          { inlineData: { data: clean, mimeType: "image/png" } },
        ]
      }],
    });
    const imagePart = response.response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    console.log(`   [TOKENS][fixReflections] input:${response.response.usageMetadata?.promptTokenCount} output:${response.response.usageMetadata?.candidatesTokenCount} total:${response.response.usageMetadata?.totalTokenCount}`);

    if (!imagePart?.inlineData?.data) return carBase64;
    return `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`;
  } catch {
    return carBase64;
  }
}

async function fixReflectionsDetail(ai: GoogleGenerativeAI, carBase64: string): Promise<string> {
  const clean = stripDataPrefix(carBase64);
  const model = ai.getGenerativeModel({
    model: MODEL_IMAGE,
    generationConfig: { temperature: 0.1, topP: 0.3, topK: 5, candidateCount: 1 },
  });
  try {
    const response = await model.generateContent({
      contents: [{
        role: "user", parts: [
          {
            text: `Remove environment-specific reflections from this close-up car component photo.

⚠ FRAMING IS LOCKED — this is a cropped close-up, NOT a full car shot:
- DO NOT zoom out or show more of the car than is visible
- DO NOT complete or extend any partially visible edges
- Output must be the EXACT same crop and framing as input

ONLY remove these reflections from the paint/surfaces:
- Sky, clouds, outdoor reflections visible in the paint
- Concrete wall or building reflections
- Sunlight patches or outdoor light streaks

Replace with: neutral flat mid-tone — no color, no warmth, no coolness.
Keep everything else pixel-identical — same crop, same zoom, same edges.` },
          { inlineData: { data: clean, mimeType: "image/png" } },
        ]
      }],
    });
    const imagePart = response.response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    if (!imagePart?.inlineData?.data) return carBase64;
    return `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`;
  } catch {
    return carBase64;
  }
}

async function fixReflectionsDetailExterior(ai: GoogleGenerativeAI, carBase64: string): Promise<string> {
  const clean = stripDataPrefix(carBase64);
  const model = ai.getGenerativeModel({
    model: MODEL_IMAGE,
    generationConfig: { temperature: 0.65, topP: 0.4, topK: 10, candidateCount: 1 },
  });
  try {
    const response = await model.generateContent({
      contents: [{
        role: "user", parts: [
          {
            text: `THIS IS A REFLECTION CLEANUP TASK ONLY — NOT A COMPOSITING TASK.

⚠ FRAMING IS ABSOLUTELY LOCKED:
- Output must be pixel-for-pixel the same crop, zoom, and framing as the input
- DO NOT zoom out under any circumstances
- DO NOT show more of the car than is visible in the input
- DO NOT extend or complete partially visible edges or panels
- DO NOT reframe or recompose in any way
- The only thing that changes is surface reflections — nothing else

REMOVE ALL OF THESE from painted surfaces — ZERO TOLERANCE:

• CIRCULAR CEILING LIGHT HOTSPOTS — bright round white/yellow spots on hood, roof, or any panel
  caused by dealership overhead spotlights or ceiling lights → REMOVE COMPLETELY
  Replace with: smooth paint gradient matching the surrounding panel color and tone
  There must be NO round bright patches anywhere on any panel after this step

• FLUORESCENT STRIP REFLECTIONS — long linear bright streaks from indoor strip lighting → REMOVE
• Any rectangular or linear bright patch from indoor lighting fixtures → REMOVE
• Indoor ceiling tile patterns or grid reflections visible in paint → REMOVE
• Dealership wall colors, banners, or logos reflected in paint → REMOVE
• Warm orange/amber floor glow on lower panels → REMOVE
• Floor tile patterns or grout lines reflected in lower panels → REMOVE
• Window light patches and daylight streaks → REMOVE
• ANY shape, pattern, or color that belongs to the original shooting location → REMOVE

AFTER REMOVAL — the paint surface must show ONLY:
• Smooth clean gloss with natural paint color
• Subtle natural body contour gradients — darker in recessed areas, lighter on raised surfaces
• NO round hotspots, NO linear streaks, NO location-specific shapes anywhere

⚠ DO NOT change the car's paint color
⚠ DO NOT flatten or remove natural gloss — keep the paint looking glossy and rich
⚠ DO NOT turn glossy paint into matte
⚠ Natural specular highlights that follow the body contour shape are fine — keep them
⚠ Only remove LOCATION-SPECIFIC artifacts — not the car's natural finish

KEEP UNCHANGED:
• Original paint color — fully saturated, unchanged
• All badges, plates, trim, lights exactly as they are
• Metallic flake texture and clearcoat depth
• Same crop. Same zoom. Same framing. Only reflections change.`,
          },
          { inlineData: { data: clean, mimeType: "image/png" } },
        ]
      }],
    });
    const imagePart = response.response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    console.log(`   [TOKENS][fixReflectionsDetailExterior] input:${response.response.usageMetadata?.promptTokenCount} output:${response.response.usageMetadata?.candidatesTokenCount} total:${response.response.usageMetadata?.totalTokenCount}`);

    if (!imagePart?.inlineData?.data) return carBase64;
    console.log("Reflection cleanup applied");
    return `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`;
  } catch {
    return carBase64;
  }
}

async function fixReflectionsInterior(
  ai: GoogleGenerativeAI,
  imageBase64: string
): Promise<string> {

  const clean = stripDataPrefix(imageBase64);

  const model = ai.getGenerativeModel({
    model: MODEL_IMAGE,
    generationConfig: {
      temperature: 0.15,
      topP: 0.30,
      topK: 10,
      candidateCount: 1,
    },
  });

  try {
    const response = await model.generateContent({
      contents: [{
        role: "user",
        parts: [
          {
            text: `THIS IS A REFLECTION CLEANUP TASK ONLY.

You are editing the EXTERIOR body panels visible in this interior/boot shot.
The car has exterior panels visible (rear quarters, bumper, boot lid) that have reflections from the original shooting location — outdoor daylight, street reflections, building reflections, showroom lighting.

YOUR ONLY JOB:
Remove all location-specific reflections from the EXTERIOR BODY PANELS only.

REMOVE from exterior painted surfaces:
- Outdoor daylight streaks and sky reflections in the paint
- Street, building, or tree reflections in the paint  
- Showroom ceiling or wall colors visible in the paint
- Warm or cool color casts from the original location environment
- Any shape or color that belongs to the shooting location visible in the paint

REPLACE WITH:
- Neutral flat mid-tone on each panel — no color, no warmth, no coolness
- Smooth clean gloss with no location-specific artifacts
- The goal is a neutral base so the studio compositor can apply correct reflections

DO NOT TOUCH:
❌ Anything inside the car — carpet, seats, trim, panels — leave completely unchanged
❌ The tail lights / lamp units — leave exactly as-is
❌ The camera framing — do not zoom, crop, or reframe
❌ The car's paint base color — only remove location reflections, not the color itself
❌ Natural gloss and specular highlights that are part of the paint finish`
          },
          { inlineData: { data: clean, mimeType: "image/jpeg" } },
        ]
      }],
    });

    const imagePart = response.response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    if (!imagePart?.inlineData?.data) return imageBase64;

    console.log("   ✓ Interior reflection fix applied");
    return `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`;

  } catch (err) {
    console.warn("   ⚠ Reflection fix failed, using original:", err);
    return imageBase64;
  }
}

// -----------------------------------------------------------
// STEP 1 — BACKGROUND REMOVAL
// -----------------------------------------------------------


async function removeBackground(
  imageBase64: string,
  apiKey?: string
): Promise<string> {

  const clean = stripDataPrefix(imageBase64);

  if (apiKey) {
    try {
      console.log("   remove.bg API...");
      const fd = new FormData();
      fd.append("image_file_b64", clean);
      fd.append("size", "auto");
      fd.append("format", "png");

      const res = await fetch(REMBG_API, {
        method: "POST",
        headers: { "X-Api-Key": apiKey },
        body: fd,
      });

      if (res.ok) {
        const buf = await res.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...Array.from(new Uint8Array(buf))));
        console.log("   ✓ remove.bg success");
        return `data:image/png;base64,${b64}`;
      }
      console.warn("   remove.bg non-OK, falling back");
    } catch (err) {
      console.warn("   remove.bg error:", err);
    }
  }

  // Fallback: return original (AI compositor handles bg implicitly)
  console.log("   ⚠ Using original (no bg key or remove.bg failed)");
  return imageBase64;
}

async function removeBackgroundDetailShot(
  imageBase64: string,
  apiKey?: string
): Promise<string> {
  const clean = stripDataPrefix(imageBase64);

  console.log(`   Input prefix: ${imageBase64.substring(0, 50)}`);
  console.log(`   Clean base64 start: ${clean.substring(0, 50)}`);
  console.log(`   Clean base64 length: ${clean.length}`);

  if (apiKey) {
    try {
      console.log("   remove.bg detail shot (standard)...");

      // Detect actual mime type from magic bytes
      const headerBytes = Uint8Array.from(atob(clean.slice(0, 20)), c => c.charCodeAt(0));
      let mimeType = "image/jpeg";
      if (headerBytes[0] === 0x89 && headerBytes[1] === 0x50) mimeType = "image/png";
      else if (headerBytes[0] === 0xFF && headerBytes[1] === 0xD8) mimeType = "image/jpeg";
      else if (headerBytes[0] === 0x52 && headerBytes[1] === 0x49) mimeType = "image/webp";
      console.log(`   Detected mime type: ${mimeType}`);

      const byteArray = Uint8Array.from(atob(clean), c => c.charCodeAt(0));
      const blob = new Blob([byteArray], { type: mimeType });
      const ext = mimeType.split("/")[1];

      const fd = new FormData();
      fd.append("image_file", blob, `car.${ext}`);
      fd.append("size", "auto");
      fd.append("format", "png");

      const res = await fetch(REMBG_API, {
        method: "POST",
        headers: { "X-Api-Key": apiKey },
        body: fd,
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`   remove.bg detail shot failed: ${res.status} — ${errText}`);
      } else {
        const buf = await res.arrayBuffer();
        const responseBytes = new Uint8Array(buf);
        let b64 = "";
        const chunkSize = 8192;
        for (let i = 0; i < responseBytes.length; i += chunkSize) {
          const chunk = responseBytes.subarray(i, i + chunkSize);
          let chunkStr = "";
          for (let j = 0; j < chunk.length; j++) {
            chunkStr += String.fromCharCode(chunk[j]);
          }
          b64 += chunkStr;
        }
        b64 = btoa(b64);
        console.log("   ✓ remove.bg detail shot success");
        return `data:image/png;base64,${b64}`;
      }
    } catch (err) {
      console.warn("   remove.bg detail shot error:", err);
    }
  }

  console.log("   ⚠ Using original (no bg key or remove.bg failed)");
  return imageBase64;
}

async function removeBackgroundDetail(
  imageBase64: string,
  apiKey?: string
): Promise<string> {
  const clean = stripDataPrefix(imageBase64);

  if (apiKey) {
    try {
      console.log("   ClipDrop API for detail shot...");
      const blob = new Blob(
        [Uint8Array.from(atob(clean), c => c.charCodeAt(0))],
        { type: "image/jpeg" }
      );
      const fd = new FormData();
      fd.append("image_file", blob, "car.jpg");

      const res = await fetch("https://clipdrop-api.co/remove-background/v1", {
        method: "POST",
        headers: { "x-api-key": apiKey },
        body: fd,
      });

      if (res.ok) {
        const buf = await res.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...Array.from(new Uint8Array(buf))));
        console.log("   ✓ ClipDrop success");
        return `data:image/png;base64,${b64}`;
      }
      console.warn("   ClipDrop non-OK, falling back");
    } catch (err) {
      console.warn("   ClipDrop error:", err);
    }
  }

  console.log("   ⚠ Using original");
  return imageBase64;
}

// -----------------------------------------------------------
// STEP 3 — EXTERIOR STUDIO COMPOSITOR
// Key fix: single, focused prompt with no contradictions
// -----------------------------------------------------------
async function refineExterior(
  ai: GoogleGenerativeAI,
  compositedData: string,
  angle: string,
  branding?: { isEnabled?: boolean; logoUrl?: string | null }
): Promise<string> {

  let carImage: string;
  let studioImage: string;

  try {
    const data = JSON.parse(compositedData);
    carImage = data.car;
    studioImage = data.background;
  } catch {
    carImage = compositedData;
    studioImage = "";
  }

  const isOpen = angle.includes("OPEN");

  const promptRole = `You are an automotive studio compositor.
Your tools are: background replacement, lighting adjustment, surface reflection editing, and ground shadow generation.
You do NOT retouch, repair, redesign, or restructure vehicles in any way.`;

  const promptTargetVision = `TARGET OUTPUT VISION:
The car must look like it was originally photographed in the studio environment shown in Image 2.
Study Image 2 carefully — its floor color, wall color, lighting color, brightness, and mood.
Every decision you make must be driven by what Image 2 looks like — not by any assumed studio style.
The final result must feel like a single cohesive photograph taken in that exact environment.`;

  const promptTaskBackground = `═══ TASK A — BACKGROUND REPLACEMENT ═══
Replace EVERYTHING that is NOT the car with the studio environment from Image 2.
- Preserve the car's silhouette, position, and camera angle exactly — do NOT reframe
- Blend the car's edges smoothly into the floor and walls of Image 2 — no hard cutout lines
- The floor from Image 2 extends naturally beneath and around all four corners of the car
- Match the ambient colour temperature at the car's edges to the environment in Image 2`;

  const promptTaskReflections = `═══ TASK B — SURFACE REFLECTION UPDATE ═══

STEP 1 — READ IMAGE 2: Study the studio background carefully.
Note its dominant light color (warm, cool, neutral), brightness, and floor color.
All reflections you apply to the car must come from THIS environment — not from a generic white studio.

STEP 2 — READ IMAGE 1: Identify the car's paint color (black, white, grey, silver, red, blue, etc.)

STEP 3 — STRIP ALL ORIGINAL ENVIRONMENT REFLECTIONS from every body panel:
These must always be removed regardless of paint color or shooting angle:
- Dealership walls, banners, logos visible in the paint → REMOVE
- Ceiling tiles, fluorescent strips, indoor lighting colors → REMOVE
- Window light streaks, natural daylight patches → REMOVE
- Warm orange/amber floor glow on lower panels → REMOVE
- Any color belonging to the original shooting location → REMOVE

STEP 4 — APPLY REFLECTIONS FROM IMAGE 2's ENVIRONMENT:
The reflection color, brightness, and tone must match Image 2's lighting — not assumed white:

FOR LIGHT PAINT (white, silver, light grey, champagne):
- Upper panel edge: bright highlight streak matching Image 2's light source color
- Main panel: smooth horizontal gradient in Image 2's ambient tone
- Lower panel: slightly deeper, fading toward floor color from Image 2

FOR MEDIUM PAINT (grey, graphite, dark silver, bronze, brown):
- Upper panel edge: sharp highlight streak from Image 2's light source
- Shoulder crease: secondary thinner highlight along body line
- Main panel: neutral mid-tone matching Image 2's ambient color temperature
- Lower panel: deeper tone fading down — no warm bleed unless Image 2 floor is warm

FOR DARK PAINT (black, dark navy, dark green, dark red):
- Upper panel edge: sharp narrow highlight from Image 2's light source
- Shoulder crease: second thinner streak along body crease
- Everything else: deep intentional dark — correct for dark paint
- Only permit warm tones if Image 2's environment is genuinely warm-toned
- If Image 2 is neutral/cool — NO amber, NO orange anywhere on dark panels

FOR BRIGHT/SATURATED PAINT (red, blue, yellow, orange, green):
- Keep base color fully saturated — do not grey it out
- Highlights blend naturally from Image 2's light source color into the base hue
- No foreign color mixing into the base hue

APPLY TO ALL SURFACES EQUALLY — front, sides, AND rear panels must all match:
- Rear panels and trunk lid are most likely to retain original environment reflections — treat with extra care
- Chrome/trim: clean highlight from Image 2's light source, no original environment bleed
- Glass/windscreen: faint reflection of Image 2's ceiling/upper environment
- Tail lights and head lights: keep their natural color — do not alter`;

  const promptTaskLighting = `═══ TASK C — LIGHTING MATCH ═══
Match the car's lighting to Image 2's environment exactly:
- Study Image 2 — is the lighting warm, cool, or neutral? Bright or moody? Directional or diffuse?
- Apply that same lighting character to the car body
- Remove all original directional shadows or harsh highlights from the car
- Metallic/glossy paint must hold mid-tone detail — do NOT blow any surface to pure featureless white or black
- The car's overall brightness and color temperature must match Image 2 seamlessly
- The car must not look pasted in from a different exposure or lighting environment`;

  const promptTaskShadows = `═══ TASK D — SHADOW & GROUNDING ═══
Ground the car physically in the floor shown in Image 2:

Study Image 2's floor — note its color, reflectivity, and any existing shadows or markings.
All grounding elements must be consistent with that floor.

Tyre contact shadows (required for each visible tyre):
- Darkest exactly at rubber-to-floor contact point
- Softens and fades outward naturally — consistent with Image 2's lighting direction
- Each tyre must look compressed against the floor, not hovering

Vehicle undercar shadow:
- Soft shadow fans outward from under the chassis
- Darkness and spread consistent with Image 2's lighting intensity
- Blends naturally into the floor — no sharp outer boundary

Floor reflection (if Image 2's floor is glossy or reflective):
- Add a subtle reflection of the car's lower surfaces in the floor
- Match the reflectivity level visible in Image 2 — do not add gloss if Image 2 floor is matte

If Image 2 has a turntable ring or floor markings — include them naturally beneath the car.`;

  const promptPreservation = `═══ WHAT MUST NEVER CHANGE ═══

❌ Camera angle — locked from Image 1
   Whatever angle is in Image 1 (front, rear, side, 3/4, diagonal) — output must match exactly
   Any angle change = automatic failure

❌ Car orientation — no mirroring or flipping of any kind
   Every visible feature must be on the same side as in Image 1

❌ Car geometry — proportions, shape, and all body panels unchanged

❌ Damage — every scratch, dent, crumple, and broken piece stays fully visible
   Do NOT repair, smooth, heal, or hide any damage

❌ Paint colour — base hue is fixed, do not shift it

❌ ${angle.includes("OPEN") ? "Open positions — doors/trunk/hood open in Image 1 STAY open" : "Closed state — all doors, hood, and trunk stay closed as in Image 1"}

❌ Attached objects — number plates, tow bars, stickers all stay on

❌ Interior — cabin completely unchanged

LICENCE PLATE RULE:
If a licence plate is visible in Image 1 — reproduce it exactly in the output.
Same characters, same colors, same position on the car.
If the plate is not visible from the shooting angle — do not invent one.`;

  const promptOutputSpec = `═══ OUTPUT SPECIFICATION ═══
- Aspect ratio: 4:3 (landscape)
- Car occupies 75–80% of frame width — comfortable breathing room on all sides
- Final image must feel like a single professional studio photograph taken in Image 2's environment — not a composite
${branding?.isEnabled ? "• BRANDING: Place the logo (Image 3) in the top-left corner — small and unobtrusive" : ""}`;
  //console.log(`   [BRANDING] isEnabled:${branding?.isEnabled} applyToPlate:${branding?.applyToPlate} hasLogo:${!!branding?.logoUrl}`);
  // -----------------------------------------------------------
  // FINAL ASSEMBLY — this is your newPrompt
  // Reorder sections here to shift model priority weighting.
  // -----------------------------------------------------------
  const newPrompt = [
    promptRole,
    promptTargetVision,
    promptTaskReflections,
    promptTaskBackground,
    promptTaskLighting,
    promptTaskShadows,
    promptPreservation,
    promptOutputSpec,
  ].join("\n\n");

  return generateImage(ai, carImage, studioImage, branding, newPrompt);
}

// -----------------------------------------------------------
// INTERIOR REFINEMENT
// -----------------------------------------------------------
// async function refineInterior(
//     ai: GoogleGenerativeAI,
//     image: string,
//     studio: string,
//     branding?: { isEnabled?: boolean; logoUrl?: string | null }
// ): Promise<string> {

//     const prompt = `You are an automotive interior photography specialist.

// YOUR ONLY JOB:
// Replace everything visible OUTSIDE the car (through windows, openings) with the studio
// environment from Image 2. Everything inside the car stays pixel-perfect identical.

// KEEP UNCHANGED:
// - All interior surfaces: seats, carpet, door panels, dashboard, trim, cargo area
// - Interior lighting and shadows exactly as they appear
// - Camera angle and framing

// REPLACE:
// - Outdoor/street background visible through windows → studio environment (Image 2)
// - Match the ambient light color inside the car softly to the studio temperature

// PROHIBITIONS:
// :x: Do not change anything inside the car
// :x: Do not alter interior lighting strength
// :x: Do not add or remove interior elements
// :x: Do not change the camera angle

// OUTPUT: Aspect ratio 4:3
// ${branding?.isEnabled ? "\nBRANDING: Logo (Image 3) top-left corner, small." : ""}`;

//     return generateImage(ai, image, studio, branding, prompt);
// }

// -----------------------------------------------------------
// INTERIOR STUDIO COMPOSITOR
// Mirrors refineExterior exactly — same structure, different prompt.
// The car has bg removed. Place it into the studio background
// and match interior lighting/ambience to that environment.
// -----------------------------------------------------------
// -----------------------------------------------------------
// INTERIOR STUDIO COMPOSITOR
// ⚠ DOES NOT use generateImage() — builds parts array manually.
// generateImage() labels Image 1 as "car, preserve geometry exactly"
// which causes Gemini to render the full exterior car body.
// Interior shots need "interior/boot shot" framing labels so Gemini
// knows to ONLY replace the background through openings, not repaint the car.
// -----------------------------------------------------------

// -----------------------------------------------------------
// INTERIOR STUDIO COMPOSITOR
// ⚠ DOES NOT use generateImage() — builds parts array manually.
// generateImage() labels Image 1 as "car, preserve geometry exactly"
// which causes Gemini to render the full exterior car body.
// Interior shots need "interior/boot shot" framing labels so Gemini
// knows to ONLY replace the background through openings, not repaint the car.
// Generic prompts — works for ANY interior shot type:
// boot/trunk, cabin, driver seat, rear seat, dashboard, door-open, etc.
// -----------------------------------------------------------

async function decodePNG(base64: string): Promise<{ width: number; height: number; pixels: Uint8Array }> {
  const clean = base64.includes(",") ? base64.split(",")[1] : base64;
  const bytes = Uint8Array.from(atob(clean), c => c.charCodeAt(0));

  // Use browser-compatible approach: fetch as blob and createImageBitmap
  // In Deno, we use the built-in DecompressionStream for zlib

  // Parse PNG chunks
  let offset = 8; // Skip PNG signature
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idatChunks: Uint8Array[] = [];

  while (offset < bytes.length) {
    const chunkLen = (bytes[offset] << 24 | bytes[offset + 1] << 16 | bytes[offset + 2] << 8 | bytes[offset + 3]) >>> 0;
    const chunkType = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    const chunkData = bytes.slice(offset + 8, offset + 8 + chunkLen);

    if (chunkType === "IHDR") {
      width = (chunkData[0] << 24 | chunkData[1] << 16 | chunkData[2] << 8 | chunkData[3]) >>> 0;
      height = (chunkData[4] << 24 | chunkData[5] << 16 | chunkData[6] << 8 | chunkData[7]) >>> 0;
      bitDepth = chunkData[8];
      colorType = chunkData[9];
    } else if (chunkType === "IDAT") {
      idatChunks.push(chunkData);
    } else if (chunkType === "IEND") {
      break;
    }

    offset += 12 + chunkLen;
  }

  // Decompress IDAT data using DecompressionStream
  const combined = new Uint8Array(idatChunks.reduce((acc, c) => acc + c.length, 0));
  let pos = 0;
  for (const chunk of idatChunks) {
    combined.set(chunk, pos);
    pos += chunk.length;
  }

  const ds = new DecompressionStream("deflate");
  const writer = ds.writable.getWriter();
  writer.write(combined);
  writer.close();

  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const rawSize = (width * (colorType === 6 ? 4 : 3) + 1) * height;
  const raw = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
  pos = 0;
  for (const chunk of chunks) { raw.set(chunk, pos); pos += chunk.length; }

  // Apply PNG filter reconstruction
  const channels = colorType === 6 ? 4 : (colorType === 2 ? 3 : 4);
  const stride = width * channels;
  const pixels = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    const filterType = raw[y * (stride + 1)];
    const rowStart = y * (stride + 1) + 1;
    const prevRowStart = (y - 1) * (stride + 1) + 1;

    for (let x = 0; x < stride; x++) {
      const rawByte = raw[rowStart + x];
      const left = x >= channels ? raw[rowStart + x - channels] : 0;
      const up = y > 0 ? raw[prevRowStart + x] : 0;
      const upLeft = y > 0 && x >= channels ? raw[prevRowStart + x - channels] : 0;

      let val = rawByte;
      if (filterType === 1) val = (rawByte + left) & 0xFF;
      else if (filterType === 2) val = (rawByte + up) & 0xFF;
      else if (filterType === 3) val = (rawByte + Math.floor((left + up) / 2)) & 0xFF;
      else if (filterType === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft);
        val = (rawByte + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)) & 0xFF;
      }
      raw[rowStart + x] = val;

      const pixelIdx = (y * width + Math.floor(x / channels)) * 4;
      const channel = x % channels;
      if (channels === 4) {
        pixels[pixelIdx + channel] = val;
      } else {
        pixels[pixelIdx + channel] = val;
        if (channel === 2) pixels[pixelIdx + 3] = 255;
      }
    }
  }

  return { width, height, pixels };
}

// -----------------------------------------------------------
// COMPOSITE: car original + studio background using alpha mask
// For each pixel: alpha > 10 = car pixel (keep original), else = background pixel (use studio)
// -----------------------------------------------------------
async function compositeInterior(
  originalBase64: string,      // Original photo (with background still present)
  carNoBgBase64: string,       // Car with background removed (has alpha channel)
  studioBase64: string         // Studio background to place behind car
): Promise<string> {

  console.log("   Decoding images for pixel compositing...");

  try {
    const [carMask, studio] = await Promise.all([
      decodePNG(carNoBgBase64),
      decodePNG(studioBase64),
    ]);

    // Also decode original to get correct interior pixels
    const original = await decodePNG(originalBase64);

    const { width, height } = carMask;
    const result = new Uint8Array(width * height * 4);

    // Scale studio to match car dimensions if needed
    const scaleX = studio.width / width;
    const scaleY = studio.height / height;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const alpha = carMask.pixels[idx + 3]; // Alpha from remove.bg mask

        if (alpha > 10) {
          // Car pixel — use from ORIGINAL (not the masked version, to preserve colors)
          result[idx] = original.pixels[idx];
          result[idx + 1] = original.pixels[idx + 1];
          result[idx + 2] = original.pixels[idx + 2];
          result[idx + 3] = 255;
        } else {
          // Background pixel — use studio
          const sx = Math.min(Math.floor(x * scaleX), studio.width - 1);
          const sy = Math.min(Math.floor(y * scaleY), studio.height - 1);
          const si = (sy * studio.width + sx) * 4;
          result[idx] = studio.pixels[si];
          result[idx + 1] = studio.pixels[si + 1];
          result[idx + 2] = studio.pixels[si + 2];
          result[idx + 3] = 255;
        }
      }
    }

    // Encode result back to PNG base64
    const encoded = await encodePNG(result, width, height);
    console.log("   ✓ Pixel compositing complete");
    return `data:image/png;base64,${encoded}`;

  } catch (err) {
    console.warn("   Pixel compositing failed, falling back to original:", err);
    return originalBase64;
  }
}

// -----------------------------------------------------------
// MINIMAL PNG ENCODER
// Encodes raw RGBA pixels back to PNG base64
// -----------------------------------------------------------
async function encodePNG(pixels: Uint8Array, width: number, height: number): Promise<string> {
  const channels = 4;
  const stride = width * channels;

  // Apply no filter (type 0) for each row — simplest valid PNG
  const raw = new Uint8Array((stride + 1) * height);

  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // Filter type: None
    raw.set(pixels.slice(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }

  // Compress with deflate
  const cs = new CompressionStream("deflate");
  const writer = cs.writable.getWriter();
  writer.write(raw);
  writer.close();

  const reader = cs.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const compressed = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
  let pos = 0;
  for (const chunk of chunks) { compressed.set(chunk, pos); pos += chunk.length; }

  // CRC32 — fixed: no reserved keyword conflict
  const crc32 = (data: Uint8Array): number => {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
      }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  };

  const writeChunk = (type: string, data: Uint8Array): Uint8Array => {
    const typeBytes = new TextEncoder().encode(type);
    const chunk = new Uint8Array(12 + data.length);
    const dv = new DataView(chunk.buffer);
    dv.setUint32(0, data.length);
    chunk.set(typeBytes, 4);
    chunk.set(data, 8);
    const crcInput = new Uint8Array(4 + data.length);
    crcInput.set(typeBytes);
    crcInput.set(data, 4);
    dv.setUint32(8 + data.length, crc32(crcInput));
    return chunk;
  };

  // IHDR chunk
  const ihdrData = new Uint8Array(13);
  const ihdrDv = new DataView(ihdrData.buffer);
  ihdrDv.setUint32(0, width);
  ihdrDv.setUint32(4, height);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = writeChunk("IHDR", ihdrData);
  const idatChunk = writeChunk("IDAT", compressed);
  const iendChunk = writeChunk("IEND", new Uint8Array(0));

  // Assemble final PNG
  const totalSize = signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
  const png = new Uint8Array(totalSize);
  pos = 0;
  for (const part of [signature, ihdrChunk, idatChunk, iendChunk]) {
    png.set(part, pos);
    pos += part.length;
  }

  // Encode to base64
  let binary = "";
  for (let i = 0; i < png.length; i++) binary += String.fromCharCode(png[i]);
  return btoa(binary);
}

async function fixSunArtifacts(
  ai: GoogleGenerativeAI,
  imageBase64: string
): Promise<string> {

  const clean = stripDataPrefix(imageBase64);

  // Auto-detect mime type from base64 magic bytes
  const header = atob(clean.slice(0, 16));
  const mimeType = (header.charCodeAt(0) === 0x89 && header.charCodeAt(1) === 0x50)
    ? "image/png"
    : "image/jpeg";

  const model = ai.getGenerativeModel({
    model: MODEL_IMAGE,
    generationConfig: {
      temperature: 0.15,
      topP: 0.25,
      topK: 15,
      candidateCount: 1,
    },
  });

  try {
    const response = await model.generateContent({
      contents: [{
        role: "user",
        parts: [
          {
            text: `THIS IS A SUN ARTIFACT REMOVAL TASK ONLY.

This interior car photo was taken outdoors with direct sunlight entering through windows.
Sunlight has created uneven lighting artifacts on interior surfaces.
Your ONLY job is to remove them. Nothing else changes.

═══ HOW TO IDENTIFY SUN ARTIFACTS ═══

The key test: same material, different brightness = sun artifact.

Look at every material type in the image (leather seats, fabric, carpet, door panels).
For each material, compare all areas of that same material against each other.

If one area of the same material is significantly BRIGHTER, WARMER, or more WASHED-OUT
than other areas of the exact same material — that bright area is a sun artifact.

The correct reference color for that material = the darker, more neutral areas of the same material
where direct sunlight is NOT hitting.

Sun artifacts appear as:
- A bright or warm patch on part of a seat when the rest of the same seat is darker/cooler
- A diagonal streak of light crossing a surface
- A washed-out bleached area on leather or fabric
- A dark shadow stripe from a window frame cutting across a surface

═══ HOW TO FIX ═══

For each artifact:
1. Find the correct tone: look at the SAME material in areas not affected by sunlight
2. That unaffected area = the true color and brightness of that material
3. Apply that true tone to the artifact zone
4. Preserve all texture, stitching, quilting, grain underneath
5. After fixing: all areas of the same material must look identical in brightness and color

MATCHING RULE — this is the success criterion:
Every area of the same material must end up at the same brightness and color tone.
Seats of the same leather must match each other.
Carpet on left must match carpet on right.
No part of any surface should be notably brighter or warmer than the rest of that same surface.

═══ WHAT NEVER CHANGES ═══
❌ Crop and framing — unchanged
❌ All interior structure — seats, panels, belts, trim — exact positions
❌ Windows and outdoor areas — do not touch
❌ Natural 3D shadows from seat shape/folds — these are correct depth cues, leave them
❌ Texture, stitching, quilting — preserved underneath every correction`
          },
          { inlineData: { data: clean, mimeType } },
        ]
      }],
    });

    const imagePart = response.response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    if (!imagePart?.inlineData?.data) {
      console.warn("   ⚠ fixSunArtifacts: no output, using original");
      return imageBase64;
    }

    console.log("   ✓ Sun artifacts removed");
    console.log(`   [TOKENS][fixSunArtifacts] input:${response.response.usageMetadata?.promptTokenCount} output:${response.response.usageMetadata?.candidatesTokenCount} total:${response.response.usageMetadata?.totalTokenCount}`);
    return `data:${imagePart.inlineData.mimeType || "image/jpeg"};base64,${imagePart.inlineData.data}`;

  } catch (err) {
    console.warn("   ⚠ fixSunArtifacts failed, using original:", err);
    return imageBase64;
  }
}

// feb 26

// async function refineInterior(
//     ai: GoogleGenerativeAI,
//     originalBase64: string,
//     studioBase64: string,
//     branding?: { isEnabled?: boolean; logoUrl?: string | null }
// ): Promise<string> {

//     const cleanOriginal = stripDataPrefix(originalBase64);
//     const cleanStudio = stripDataPrefix(studioBase64);

//     const prompt = `You are a professional photo retoucher working on a car interior photograph.

// ⚠️ CRITICAL — READ BEFORE ANYTHING ELSE:
// Image 1 is an INTERIOR photograph of a car.
// Your output must show the EXACT same view as Image 1 — same framing, same angle, same interior.
// DO NOT generate any exterior car view.
// DO NOT output a full car image from outside.
// DO NOT hallucinate or invent anything not visible in Image 1.
// Output must be a retouched version of Image 1 — nothing else.
// If output shows exterior of car — AUTOMATIC FAILURE.

// ═══════════════════════════════════════════════
// TASK 1 — REPLACE ALL OUTDOOR ENVIRONMENT
// ═══════════════════════════════════════════════

// Scan every part of Image 1 and identify ALL areas where outdoor environment is visible.
// Outdoor environment includes: sky, buildings, street, road, parked cars, trees, fences, people, or any exterior scene.

// Outdoor can appear in any of these locations — check ALL of them:
// - Through the windscreen (front glass)
// - Through side windows (left side, right side)
// - Through the rear window
// - Through any open door or boot opening
// - Reflected in the rear view mirror
// - Reflected in side mirrors if visible
// - Visible through any mesh, grille, or partition panel
// - Any other location where outdoor is visible

// For every outdoor area found, replace it with Image 2's studio environment:
// - Match Image 2's wall/background color for upper areas
// - Match Image 2's floor color for lower areas
// - Apply Image 2's lighting tone at the edges where indoor meets the replaced area
// - Blend seamlessly — no hard edges, no visible cutlines at glass frames

// For reflective surfaces (rear view mirror, side mirrors):
// - Replace the outdoor reflection with Image 2's studio environment
// - Keep the mirror shape, frame, and mount exactly as they are

// ═══════════════════════════════════════════════
// TASK 2 — CLEAN ALL INTERIOR SURFACES
// ═══════════════════════════════════════════════

// Clean every interior surface to showroom condition:

// - Leather and upholstery: remove dust, fingerprints, scuff marks, smudges. Restore premium supple appearance. Preserve all stitching and quilting patterns exactly.
// - Hard plastics and trim: remove fingerprints and smudges. Restore finish (gloss stays gloss, matte stays matte).
// - Carpet and floor mats: remove dirt, scuff marks, compression marks. Restore even texture.
// - Chrome and metal elements: polish to clean highlight.
// - Dashboard, steering wheel, centre console: remove dust and fingerprints. Do not alter any component layout or controls.
// - Seat belts: keep exactly as-is including any coloured elements.
// - Screens and displays: keep displayed content exactly as-is — do not alter what is shown on any screen.

// Remove any text watermarks, dealer names, addresses, or overlaid text visible in Image 1.

// ═══════════════════════════════════════════════
// TASK 3 — APPLY STUDIO LIGHTING
// ═══════════════════════════════════════════════

// Study Image 2's lighting character — its colour temperature (warm/cool/neutral), brightness, and direction.

// CRITICAL — REMOVE ALL OUTDOOR LIGHTING ARTIFACTS FIRST:

// ⚠ THIS IMAGE HAS ALREADY BEEN PRE-PROCESSED TO REMOVE SUN ARTIFACTS.
// DO NOT add any bright patches, directional light, or uneven lighting onto any seat surface.
// Seats must remain exactly as they appear in Image 1 — your job is ONLY background replacement and studio lighting application.

// - HARSH DIRECTIONAL SHADOWS:
// Look for strong dark shadows cast across seats, door panels, carpet, or any surface by sunlight entering through windows — these appear as dark diagonal or horizontal stripes across surfaces.
// Remove every shadow completely. Replace with the surface's natural even tone. No directional dark bands anywhere.

// After removing both artifacts, every seat and surface must be evenly lit — uniform tone throughout, no bright patches, no dark stripes, no directional gradients from any outdoor light source.

// THEN apply studio lighting:
// - Overall brightness LOWER than Image 1 — darker, moodier, premium feel
// - Reduce exposure by approximately 15-25% compared to Image 1
// - Dark surfaces (black, grey) should go deeper and richer, not lighter
// - Apply Image 2's ambient colour temperature softly across all surfaces
// - Top surfaces catch slightly more light, recessed areas naturally darker
// - Chrome and metal: clean single highlight streak

// ⚠ CRITICAL — DO NOT RE-INTRODUCE DIRECTIONAL WINDOW LIGHT:
// There may be a bright window or light source visible on the LEFT or RIGHT side of the frame.
// Do NOT use this as a lighting reference for the seats.
// Do NOT paint any bright diagonal band, streak, or gradient onto any seat surface based on window light direction.
// Studio lighting is PERFECTLY EVEN and DIFFUSE — seats must show uniform tone, not lit from one side.

// The result must feel like even diffuse studio softboxes — not sunlight through a window.

// ═══════════════════════════════════════════════
// TASK 4 — ENHANCE COLOUR AND VIBRANCY
// ═══════════════════════════════════════════════

// Make all interior materials look premium and rich:
// - All leather/upholstery colours become richer but same tone — supple and luxurious
// - Dark surfaces (black plastic, dark carpet) become deep and defined — not flat or grey
// - Light surfaces (cream leather, beige headliner) become rich and warm — not blown out
// - Overall image should feel like a luxury car brochure — dramatic, not clinical
// - Contrast should be higher — deep darks, rich mids, controlled highlights- All colours become richer versions of themselves — no hue shifting
// - Final image should have higher contrast overall — not flat or evenly lit
// - Think: dark studio with focused lighting, not a bright showroom

// Apply subtle micro-contrast — leather grain, stitching, carpet texture all look crisp and tactile.

// ═══════════════════════════════════════════════
// STRICT PRESERVATION RULES
// ═══════════════════════════════════════════════

// These must never change:

// OUTPUT FRAMING:
// - Output must contain the complete frame of Image 1 — same dimensions, same aspect ratio
// - Nothing cropped — full left edge, full right edge, full top, full bottom all preserved
// - Camera angle and perspective are identical to Image 1

// INTERIOR STRUCTURE:
// - Every component stays in its exact position — nothing moves, nothing is added, nothing is removed
// - Dashboard layout: every vent, button, knob, trim strip — exact position and design
// - Steering wheel: exact shape and all controls
// - Centre console: exact shape and all controls
// - Seats: exact position, shape, and colour
// - All smaller elements: hooks, handles, clips, seatbelt anchors, buttons — exact position

// COLOURS:
// - Every surface colour is locked — only gets richer, never shifts to a different colour
// - Seat colour locked (orange stays orange, cream stays cream, black stays black)
// - Dashboard colour locked
// - Carpet colour locked
// - Headliner colour locked

// GLASS AND FRAMES:
// - All window frames, rubber seals, and pillars stay exactly as in Image 1
// - Only the outdoor content through the glass changes — the frame itself does not

// ═══════════════════════════════════════════════
// OUTPUT REQUIREMENTS
// ═══════════════════════════════════════════════

// - Same framing and dimensions as Image 1
// - All outdoor replaced with Image 2's studio environment
// - All reflective surfaces (mirrors) show studio environment instead of outdoor
// - Interior clean, bright, vibrant — professional studio quality
// - Photorealistic — not CGI or illustrated
// - No text watermarks or dealer overlays
// ${branding?.isEnabled ? "- Place the branding logo (Image 3) in the top-left corner, small and unobtrusive" : ""}`;

//     const parts: any[] = [
//         { text: prompt },
//         {
//             //text: "Image 1 — Original car interior photo to be retouched:"
//             text: "Image 1 — INTERIOR PHOTO TO RETOUCH (do not generate exterior car, only retouch this exact interior view):"
//         },
//         //{ inlineData: { data: cleanOriginal, mimeType: "image/jpeg" } },
//         //{ inlineData: { data: cleanOriginal, mimeType: originalBase64.includes("image/png") ? "image/png" : "image/jpeg" } },
//         { inlineData: { data: cleanOriginal, mimeType: cleanOriginal.slice(0, 16) && atob(cleanOriginal.slice(0, 16)).charCodeAt(0) === 0x89 ? "image/png" : "image/jpeg" } },
//         {
//             text: "Image 2 — Studio background. Use its environment, colours, and lighting to replace all outdoor areas in Image 1:"
//         },
//         { inlineData: { data: cleanStudio, mimeType: "image/jpeg" } },
//         //{ inlineData: { data: cleanStudio, mimeType: originalBase64.includes("image/png") ? "image/png" : "image/jpeg" } },
//     ];

//     if (branding?.isEnabled && branding?.logoUrl) {
//         parts.push(
//             { text: "Image 3 — Branding logo to place top-left:" },
//             { inlineData: { data: stripDataPrefix(branding.logoUrl), mimeType: "image/png" } }
//         );
//     }

//     const model = ai.getGenerativeModel({
//         model: MODEL_IMAGE,
//         safetySettings: [
//             { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
//             { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
//             { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
//             { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
//         ],
//         generationConfig: {
//             temperature: 0.20,
//             topP: 0.30,
//             topK: 20,
//             candidateCount: 1,
//         },
//     });

//     const response = await model.generateContent({
//         contents: [{ role: "user", parts }],
//     });

//     const candidate = response.response.candidates?.[0];
//     const imagePart = candidate?.content?.parts?.find((p: any) => p.inlineData);

//     console.log(`   [TOKENS][refineInterior] input:${response.response.usageMetadata?.promptTokenCount} output:${response.response.usageMetadata?.candidatesTokenCount} total:${response.response.usageMetadata?.totalTokenCount}`);

//     if (!imagePart?.inlineData?.data) {
//         throw new Error(`Interior refinement failed. FinishReason: ${candidate?.finishReason || "UNKNOWN"}`);
//     }

//     const mimeType = imagePart.inlineData.mimeType || "image/png";
//     return `data:${mimeType};base64,${imagePart.inlineData.data}`;
// }

// feb 27

// async function refineInterior(
//     ai: GoogleGenerativeAI,
//     originalBase64: string,
//     studioBase64: string,
//     branding?: { isEnabled?: boolean; logoUrl?: string | null }
// ): Promise<string> {

//     const cleanOriginal = stripDataPrefix(originalBase64);
//     const cleanStudio = stripDataPrefix(studioBase64);

// //     const prompt = `You are a professional automotive photo retoucher.

// // ⚠️ CRITICAL — THIS IS AN INTERIOR CAR PHOTO:
// // Image 1 is an interior photograph of a car.
// // Output must show the EXACT same interior view — same framing, same angle, same crop.
// // DO NOT generate any exterior car view. DO NOT output a full car from outside.
// // Output is a retouched version of Image 1 — nothing else.

// // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// // ⛔ ZERO-TOLERANCE CHECKLIST — VERIFY BEFORE OUTPUT
// // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// // Before finalising the output, confirm ALL of these are true:

// // ☑ REAR VIEW MIRROR — the glass contains ONLY studio environment, zero outdoor content
// // ☑ LEFT SIDE MIRROR (if visible) — the glass contains ONLY studio environment
// // ☑ RIGHT SIDE MIRROR (if visible) — the glass contains ONLY studio environment
// // ☑ WINDSCREEN AREA — no white sky, no grey sky, no buildings, no outdoor light bleed
// // ☑ ALL WINDOWS — no outdoor scene visible through any glass
// // ☑ SUN RAYS — no bright diagonal or horizontal light streaks across any interior surface
// // ☑ SKY GLOW — no white/grey sky brightness bleeding onto the headliner, dashboard, or seats
// // ☑ DEALER TEXT — no overlaid address, name, or watermark text anywhere
// // ☑ INTERIOR DARKNESS — black leather looks deep black (not grey), dark plastics look near-black

// // If ANY item above is still present = output failure. Fix it before rendering.

// // ═══════════════════════════════════════════════
// // TASK 1 — ERASE ALL OUTDOOR FROM WINDOWS
// // ═══════════════════════════════════════════════

// // Scan Image 1 for every window opening — windscreen, side windows, rear window, open doors.
// // Every pixel of sky, road, building, parked car, tree, or outdoor scene visible through glass must be replaced.

// // Replacement content = Image 2's studio environment:
// // - Sky/upper zone → Image 2's wall or background color
// // - Lower zone → Image 2's floor color
// // - Transition blends naturally — no hard line at the glass edge or pillar

// // ⚠ The white or grey sky area visible through the windscreen is OUTDOOR. It must be fully replaced.
// // Do not leave any white/grey/bright patch in the windscreen area — replace completely with studio.

// // ═══════════════════════════════════════════════
// // TASK 2 — OVERWRITE ALL MIRROR GLASS WITH STUDIO
// // ═══════════════════════════════════════════════

// // THIS IS MANDATORY. Every mirror in the image must be updated. No exceptions.

// // STEP 1 — LOCATE EVERY MIRROR:
// // - Rear view mirror: mounted at top of windscreen or on ceiling — typically a rectangular mirror facing the driver. In this camera angle it appears near the top-centre of the frame.
// // - Right door mirror / wing mirror: visible on the right side of the frame through the passenger window or A-pillar area — a small convex mirror in a housing.
// // - Left door mirror / wing mirror: visible on the left edge of the frame if the camera angle shows it.
// // - Any other reflective mirror surfaces present.

// // STEP 2 — FOR EACH MIRROR GLASS, DO THIS:
// // The mirror glass currently shows outdoor content (buildings, cars, road, sky, parking lot).
// // You must PAINT OVER the entire mirror glass area with Image 2's studio environment.
// // - Fill the mirror glass with a natural-looking studio reflection: upper portion = Image 2's wall/ceiling tone, lower portion = Image 2's floor tone
// // - The fill must look like a genuine mirror reflection of a studio — not a flat color block
// // - Subtle depth and gradient within the mirror glass — darker corners, slightly lighter centre
// // - Match Image 2's color temperature inside the mirror glass

// // STEP 3 — MIRROR FRAME AND HOUSING:
// // - Keep the physical mirror frame, stem, mounting bracket, and housing exactly as-is
// // - Only the glass reflection content changes — nothing else on the mirror moves or changes shape

// // ⚠ ENFORCEMENT: After completing Task 2, zoom into each mirror in your internal render.
// // If you can see a building, a car, a road, a sky, or any outdoor content in any mirror glass — redo it.
// // The output is only acceptable when every mirror glass shows studio environment exclusively.

// // ═══════════════════════════════════════════════
// // TASK 3 — ELIMINATE ALL SUN RAY ARTIFACTS
// // ═══════════════════════════════════════════════

// // Sun rays, sunlight streaks, and sky-glow are present in Image 1. Remove all of them.

// // WHAT TO LOOK FOR AND REMOVE:
// // - Bright diagonal or horizontal light bands crossing seats, dashboard, or door panels
// // - Warm orange/yellow sun patches on leather or fabric surfaces
// // - Harsh bright zone on the headliner from sky light coming through windscreen
// // - White/bright overexposed glow on the dashboard top surface from window light
// // - Any area where one part of a surface is significantly brighter than the same material elsewhere

// // HOW TO REMOVE:
// // For each artifact:
// // 1. Find the same material in a nearby area NOT affected by sunlight — that is the correct reference tone
// // 2. Paint over the artifact zone with the correct reference tone for that material
// // 3. Preserve all texture, grain, stitching underneath — only the brightness/color cast changes
// // 4. After fix: the entire material surface must be uniform — no patch should stand out as brighter or warmer

// // SUCCESS CRITERION: Every seat, every panel, every surface shows even uniform tone throughout.
// // No patch anywhere should be noticeably brighter, warmer, or more washed-out than its surroundings.

// // ═══════════════════════════════════════════════
// // TASK 4 — DARKEN AND ENRICH THE INTERIOR
// // ═══════════════════════════════════════════════

// // ⚠ CRITICAL WARNING — READ BEFORE APPLYING:
// // Image 2's studio background is a PLAIN WHITE WALL. This is just the background environment.
// // DO NOT use the background brightness as a reference for the interior lighting.
// // The interior of the car must be significantly DARKER than that white background.
// // The white background behind the car does NOT mean the car interior should be bright.
// // Ignore the background brightness entirely when deciding how dark to make the interior.

// // TARGET LOOK: The interior must look like it was photographed inside a dark professional studio
// // with controlled softbox lighting — not outdoors, not in a bright showroom.
// // Think luxury car brochure — moody, deep, rich. Not bright, not flat, not washed out.

// // EXPOSURE — BE AGGRESSIVE:
// // - The current Image 1 interior is OVEREXPOSED from outdoor light. It looks washed out.
// // - You must correct this heavily. Reduce overall interior brightness by 35-45%.
// // - This is a strong correction — the interior in Image 1 is much too bright.
// // - After correction: black leather should look deep true black, not grey
// // - After correction: dark plastics should look nearly black, not mid-grey
// // - After correction: the dashboard should look dark and moody, not light grey
// // - Shadows under seats, in recesses, in door pockets: fully deep black
// // - Only the very tops of surfaces catch any highlight — everything else stays dark

// // COLORS — MAKE THEM RICH AND SATURATED:
// // - Every surface color becomes a richer, more saturated version of itself
// // - Black leather: deep, lustrous true black with subtle sheen — not grey, not flat
// // - Dark grey plastics: deep charcoal, not washed-out mid-grey
// // - Any brown/tan tones: rich warm depth, not beige or faded
// // - Chrome and metal: clean sharp highlight against dark surroundings
// // - No hue shifting — same color family, just richer and deeper

// // CONTRAST — HIGH AND DRAMATIC:
// // - Shadows: crush them deep — recesses and under-surfaces go to near-black
// // - Midtones: rich and defined — material texture fully visible
// // - Highlights: tight and controlled — only small bright points on chrome and top edges
// // - The difference between the darkest and lightest areas must be large
// // - Result: dramatic, three-dimensional, luxury feel

// // VIBRANCY:
// // - Increase color saturation noticeably across all surfaces
// // - Leather grain, stitching lines, carpet weave all look sharp and tactile
// // - Every material looks premium — not flat, not clinical, not overlit

// // SUCCESS CHECK — before finalising Task 4:
// // Is the black leather actually deep black (not grey)? → If still grey, darken more.
// // Are the dark plastics near-black (not mid-grey)? → If still mid-grey, darken more.
// // Does the overall interior feel moody and premium? → If still looks bright/flat, darken more.

// // ═══════════════════════════════════════════════
// // TASK 5 — APPLY STUDIO AMBIENT TONE
// // ═══════════════════════════════════════════════

// // ⚠ The studio background (Image 2) may be plain white — do NOT copy its brightness onto the interior.
// // Only take its COLOR TEMPERATURE (warm/cool/neutral) — not its exposure level.

// // Apply Image 2's ambient color temperature very softly across all interior surfaces:
// // - If Image 2 is neutral/cool white: apply a subtle cool-neutral cast — clean and crisp
// // - If Image 2 is warm: apply a very subtle warm undertone to leather and soft surfaces
// // - Chrome and metal: clean single narrow highlight streak
// // - Top surfaces catch slightly more light, deep recesses stay dark
// // - The color temperature tint should be subtle — the main effect is from Task 4's darkening

// // ═══════════════════════════════════════════════
// // STRICT PRESERVATION RULES — NEVER CHANGE THESE
// // ═══════════════════════════════════════════════

// // ❌ Output framing — same dimensions, same crop, same angle as Image 1
// // ❌ Every interior component — exact position, nothing moves, nothing added, nothing removed
// // ❌ Dashboard, steering wheel, centre console — exact layout
// // ❌ All surface colors — only get richer, never shift hue
// // ❌ Window frames, rubber seals, pillars — unchanged
// // ❌ Screens and displays — keep displayed content exactly as-is
// // ❌ Dealer text, watermarks, address overlays — remove all of them

// // OUTPUT REQUIREMENTS:
// // - Same framing and dimensions as Image 1
// // - All outdoor replaced with Image 2's studio environment
// // - Every mirror glass shows studio reflection only — no outdoor
// // - No sun rays or sky glow anywhere on interior surfaces
// // - Interior dramatically darker and richer — black leather = true deep black, not grey
// // - High contrast, moody, luxury brochure quality — NOT bright or flat
// // - Photorealistic — not CGI`;

// const prompt = `You are a professional automotive photo retoucher.

// ⚠️ CRITICAL — THIS IS AN INTERIOR CAR PHOTO:
// Image 1 is an interior photograph of a car.
// Output must show the EXACT same interior view — same framing, same angle, same crop.
// DO NOT generate any exterior car view. DO NOT output a full car from outside.
// Output is a retouched version of Image 1 — nothing else.

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔒 COLOR LOCK — ABSOLUTE RULE #1 — READ FIRST
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Scan Image 1 NOW and identify the EXACT color of every interior surface:
// - Seat upholstery color (beige? cream? tan? black? grey? brown? red?)
// - Door panel color
// - Dashboard color
// - Carpet color
// - Headliner color

// These colors are LOCKED. They must appear IDENTICAL in the output.
// ❌ DO NOT darken seats to make them look black if they are beige/tan/cream
// ❌ DO NOT shift seat color toward darker tones — lighter colors stay light
// ❌ DO NOT use any reference image or style assumption about what car interiors look like
// ❌ If seats are BEIGE in Image 1 — they must be BEIGE in the output. Not dark beige. Not grey-beige. BEIGE.
// ❌ If seats are CREAM — they stay cream. If TAN — they stay tan. If BLACK — they stay black.

// The only things that change are: background through windows, mirror reflections, sun artifact removal, and overall ambient lighting tone.
// Surface COLORS do not change. Surface BRIGHTNESS changes only minimally — enough to match studio mood but never enough to shift the perceived color.

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ⛔ ZERO-TOLERANCE CHECKLIST — VERIFY BEFORE OUTPUT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Before finalising the output, confirm ALL of these are true:

// ☑ SEAT COLOR — seats are the exact same color as in Image 1 (beige stays beige, black stays black)
// ☑ REAR VIEW MIRROR — the glass contains ONLY studio environment, zero outdoor content
// ☑ LEFT SIDE MIRROR (if visible) — the glass contains ONLY studio environment
// ☑ RIGHT SIDE MIRROR (if visible) — the glass contains ONLY studio environment
// ☑ WINDSCREEN AREA — no white sky, no grey sky, no buildings, no outdoor light bleed
// ☑ ALL WINDOWS — no outdoor scene visible through any glass
// ☑ SUN RAYS — no bright diagonal or horizontal light streaks across any interior surface
// ☑ SKY GLOW — no white/grey sky brightness bleeding onto the headliner, dashboard, or seats
// ☑ DEALER TEXT — no overlaid address, name, or watermark text anywhere

// If ANY item above is still present = output failure. Fix it before rendering.

// ═══════════════════════════════════════════════
// TASK 1 — ERASE ALL OUTDOOR FROM WINDOWS
// ═══════════════════════════════════════════════

// Scan Image 1 for every window opening — windscreen, side windows, rear window, open doors.
// Every pixel of sky, road, building, parked car, tree, or outdoor scene visible through glass must be replaced.

// Replacement content = Image 2's studio environment:
// - Sky/upper zone → Image 2's wall or background color
// - Lower zone → Image 2's floor color
// - Transition blends naturally — no hard line at the glass edge or pillar

// ⚠ The white or grey sky area visible through the windscreen is OUTDOOR. It must be fully replaced.
// Do not leave any white/grey/bright patch in the windscreen area — replace completely with studio.

// ═══════════════════════════════════════════════
// TASK 2 — OVERWRITE ALL MIRROR GLASS WITH STUDIO
// ═══════════════════════════════════════════════

// THIS IS MANDATORY. Every mirror in the image must be updated. No exceptions.

// STEP 1 — LOCATE EVERY MIRROR:
// - Rear view mirror: mounted at top of windscreen or on ceiling — typically a rectangular mirror facing the driver. In this camera angle it appears near the top-centre of the frame.
// - Right door mirror / wing mirror: visible on the right side of the frame through the passenger window or A-pillar area — a small convex mirror in a housing.
// - Left door mirror / wing mirror: visible on the left edge of the frame if the camera angle shows it.
// - Any other reflective mirror surfaces present.

// STEP 2 — FOR EACH MIRROR GLASS, DO THIS:
// The mirror glass currently shows outdoor content (buildings, cars, road, sky, parking lot).
// You must PAINT OVER the entire mirror glass area with Image 2's studio environment.
// - Fill the mirror glass with a natural-looking studio reflection: upper portion = Image 2's wall/ceiling tone, lower portion = Image 2's floor tone
// - The fill must look like a genuine mirror reflection of a studio — not a flat color block
// - Subtle depth and gradient within the mirror glass — darker corners, slightly lighter centre
// - Match Image 2's color temperature inside the mirror glass

// STEP 3 — MIRROR FRAME AND HOUSING:
// - Keep the physical mirror frame, stem, mounting bracket, and housing exactly as-is
// - Only the glass reflection content changes — nothing else on the mirror moves or changes shape

// ⚠ ENFORCEMENT: After completing Task 2, zoom into each mirror in your internal render.
// If you can see a building, a car, a road, a sky, or any outdoor content in any mirror glass — redo it.
// The output is only acceptable when every mirror glass shows studio environment exclusively.

// ═══════════════════════════════════════════════
// TASK 3 — ELIMINATE ALL SUN RAY ARTIFACTS
// ═══════════════════════════════════════════════

// Sun rays, sunlight streaks, and sky-glow are present in Image 1. Remove all of them.

// WHAT TO LOOK FOR AND REMOVE:
// - Bright diagonal or horizontal light bands crossing seats, dashboard, or door panels
// - Warm orange/yellow sun patches on leather or fabric surfaces
// - Harsh bright zone on the headliner from sky light coming through windscreen
// - White/bright overexposed glow on the dashboard top surface from window light
// - Any area where one part of a surface is significantly brighter than the same material elsewhere

// HOW TO REMOVE:
// For each artifact:
// 1. Find the same material in a nearby area NOT affected by sunlight — that is the correct reference tone
// 2. Paint over the artifact zone with the correct reference tone for that material
// 3. Preserve all texture, grain, stitching underneath — only the brightness/color cast changes
// 4. After fix: the entire material surface must be uniform — no patch should stand out as brighter or warmer

// SUCCESS CRITERION: Every seat, every panel, every surface shows even uniform tone throughout.
// No patch anywhere should be noticeably brighter, warmer, or more washed-out than its surroundings.

// ═══════════════════════════════════════════════
// TASK 4 — ENHANCE LIGHTING QUALITY (COLOR-SAFE)
// ═══════════════════════════════════════════════

// ⚠ CRITICAL — COLOR PRESERVATION IS MANDATORY:
// Before doing anything in this task, re-read the COLOR LOCK section above.
// You must NOT shift any surface color. Darkening is ONLY allowed if it does not
// visually change the perceived color of the material.

// PERMITTED adjustments:
// - Reduce overall exposure by a MAX of 15% — subtle, not dramatic
// - Add depth and micro-contrast so textures (stitching, quilting, grain) look crisper
// - Make shadows in recesses and under-seat areas slightly deeper
// - Make highlights on raised surfaces slightly brighter

// NOT PERMITTED:
// ❌ Darkening beige/cream/tan/light-colored seats until they look grey or dark
// ❌ Shifting any surface toward black, dark grey, or any darker hue
// ❌ Aggressive exposure reduction — this is NOT a dark-studio editorial shoot
// ❌ Making light interiors look dark — keep light interiors LIGHT
// ❌ Using Image 2's color palette or tone as a reference for seat color

// LIGHT-COLORED INTERIORS (beige, cream, tan, ivory, champagne, light grey):
// - Seats must remain clearly light-toned in the output
// - Enhance richness by boosting leather texture and stitching contrast only
// - A slight warm-neutral tone from studio ambient is fine — but seats stay light
// - The quilting pattern and grain should look crisper and more defined
// - Overall brightness reduction: MAX 10% — barely perceptible

// DARK-COLORED INTERIORS (black, dark grey, dark navy, dark brown):
// - Seats can go richer and deeper — but same hue, not a different color
// - Black leather: deeper and more lustrous
// - Shadows in recesses: fully dark
// - Overall brightness reduction: up to 20% is acceptable

// FOR ALL INTERIORS:
// - Chrome and metal accents: clean sharp highlight
// - Micro-contrast: leather grain, stitching, carpet weave all look crisp and tactile
// - Overall feel: premium and well-lit, not flat — but color-accurate above all else

// SUCCESS CHECK — before finalising Task 4:
// Are the seats the SAME color as in Image 1? → If beige in Image 1, must still look clearly beige. If changed → FAIL.
// Does the interior feel slightly richer without a color shift? → If yes → PASS.

// ═══════════════════════════════════════════════
// TASK 5 — APPLY STUDIO AMBIENT TONE
// ═══════════════════════════════════════════════

// ⚠ The studio background (Image 2) may be plain white — do NOT copy its brightness onto the interior.
// Only take its COLOR TEMPERATURE (warm/cool/neutral) — not its exposure level.
// ⚠ ALSO: Do NOT copy Image 2's seat color onto Image 1's seats. Image 2 may have black seats — this is irrelevant. Image 1's seat color is locked from the COLOR LOCK section above.

// Apply Image 2's ambient color temperature very softly across all interior surfaces:
// - If Image 2 is neutral/cool white: apply a subtle cool-neutral cast — clean and crisp
// - If Image 2 is warm: apply a very subtle warm undertone to leather and soft surfaces
// - Chrome and metal: clean single narrow highlight streak
// - Top surfaces catch slightly more light, deep recesses stay dark
// - The color temperature tint should be subtle — the main effect is from Task 4

// ═══════════════════════════════════════════════
// STRICT PRESERVATION RULES — NEVER CHANGE THESE
// ═══════════════════════════════════════════════

// ❌ Output framing — same dimensions, same crop, same angle as Image 1
// ❌ Every interior component — exact position, nothing moves, nothing added, nothing removed
// ❌ Dashboard, steering wheel, centre console — exact layout
// ❌ All surface colors — only get richer, never shift hue, never shift toward darker tone
// ❌ Window frames, rubber seals, pillars — unchanged
// ❌ Screens and displays — keep displayed content exactly as-is
// ❌ Dealer text, watermarks, address overlays — remove all of them

// OUTPUT REQUIREMENTS:
// - Same framing and dimensions as Image 1
// - All outdoor replaced with Image 2's studio environment
// - Every mirror glass shows studio reflection only — no outdoor
// - No sun rays or sky glow anywhere on interior surfaces
// - Seat colors identical to Image 1 — only lighting quality improved, not color
// - Premium studio quality — rich textures, crisp details, accurate colors
// - Photorealistic — not CGI
// ${branding?.isEnabled ? "- Place the branding logo (Image 3) in the top-left corner, small and unobtrusive" : ""}`;

//     const parts: any[] = [
//         { text: prompt },
//         {
//             text: "Image 1 — INTERIOR PHOTO TO RETOUCH (retouch this exact interior view, do not generate exterior car):"
//         },
//         {
//             inlineData: {
//                 data: cleanOriginal,
//                 mimeType: cleanOriginal.slice(0, 16) && atob(cleanOriginal.slice(0, 16)).charCodeAt(0) === 0x89
//                     ? "image/png"
//                     : "image/jpeg"
//             }
//         },
//         {
//             text: "Image 2 — STUDIO ENVIRONMENT (replace all outdoor areas in Image 1 with this environment, and match its ambient color temperature):"
//         },
//         { inlineData: { data: cleanStudio, mimeType: "image/jpeg" } },
//     ];

//     if (branding?.isEnabled && branding?.logoUrl) {
//         parts.push(
//             { text: "Image 3 — Branding logo to place top-left:" },
//             { inlineData: { data: stripDataPrefix(branding.logoUrl), mimeType: "image/png" } }
//         );
//     }

//     const model = ai.getGenerativeModel({
//         model: MODEL_IMAGE,
//         safetySettings: [
//             { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
//             { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
//             { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
//             { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
//         ],
//         generationConfig: {
//             temperature: 0.20,
//             topP: 0.30,
//             topK: 20,
//             candidateCount: 1,
//         },
//     });

//     const response = await model.generateContent({
//         contents: [{ role: "user", parts }],
//     });

//     const candidate = response.response.candidates?.[0];
//     const imagePart = candidate?.content?.parts?.find((p: any) => p.inlineData);

//     console.log(`   [TOKENS][refineInterior] input:${response.response.usageMetadata?.promptTokenCount} output:${response.response.usageMetadata?.candidatesTokenCount} total:${response.response.usageMetadata?.totalTokenCount}`);

//     if (!imagePart?.inlineData?.data) {
//         throw new Error(`Interior refinement failed. FinishReason: ${candidate?.finishReason || "UNKNOWN"}`);
//     }

//     const mimeType = imagePart.inlineData.mimeType || "image/png";
//     return `data:${mimeType};base64,${imagePart.inlineData.data}`;
// }

async function refineInterior(
  ai: GoogleGenerativeAI,
  originalBase64: string,
  studioBase64: string,
  branding?: { isEnabled?: boolean; logoUrl?: string | null }
): Promise<string> {

  const cleanStudio = stripDataPrefix(studioBase64);

  // ─────────────────────────────────────────────────
  // CALL 1 — BACKGROUND & WINDOW REPLACEMENT ONLY
  // Single focused job: replace outdoor through glass.
  // No lighting changes, no color work, nothing else.
  // ─────────────────────────────────────────────────
  console.log("   [refineInterior] Step 1: Background replacement...");

  const promptStep1 = `You are a photo compositor. Your ONLY job in this task is background replacement.

⚠️ THIS IS AN INTERIOR CAR PHOTO. Output must show the exact same interior view.
DO NOT generate any exterior car view. DO NOT output a full car from outside.

🔒 COLOR LOCK — NON-NEGOTIABLE:
Scan Image 1 and identify every surface color right now.
Seat color, door panel color, carpet color — ALL LOCKED.
❌ DO NOT change any interior surface color whatsoever
❌ DO NOT darken, shift, or recolor any seat or panel
❌ Interior lighting stays identical to Image 1 — do not touch it

YOUR ONLY JOB — REPLACE OUTDOOR WITH STUDIO:

Step 1 — Find every location where outdoor is visible:
- Through ALL windows (left, right, rear, front)
- Through the mesh/grille partition at the top rear
- Any gap, opening, or transparent surface showing outdoor

Step 2 — For each outdoor area:
- Replace it completely with Image 2's studio environment
- Upper zone → Image 2's wall/background color
- Lower zone → Image 2's floor color  
- Blend naturally at glass edges — no hard cutlines
- The mesh/grille partition: fill the spaces between the mesh wires with studio background, keeping the mesh wires themselves intact

Step 3 — Sun ray removal:
- Look for bright patches or light streaks on the seats or panels caused by sunlight through windows
- For each bright patch: sample the same material in an unaffected area nearby → paint the correct tone over the bright patch
- Preserve all texture and stitching underneath
- After fix: every area of the same material must be uniform in brightness

WHAT NEVER CHANGES:
❌ Framing — exact same crop, angle, dimensions as Image 1
❌ Every interior surface color — unchanged
❌ Every interior component position — unchanged  
❌ Interior lighting character — unchanged
❌ Seat belt colors (red buckles stay red)
❌ All hardware, trim, buttons — unchanged`;

  const cleanOriginal1 = stripDataPrefix(originalBase64);
  const mimeType1 = atob(cleanOriginal1.slice(0, 16)).charCodeAt(0) === 0x89 ? "image/png" : "image/jpeg";

  const parts1: any[] = [
    { text: promptStep1 },
    { text: "Image 1 — INTERIOR PHOTO (replace outdoor through windows only, change nothing else):" },
    { inlineData: { data: cleanOriginal1, mimeType: mimeType1 } },
    { text: "Image 2 — STUDIO ENVIRONMENT to fill all outdoor areas:" },
    { inlineData: { data: cleanStudio, mimeType: "image/jpeg" } },
  ];

  const model = ai.getGenerativeModel({
    model: MODEL_IMAGE,
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ],
    generationConfig: {
      temperature: 0.10,
      topP: 0.20,
      topK: 10,
      candidateCount: 1,
    },
  });

  const response1 = await withRetry(
    () => model.generateContent({ contents: [{ role: "user", parts: parts1 }] }),
    "refineInterior-step1"
  );

  const candidate1 = response1.response.candidates?.[0];
  const imagePart1 = candidate1?.content?.parts?.find((p: any) => p.inlineData);
  console.log(`   [TOKENS][refineInterior-step1] input:${response1.response.usageMetadata?.promptTokenCount} output:${response1.response.usageMetadata?.candidatesTokenCount} total:${response1.response.usageMetadata?.totalTokenCount}`);

  if (!imagePart1?.inlineData?.data) {
    throw new Error(`Interior step 1 failed. FinishReason: ${candidate1?.finishReason || "UNKNOWN"}`);
  }

  const step1Result = `data:${imagePart1.inlineData.mimeType || "image/png"};base64,${imagePart1.inlineData.data}`;
  console.log("   [refineInterior] Step 1 complete.");

  // ─────────────────────────────────────────────────
  // CALL 2 — LIGHTING ENHANCEMENT ONLY
  // Input is the already-composited result from Call 1.
  // Background is already studio. Now just enhance quality.
  // ─────────────────────────────────────────────────
  console.log("   [refineInterior] Step 2: Lighting enhancement...");

  const promptStep2 = `You are a professional automotive photo retoucher specialising in interior enhancement.

⚠️ THIS IS AN INTERIOR CAR PHOTO. Output must show the exact same interior view.
DO NOT generate any exterior car view. DO NOT output a full car from outside.

🔒 COLOR LOCK — NON-NEGOTIABLE:
Identify the exact seat color in Image 1 right now.
If seats are BEIGE → output must show BEIGE seats.
If seats are TAN → output must show TAN seats.
If seats are CREAM → output must show CREAM seats.
If seats are BLACK → output must show BLACK seats.
❌ ZERO tolerance for color shifting — same color in, same color out

THE BACKGROUND IS ALREADY REPLACED in Image 1. Do not touch windows or background.

YOUR ONLY JOB — ENHANCE LIGHTING QUALITY:

For LIGHT-COLORED interiors (beige, cream, tan, ivory):
- Seats stay clearly light — do NOT darken them
- Add micro-contrast: make stitching, quilting pattern, leather grain look crisper
- Subtle brightness reduction: MAX 8% — barely perceptible
- Boost leather richness without changing the color
- Chrome and metal hardware: clean sharp highlight

For DARK-COLORED interiors (black, grey, dark brown):
- Deepen shadows in recesses and under-seat areas
- Make leather look more lustrous and rich
- Brightness reduction: up to 18% acceptable
- Chrome and metal hardware: clean sharp highlight

For ALL interiors:
- Increase micro-contrast so textures look tactile and premium
- Leather grain, stitching lines, quilting pattern all look crisp and defined
- Overall feel: premium studio quality — rich, not flat

WHAT NEVER CHANGES:
❌ Seat color — same perceived color as Image 1
❌ Framing and crop — identical
❌ Every component position — unchanged
❌ Windows and background — already done, do not touch
❌ Seat belt colors (red buckles stay red)
${branding?.isEnabled ? "\nBRANDING: Place the logo (Image 3) in the top-left corner, small and unobtrusive." : ""}`;

  const cleanStep1 = stripDataPrefix(step1Result);
  const mimeType2 = atob(cleanStep1.slice(0, 16)).charCodeAt(0) === 0x89 ? "image/png" : "image/jpeg";

  const parts2: any[] = [
    { text: promptStep2 },
    { text: "Image 1 — COMPOSITED INTERIOR (background already replaced, enhance lighting only):" },
    { inlineData: { data: cleanStep1, mimeType: mimeType2 } },
  ];

  if (branding?.isEnabled && branding?.logoUrl) {
    parts2.push(
      { text: "Image 3 — Branding logo to place top-left:" },
      { inlineData: { data: stripDataPrefix(branding.logoUrl), mimeType: "image/png" } }
    );
  }

  const model2 = ai.getGenerativeModel({
    model: MODEL_IMAGE,
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ],
    generationConfig: {
      temperature: 0.15,
      topP: 0.25,
      topK: 15,
      candidateCount: 1,
    },
  });

  const response2: any = await withRetry(
    () => model2.generateContent({ contents: [{ role: "user", parts: parts2 }] }),
    "refineInterior-step2"
  );

  const candidate2 = response2.response.candidates?.[0];
  const imagePart2 = candidate2?.content?.parts?.find((p: any) => p.inlineData);
  console.log(`   [TOKENS][refineInterior-step2] input:${response2.response.usageMetadata?.promptTokenCount} output:${response2.response.usageMetadata?.candidatesTokenCount} total:${response2.response.usageMetadata?.totalTokenCount}`);

  if (!imagePart2?.inlineData?.data) {
    // Step 2 failed — return step 1 result rather than throwing
    console.warn("   [refineInterior] Step 2 failed, returning Step 1 result");
    return step1Result;
  }

  console.log("   [refineInterior] Step 2 complete.");
  const finalMime = imagePart2.inlineData.mimeType || "image/png";
  return `data:${finalMime};base64,${imagePart2.inlineData.data}`;
}

// -----------------------------------------------------------
// DETAIL EXTERIOR REFINEMENT
// Close-ups: rims, tyres, badges, headlights, body panels etc.
// NO background removal — works with original image directly.
// -----------------------------------------------------------
async function refineDetailExterior(
  ai: GoogleGenerativeAI,
  carImage: string,
  studioImage: string,
  angle: string,
  branding?: { isEnabled?: boolean; logoUrl?: string | null }
): Promise<string> {

  const prompt = `You are an automotive studio compositor.

⚠⚠⚠ PRIMARY TASK — READ FIRST ⚠⚠⚠
Image 1 contains a car component on a TRANSPARENT background.
Your job is to place this car component into the studio environment from Image 2.
The car component IS the subject — it must appear in the output exactly as it appears in Image 1.
❌ The car must NOT disappear, shrink, or be removed from the output
❌ DO NOT alter or change any detail of the original car in image 1 like logo or brand or any fine details on tires or any surface of the car.
❌ DO NOT output just the background — the car component must be fully visible

⚠⚠⚠ FRAMING RULE ⚠⚠⚠
The car component must appear at the SAME SIZE and POSITION as in Image 1.
❌ DO NOT zoom out to show more of the car
❌ DO NOT zoom in
❌ DO NOT reframe or recompose
❌ DO NOT generate a full car — only what is visible in Image 1
The car fills most of the frame in Image 1 — keep it that way in the output.

═══ ABSOLUTE RULE — PAINT COLOR IS LOCKED ═══
The car's paint color must remain EXACTLY the same hue and saturation as Image 1.
❌ DO NOT desaturate, grey out, or shift the paint color in any way
The base paint color in the output must be visually identical to Image 1.
Studio reflections may appear ON the paint surface but the base color underneath stays unchanged.

═══ TASK 1 — REMOVE ALL ORIGINAL ENVIRONMENT REFLECTIONS ═══
Strip every reflection and lighting artifact that belongs to the original shooting location.

This includes ANY of the following that may be present:
- Bright spots or hotspots from any light source (round, oval, rectangular, or any shape)
- Linear streaks from fluorescent or LED strip lighting
- Warm color bleed from floors, walls, or surroundings
- Color casts from walls, banners, or any location-specific surfaces
- Window light patches or daylight streaks

After removal, every painted surface must show ONLY:
- Smooth clean gloss following the natural body contour
- No shapes, no spots, no streaks from the original shooting environment
- Paint color fully intact and unchanged

═══ TASK 2 — APPLY REFLECTIONS FROM IMAGE 2's STUDIO ═══
Study Image 2 carefully — note its light source color, direction, brightness, wall tone, floor color.
Apply Image 2's environment onto ALL painted, chrome, and glass surfaces:
- Smooth highlight streak matching Image 2's light source color and direction
- Gentle ambient gradient across each panel matching Image 2's ambient tone
- Subtle floor bounce at the lowest visible edge from Image 2's floor color
- Chrome and trim: clean highlight from Image 2's light source
- Glass surfaces: faint reflection of Image 2's ceiling or upper environment
- The lighting direction and color temperature on the car must match Image 2 exactly

═══ TASK 3 — PLACE CAR INTO IMAGE 2's STUDIO ═══
The car component must look like it was physically photographed inside Image 2's studio.
- Extend Image 2's floor naturally and seamlessly beneath the car's lower edge
- Add a soft natural shadow where the car meets the studio floor — consistent with Image 2's lighting
- If Image 2's floor is reflective — add a subtle floor reflection of the car's lower portion
- The walls and background of Image 2 must appear naturally behind the car
- Blend the car's edges into the studio environment — no hard cutout lines, no halos, no artifacts
- Match the car's overall color temperature to Image 2's environment

═══ WHAT MUST NEVER CHANGE ═══
❌ The car component must be fully visible and prominent — same size and position as Image 1
❌ Paint base color — unchanged
❌ Component geometry — shape and proportions unchanged
❌ Badges, trim, lenses, markings, wear — all identical to Image 1
❌ Do not repair or alter any surface detail
❌ Camera angle and framing — locked from Image 1

═══ OUTPUT SPECIFICATION ═══
The car component from Image 1 is the main subject and must fill the frame similarly to Image 1.
The result must feel like a single professional studio photograph — not a composite.
${branding?.isEnabled ? "- Place the branding logo (Image 3) in the top-left corner, small and unobtrusive. Preserve the logo exactly as-is — same colors, same shape. Do not add, change, or fill any background behind it." : ""}`;

  return generateImage(ai, carImage, studioImage, branding, prompt, true);
}

async function refineDetailExteriorV2(
  ai: GoogleGenerativeAI,
  compositedData: string,
  branding?: { isEnabled?: boolean; logoUrl?: string | null }
): Promise<string> {

  let carImage: string;
  let studioImg: string;

  try {
    const data = JSON.parse(compositedData);
    carImage = data.car;
    studioImg = data.background;
  } catch {
    carImage = compositedData;
    studioImg = "";
  }

  const cleanCar = stripDataPrefix(carImage);
  const cleanStudio = stripDataPrefix(studioImg);

  const prompt = `You are an automotive studio compositor specialising in close-up exterior detail shots.

═══ FRAMING LOCK — ABSOLUTE RULE #1 ═══
Image 1 is a tight close-up crop. Output MUST match exact same crop and zoom as Image 1.
❌ DO NOT zoom out
❌ DO NOT show more of the car than visible in Image 1
❌ DO NOT reframe or recompose
If output shows more car than Image 1 — AUTOMATIC FAILURE.

═══ YOUR JOB ═══
1. Replace the background behind the component with Image 2's studio environment
2. Remove all original environment reflections from the component's surfaces
3. Apply studio-accurate reflections from Image 2's lighting

═══ BACKGROUND REPLACEMENT ═══
- Replace everything that is NOT the car component with Image 2's environment
- Blend edges naturally — no hard cutout lines
- Match ambient color temperature to Image 2

═══ REFLECTION UPDATE ═══
REMOVE from all surfaces:
- Sky, trees, buildings, outdoor shapes
- Indoor ceiling lights, fluorescent strips, dealership walls
- Warm orange/amber floor glow
- Any shape from original shooting location

APPLY from Image 2 environment:
- Highlight streaks matching Image 2's light source
- Smooth gradients in Image 2's ambient tone
- Keep paint color 100% unchanged — same hue, same saturation
- Keep gloss and metallic finish intact

═══ WHAT NEVER CHANGES ═══
❌ Crop and zoom — locked
❌ Paint color — unchanged, fully saturated
❌ Component geometry — unchanged
❌ Badges, markings, wear — unchanged
❌ Camera angle — locked

OUTPUT: Aspect ratio 4:3
${branding?.isEnabled ? "BRANDING: Logo (Image 3) top-left, small." : ""}`;

  const parts: any[] = [
    { text: prompt },
    { text: "Image 1 — CLOSE-UP SUBJECT (preserve exact crop and zoom):" },
    { inlineData: { data: cleanCar, mimeType: "image/png" } },
    { text: "Image 2 — STUDIO BACKGROUND environment:" },
    { inlineData: { data: cleanStudio, mimeType: "image/jpeg" } },
  ];

  if (branding?.isEnabled && branding?.logoUrl) {
    parts.push(
      { text: "Image 3 — BRANDING LOGO:" },
      { inlineData: { data: stripDataPrefix(branding.logoUrl), mimeType: "image/png" } }
    );
  }

  const model = ai.getGenerativeModel({
    model: MODEL_IMAGE,
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ],
    generationConfig: {
      temperature: 0.01,
      topP: 0.05,
      topK: 2,
      candidateCount: 1,
    },
  });

  const response = await withRetry(
    () => model.generateContent({ contents: [{ role: "user", parts }] }),
    "refineDetailExterior"
  );

  const candidate = response.response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find((p: any) => p.inlineData);

  if (!imagePart?.inlineData?.data) {
    throw new Error(`Detail exterior generation failed. FinishReason: ${candidate?.finishReason}`);
  }

  return `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`;
}

// -----------------------------------------------------------
// DETAIL INTERIOR REFINEMENT (Dev B — 2-step pipeline)
// Step 1: Generate with INTERIOR_DETAIL prompt
// Step 2: Refine with studio refinement pass
// Close-ups: steering wheel, gear shift, dashboard, seats etc.
// -----------------------------------------------------------
async function refineDetailInterior(
  ai: GoogleGenerativeAI,
  image: string,
  studio: string,
  branding?: { isEnabled?: boolean; logoUrl?: string | null },
  studioHints?: { lightingProfile?: string; studioTone?: string; floorFinish?: string; exposureNote?: string; platformType?: string; name?: string }
): Promise<string> {

  const cleanOriginal = stripDataPrefix(image);
  const cleanStudio = stripDataPrefix(studio);
  const isDark = studioHints?.studioTone === "dark";

  // Dynamic lighting based on studio hints (Dev B)
  const detailLighting = isDark
    ? "dark, moody studio lighting with refined highlights and atmospheric shadows"
    : studioHints?.lightingProfile === "warm" ? "warm golden studio lighting with soft warm shadows"
      : studioHints?.lightingProfile === "cool" ? "cool crisp white studio lighting with clean minimal shadows"
        : "bright even neutral studio lighting with soft diffused shadows";

  // Detect mime types
  function detectMimeFromClean(cleanBase64: string): string {
    try {
      const header = atob(cleanBase64.slice(0, 16));
      if (header.charCodeAt(0) === 0x89 && header.charCodeAt(1) === 0x50) return "image/png";
    } catch { }
    return "image/jpeg";
  }

  // ─────────────────────────────────────────────────
  // STEP 1 — Generate with INTERIOR_DETAIL prompt
  // ─────────────────────────────────────────────────
  console.log(`🎯 [DETAIL-INT] Step 1/2: Generation (model: ${MODEL_IMAGE_INTERIOR})...`);

  const prompt = [
    `You are retouching Image 1. Output must match the exact viewpoint of Image 1.`,
    `Image 2 is a studio reference — use it ONLY to determine the lighting tone to apply.`,
    ``,
    `Make ONLY these targeted changes to Image 1. Change nothing else:`,
    ``,
    `1. LIGHTING TONE ONLY: Apply ${detailLighting}. Remove outdoor sun patches, hard directional shadows, and overexposed hotspots. Adjust color temperature only — do not repaint or alter any surface.`,
    ``,
    `2. REFLECTION CLEANUP ONLY: Remove photographer, hand, or phone reflections from glass, screens, chrome, and glossy trim. Replace with clean neutral studio highlights. Preserve all gauge numbers, text, icons, and screen UI exactly.`,
    ``,
    `3. EXPOSURE RECOVERY ONLY: Recover detail in severely overexposed or underexposed zones only.`,
    ``,
    `4. WINDOWS (if visible): Replace any outdoor content through glass with a neutral studio blur or the studio from Image 2.`,
    ``,
    `DO NOT CHANGE UNDER ANY CIRCUMSTANCES:`,
    `• Camera angle, zoom, crop, or framing — must be pixel-identical to Image 1`,
    `• Any component geometry, position, shape, or size`,
    `• Any material color or texture`,
    `• Any text, numbers, icons, or markings`,
    ``,
    `Do not change the input aspect ratio.`,
  ].join("\n");

  const parts: any[] = [
    { text: prompt },
    { text: "Image 1 — the interior detail photo to edit. This is the MASTER reference. Every component stays identical: same geometry, materials, colors, textures, positions, zoom, and framing. You are making minimal edits only." },
    { inlineData: { data: cleanOriginal, mimeType: detectMimeFromClean(cleanOriginal) } },
    { text: "Image 2 — the studio reference. Use ONLY to determine the ambient light color temperature and tone. Do NOT use this to change any geometry or materials." },
    { inlineData: { data: cleanStudio, mimeType: detectMimeFromClean(cleanStudio) } },
  ];

  const safetySettings = [
    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
  ];

  const model = ai.getGenerativeModel({
    model: MODEL_IMAGE_INTERIOR,
    safetySettings,
    generationConfig: {
      temperature: 0.15,
      topP: 0.3,
      topK: 10,
      candidateCount: 1,
    },
  });

  let response: any;
  let usedModel = MODEL_IMAGE_INTERIOR;
  try {
    response = await withRetry(
      () => model.generateContent({ contents: [{ role: "user", parts }] }),
      `refineDetailInterior-step1 (${MODEL_IMAGE_INTERIOR})`,
      1  // Only 1 attempt on 3.1 — fail fast, fallback to stable model
    );
  } catch (primaryErr) {
    // Fallback to stable model
    console.warn(`⚠️ [DETAIL-INT] Primary model ${MODEL_IMAGE_INTERIOR} failed. Falling back to ${MODEL_IMAGE}...`);
    usedModel = MODEL_IMAGE;
    const fallbackModel = ai.getGenerativeModel({
      model: MODEL_IMAGE,
      safetySettings,
      generationConfig: { temperature: 0.15, topP: 0.3, topK: 10, candidateCount: 1 },
    });
    response = await withRetry(
      () => fallbackModel.generateContent({ contents: [{ role: "user", parts }] }),
      `refineDetailInterior-step1-fallback (${MODEL_IMAGE})`
    );
  }

  const candidate = response.response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find((p: any) => p.inlineData);
  console.log(`📊 [TOKENS] refineDetailInterior-step1 (${usedModel}) → in:${response.response.usageMetadata?.promptTokenCount} out:${response.response.usageMetadata?.candidatesTokenCount} total:${response.response.usageMetadata?.totalTokenCount}`);

  if (!imagePart?.inlineData?.data) {
    throw new Error(`Interior detail step 1 failed. FinishReason: ${candidate?.finishReason || "UNKNOWN"}`);
  }

  const step1Result = `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`;
  console.log("✅ [DETAIL-INT] Step 1/2 complete");

  // ─────────────────────────────────────────────────
  // STEP 2 — Studio refinement pass
  // ─────────────────────────────────────────────────
  console.log(`🎯 [DETAIL-INT] Step 2/2: Studio refinement (model: ${MODEL_IMAGE_INTERIOR})...`);

  const lightingFix = isDark
    ? "The lighting must be dark and moody like this studio — remove all bright daylight from interior surfaces. Shadows should be deep and atmospheric."
    : "The lighting must be bright and even like this studio — remove all harsh outdoor directional light from interior surfaces. Shadows should be soft and diffused.";

  const refinementPrompt = [
    "You are retouching Image 1. The camera angle, zoom, crop, and framing of Image 1 must remain IDENTICAL in the output.",
    "Image 2 is a studio reference — use it only to determine what to show through windows and the lighting tone.",
    `Make ONLY these targeted fixes to Image 1: (a) replace any remaining outdoor content through windows with the studio from Image 2; (b) ${lightingFix}; (c) remove any photographer or camera reflections from glass and screens — preserve all gauge numbers, icons, and screen text exactly.`,
    "DO NOT change: camera angle, zoom, crop, framing, seat shapes, dashboard layout, material colors, material textures, or any component geometry.",
    "Do not change the input aspect ratio.",
  ].join(" ");

  const cleanStep1 = stripDataPrefix(step1Result);
  const refineParts: any[] = [
    { text: refinementPrompt },
    { text: "Image 1 — the car interior detail to retouch. This is the MASTER. All geometry, colors, materials, framing, zoom, and crop must be preserved exactly." },
    { inlineData: { data: cleanStep1, mimeType: detectMimeFromClean(cleanStep1) } },
    { text: "Image 2 — the studio reference. Use only for window content and lighting tone." },
    { inlineData: { data: cleanStudio, mimeType: detectMimeFromClean(cleanStudio) } },
  ];

  const refineModel = ai.getGenerativeModel({
    model: MODEL_IMAGE_INTERIOR,
    safetySettings,
    generationConfig: {
      temperature: 0.1,
      topP: 0.2,
      topK: 10,
      candidateCount: 1,
    },
  });

  try {
    const refineResponse: any = await withRetry(
      () => refineModel.generateContent({ contents: [{ role: "user", parts: refineParts }] }),
      `refineDetailInterior-step2 (${MODEL_IMAGE_INTERIOR})`
    );

    const refineCandidate = refineResponse.response.candidates?.[0];
    const refineImagePart = refineCandidate?.content?.parts?.find((p: any) => p.inlineData);
    console.log(`📊 [TOKENS] refineDetailInterior-step2 → in:${refineResponse.response.usageMetadata?.promptTokenCount} out:${refineResponse.response.usageMetadata?.candidatesTokenCount} total:${refineResponse.response.usageMetadata?.totalTokenCount}`);

    if (refineImagePart?.inlineData?.data) {
      console.log("✅ [DETAIL-INT] Step 2/2 complete");
      return `data:${refineImagePart.inlineData.mimeType || "image/png"};base64,${refineImagePart.inlineData.data}`;
    }

    console.warn("⚠️ [DETAIL-INT] Step 2 returned no image — returning Step 1 result");
    return step1Result;
  } catch (step2Err) {
    console.warn("⚠️ [DETAIL-INT] Step 2 failed after retries — returning Step 1 result");
    return step1Result;
  }
}

// -----------------------------------------------------------
// DETAIL REFINEMENT
// -----------------------------------------------------------
async function refineDetail(
  ai: GoogleGenerativeAI,
  image: string,
  studio: string,
  branding?: { isEnabled?: boolean; logoUrl?: string | null }
): Promise<string> {

  const prompt = `You are an automotive detail photography specialist.

YOUR ONLY JOB:
Replace the background behind the car component with the studio environment from Image 2.
The component itself must remain 100% identical — every detail, finish, and imperfection.

KEEP UNCHANGED:
- The component exactly as photographed
- Existing lighting and shadows on the component
- Camera angle and framing
- Any damage, wear, or unique characteristics

REPLACE:
- Everything behind the component → studio background (Image 2)

PROHIBITIONS:
:x: Do not change the component in any way
:x: Do not alter camera angle
:x: Do not repair or clean damage

OUTPUT: Aspect ratio 4:3
${branding?.isEnabled ? "\nBRANDING: Logo (Image 3) top-left corner, small." : ""}`;

  return generateImage(ai, image, studio, branding, prompt);
}

// -----------------------------------------------------------
// CORE IMAGE GENERATOR
// BUG FIX: removed the duplicate studio image push that was
// causing the model to receive the background image twice.
// -----------------------------------------------------------
async function generateImage(
  ai: GoogleGenerativeAI,
  carImage: string,
  studioBackground: string | null,
  branding: { isEnabled?: boolean; logoUrl?: string | null } | undefined,
  promptText: string,
  isDetailShot: boolean = false
): Promise<string> {

  const cleanCar = stripDataPrefix(carImage);

  // Build parts array — ORDER MATTERS for Gemini
  // Pattern: text instruction → labeled car → labeled background → optional logo
  const parts: any[] = [
    { text: promptText },
    { text: "Image 1 — PRIMARY SUBJECT (car, preserve geometry exactly):" },
    { inlineData: { data: cleanCar, mimeType: detectMimeType(carImage) } },
  ];

  // FIX: studio image pushed ONCE only (previous code pushed it twice)
  if (studioBackground) {
    const cleanStudio = stripDataPrefix(studioBackground);
    if (cleanStudio) {
      parts.push(
        { text: "Image 2 — STUDIO BACKGROUND environment:" },
        { inlineData: { data: cleanStudio, mimeType: detectMimeType(studioBackground!) } }
      );
    }
  }

  // Optional branding logo
  if (branding?.isEnabled && branding?.logoUrl) {
    const cleanLogo = stripDataPrefix(branding.logoUrl);
    parts.push(
      { text: "Image 3 — BRANDING LOGO (place top-left corner, small):" },
      { inlineData: { data: cleanLogo, mimeType: "image/png" } }
    );
  }

  console.log(`🖼️ [GENERATE] Generating with ${MODEL_IMAGE} (${parts.length} parts)...`);

  const model = ai.getGenerativeModel({
    model: MODEL_IMAGE,
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ],
    generationConfig: isDetailShot ? {
      temperature: 0.05,
      topP: 0.1,
      topK: 1,
      candidateCount: 1,
    } : {
      temperature: 0.01,
      topP: 0.05,
      topK: 2,
      candidateCount: 1,
    },
  });

  try {
    const response = await model.generateContent({
      contents: [{ role: "user", parts }],
    });

    const candidate = response.response.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find((p: any) => p.inlineData);
    console.log(`📊 [TOKENS] generateImage → in:${response.response.usageMetadata?.promptTokenCount} out:${response.response.usageMetadata?.candidatesTokenCount} total:${response.response.usageMetadata?.totalTokenCount}`);

    if (!imagePart?.inlineData?.data) {
      const reason = candidate?.finishReason || "UNKNOWN";
      console.error("❌ [GENERATE] Full response:", JSON.stringify(response, null, 2));
      throw new Error(`Image generation failed. Model: ${MODEL_IMAGE}. FinishReason: ${reason}`);
    }

    const mimeType = imagePart.inlineData.mimeType || "image/png";
    return `data:${mimeType};base64,${imagePart.inlineData.data}`;

  } catch (err) {
    console.error("❌ [GENERATE] Error:", err);
    throw err;
  }
}

// -----------------------------------------------------------
// UTILITY
// -----------------------------------------------------------
function stripDataPrefix(base64: string): string {
  return base64.includes(",") ? base64.split(",")[1] : base64;
}

function detectMimeType(base64: string): string {
  if (base64.startsWith("data:")) {
    const match = base64.match(/^data:([^;]+);/);
    if (match) return match[1];
  }
  // Detect from magic bytes
  try {
    const first4 = atob(base64.slice(0, 8));
    if (first4.charCodeAt(0) === 0xFF && first4.charCodeAt(1) === 0xD8) return "image/jpeg";
    if (first4.charCodeAt(0) === 0x89 && first4.charCodeAt(1) === 0x50) return "image/png";
  } catch { }
  return "image/png";
}
