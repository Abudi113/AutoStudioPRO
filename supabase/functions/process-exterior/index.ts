// ============================================================
// PROCESS-EXTERIOR — Supabase Edge Function
// Handles EXTERIOR car image processing using Developer A's pipeline
// Shared API key pool with process-image
// ============================================================

// @ts-ignore
import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  type SafetySetting,
} from "npm:@google/genai";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// -----------------------------------------------------------
// MODEL CONFIG
// -----------------------------------------------------------
const MODEL_IMAGE = "gemini-2.5-flash-image";
const MODEL_VISION = "gemini-2.5-flash";
const REMBG_API = "https://api.remove.bg/v1.0/removebg";
const STORAGE_BUCKET = "project-images";
const CLASSIFICATION_CONFIDENCE_THRESHOLD = 0.85;
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1200;
const RETRY_QUOTA_DELAY_MS = 20000;
const INTER_CALL_DELAY_MS = 1500;
const BATCH_CONCURRENCY = 5;
const ROUTE_VERSION = "2026-03-08";
const PROMPT_VERSION = "2026-03-13-exterior-split-v1";

const SAFETY_SETTINGS: SafetySetting[] = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// -----------------------------------------------------------
// SCHEMAS
// -----------------------------------------------------------
const CLASSIFICATION_SCHEMA = {
  type: "object",
  properties: {
    category: {
      type: "string",
      enum: ["EXTERIOR", "EXTERIOR_DETAIL", "INTERIOR", "INTERIOR_DETAIL", "REJECT"],
    },
    confidence: { type: "number" },
    subject_type: {
      type: "string",
      enum: ["full_vehicle", "cabin", "component", "invalid"],
    },
    angle_family: {
      type: "string",
      enum: ["front", "rear", "side", "three_quarter", "interior", "detail", "unknown"],
    },
    crop_lock: { type: "boolean" },
    notes: { type: "array", items: { type: "string" } },
    quality_issues: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "none", "photographer_visible", "photographer_reflection",
          "camera_obstruction", "motion_blur", "out_of_focus",
          "severe_noise", "underexposed", "overexposed", "flash_glare",
        ],
      },
    },
  },
  required: ["category", "confidence", "subject_type", "angle_family", "crop_lock", "notes", "quality_issues"],
};

const QA_SCHEMA = {
  type: "object",
  properties: {
    pass: { type: "boolean" },
    issues: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "geometry_changed", "hallucinated_part", "plate_mismatch",
          "paint_shift", "crop_changed", "outdoor_reflection_left",
          "windshield_outdoor_content", "body_panel_outdoor_reflection",
          "shadow_mismatch", "studio_surrounding_mismatch",
          "zoom_or_crop_drift", "angle_or_direction_changed",
          "wheel_design_changed", "badge_text_changed",
          "caliper_color_changed", "trim_altered",
          "component_detail_lost", "material_texture_changed",
          "cleanup_artifact_remaining", "not_4_3", "category_mismatch",
          "low_confidence",
        ],
      },
    },
    severity: { type: "string", enum: ["low", "medium", "high"] },
    retry_recommended: { type: "boolean" },
  },
  required: ["pass", "issues", "severity", "retry_recommended"],
};

// -----------------------------------------------------------
// TYPES
// -----------------------------------------------------------
type QualityIssue =
  | "none" | "photographer_visible" | "photographer_reflection"
  | "camera_obstruction" | "motion_blur" | "out_of_focus"
  | "severe_noise" | "underexposed" | "overexposed" | "flash_glare";

type ClassificationResult = {
  category: "EXTERIOR" | "EXTERIOR_DETAIL" | "INTERIOR" | "INTERIOR_DETAIL" | "REJECT";
  confidence: number;
  subject_type: "full_vehicle" | "cabin" | "component" | "invalid";
  angle_family: "front" | "rear" | "side" | "three_quarter" | "interior" | "detail" | "unknown";
  crop_lock: boolean;
  notes: string[];
  quality_issues: QualityIssue[];
};

type QAEvaluation = {
  pass: boolean;
  issues: string[];
  severity: "low" | "medium" | "high";
  retry_recommended: boolean;
};

type StudioHints = {
  lightingProfile: string;
  studioTone: string;
  floorFinish: string;
  exposureNote: string;
  platformType: string;
  name: string;
};

type QualityReference = {
  imageBase64: string;
  label: string;
};

type JobRow = {
  id: string;
  project_id: string;
  user_id: string;
  original_image_url: string;
  original_angle: string;
  studio_id: string;
  classification_override: string | null;
  attempt_count: number;
};

type SupabaseClientAny = any;

// -----------------------------------------------------------
// UTILITIES
// -----------------------------------------------------------
function stripDataPrefix(base64: string): string {
  return base64.includes(",") ? base64.split(",")[1] : base64;
}

function detectMimeType(image: string): string {
  if (image.startsWith("data:image/png")) return "image/png";
  if (image.startsWith("data:image/webp")) return "image/webp";
  if (image.startsWith("data:")) {
    const match = image.match(/^data:([^;]+);/);
    if (match) return match[1];
  }
  try {
    const clean = stripDataPrefix(image);
    const first4 = atob(clean.slice(0, 8));
    if (first4.charCodeAt(0) === 0xFF && first4.charCodeAt(1) === 0xD8) return "image/jpeg";
    if (first4.charCodeAt(0) === 0x89 && first4.charCodeAt(1) === 0x50) return "image/png";
  } catch { /* ignore */ }
  return "image/jpeg";
}

function decodeBase64(base64: string): Uint8Array {
  const clean = stripDataPrefix(base64);
  const binary = atob(clean);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function buildDataUri(bytes: Uint8Array, mimeType: string): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    // @ts-ignore
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

function getImagePart(image: string) {
  return {
    inlineData: {
      data: stripDataPrefix(image),
      mimeType: detectMimeType(image),
    },
  };
}

function validateImageOutput(base64Data: string, label: string): void {
  const cleanData = stripDataPrefix(base64Data);
  if (cleanData.length < 5000) {
    throw new Error(
      `[${label}] Image output too small (${cleanData.length} chars). Potential API degradation.`,
    );
  }
}

function isTransientError(message: string): boolean {
  return [
    "500", "503", "429", "overloaded", "UNAVAILABLE", "INTERNAL",
    "RESOURCE_EXHAUSTED", "fetch", "SendRequest", "connection error",
    "close_notify", "TLS", "ECONNRESET", "ETIMEDOUT", "error reading",
    "body from connection", "unexpected eof",
  ].some((token) => message.toLowerCase().includes(token.toLowerCase()));
}

function isQuotaError(message: string): boolean {
  return (
    message.includes("429") ||
    message.toLowerCase().includes("resource_exhausted") ||
    message.toLowerCase().includes("quota")
  );
}

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = String(error);
      if (!isTransientError(message) || attempt === RETRY_ATTEMPTS) break;
      const isQuota = isQuotaError(message);
      const delay = isQuota
        ? RETRY_QUOTA_DELAY_MS * attempt
        : RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(`[${label}] attempt ${attempt} failed (${isQuota ? "QUOTA" : "transient"}). Retrying in ${delay}ms.`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

async function interCallDelay(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, INTER_CALL_DELAY_MS));
}

// -----------------------------------------------------------
// SUPABASE & STORAGE HELPERS
// -----------------------------------------------------------
async function fetchImageAsDataUri(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch image: ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const mimeType = response.headers.get("content-type") || "image/jpeg";
  return buildDataUri(bytes, mimeType);
}

async function uploadImageToStorage(
  supabase: SupabaseClientAny,
  path: string,
  image: string,
): Promise<string> {
  const bytes = decodeBase64(image);
  const contentType = detectMimeType(image);
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function updateJob(
  supabase: SupabaseClientAny,
  jobId: string,
  patch: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("generation_jobs")
    .update(patch)
    .eq("id", jobId);
  if (error) throw error;
}

async function syncProjectSummary(
  supabase: SupabaseClientAny,
  projectId: string,
) {
  const { data: rows, error } = await supabase
    .from("generation_jobs")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const jobs = (rows || []).map((row: any) => ({
    id: row.id,
    angle: row.original_angle || "OTHER",
    originalImage: row.original_image_url,
    processedImage: row.final_4_3_url || row.generated_raw_url || row.original_image_url,
    status: row.status,
    detectedCategory: row.detected_category,
    classifierConfidence: row.classifier_confidence,
    classificationOverride: row.classification_override,
    qaStatus: row.qa_status,
    qaIssues: row.qa_issues || [],
    qaSeverity: row.qa_severity,
    needsReview: row.needs_review,
    finalAspectRatio: row.final_aspect_ratio || "4:3",
  }));

  const status =
    jobs.length > 0 &&
      jobs.every((job: any) =>
        ["completed", "failed", "needs_review"].includes(job.status),
      )
      ? "completed"
      : "processing";
  const thumbnail =
    jobs.find((job: any) => job.processedImage)?.processedImage || null;

  const { error: patchError } = await supabase
    .from("projects")
    .update({
      jobs,
      thumbnail_url: thumbnail,
      status,
      photo_count: jobs.length,
    })
    .eq("id", projectId);

  if (patchError) throw patchError;
}

// -----------------------------------------------------------
// CLASSIFICATION
// -----------------------------------------------------------
async function classifyImage(
  ai: GoogleGenAI,
  originalBase64: string,
  originalAngle: string,
): Promise<ClassificationResult> {
  const response = await withRetry("classifyImage", () =>
    ai.models.generateContent({
      model: MODEL_VISION,
      contents: [
        {
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
                "  • motion_blur, out_of_focus, severe_noise, underexposed, overexposed, flash_glare: as named.",
                '  • none: the image is clean. If clean return ["none"].',
              ].join("\n"),
            },
            { text: `Original angle hint: ${originalAngle || "unknown"}` },
            getImagePart(originalBase64),
          ],
        },
      ],
      config: {
        temperature: 0,
        responseMimeType: "application/json",
        responseJsonSchema: CLASSIFICATION_SCHEMA,
      },
    }),
  );

  const data = JSON.parse(response.text || "{}");
  const rawIssues: string[] = Array.isArray(data.quality_issues) ? data.quality_issues : ["none"];
  const validIssues: QualityIssue[] = rawIssues.filter(
    (i: string): i is QualityIssue =>
      ["none", "photographer_visible", "photographer_reflection", "camera_obstruction",
        "motion_blur", "out_of_focus", "severe_noise", "underexposed", "overexposed", "flash_glare"].includes(i),
  );
  return {
    category: data.category || "REJECT",
    confidence: typeof data.confidence === "number" ? data.confidence : 0,
    subject_type: data.subject_type || "invalid",
    angle_family: data.angle_family || "unknown",
    crop_lock: Boolean(data.crop_lock),
    notes: Array.isArray(data.notes) ? data.notes : [],
    quality_issues: validIssues.length > 0 ? validIssues : ["none"],
  };
}

// -----------------------------------------------------------
// CLEANUP (quality issues — photographer, blur, etc.)
// -----------------------------------------------------------
function buildCleanupPrompt(issue: QualityIssue): string {
  const prompts: Record<QualityIssue, string> = {
    none: "",
    photographer_visible: "Using the provided image, remove the visible photographer — including any hands, arms, fingers, phone device, or body parts that are directly visible in the frame. Fill the area with the natural continuation of the vehicle surface or background. Keep everything else exactly the same. Do not change the input aspect ratio.",
    photographer_reflection: "Using the provided image, remove the photographer's reflection from all reflective surfaces — painted panels, chrome trim, glass, mirrors. Replace with clean studio-consistent highlight. Preserve all surface details. Keep everything else exactly the same. Do not change the input aspect ratio.",
    camera_obstruction: "Using the provided image, remove any physical obstruction at the frame edges — including fingers, phone case corners, or lens obstructions. Fill the obscured area naturally. Keep everything else exactly the same. Do not change the input aspect ratio.",
    motion_blur: "Using the provided image, correct the motion blur to produce a sharp photograph. Restore fine surface details. Keep composition, framing, colors exactly the same. Do not change the input aspect ratio.",
    out_of_focus: "Using the provided image, correct the soft focus so the automotive subject is sharp. Restore surface details. Keep composition exactly the same. Do not change the input aspect ratio.",
    severe_noise: "Using the provided image, reduce severe digital noise. Preserve underlying vehicle detail. Keep composition, colors exactly the same. Do not change the input aspect ratio.",
    underexposed: "Using the provided image, correct underexposure to reveal full vehicle detail. Brighten shadow areas naturally. Keep composition exactly the same. Do not change the input aspect ratio.",
    overexposed: "Using the provided image, correct overexposure by recovering blown-out highlights. Restore detail in bright surfaces. Keep composition exactly the same. Do not change the input aspect ratio.",
    flash_glare: "Using the provided image, remove harsh flash glare spots. Replace each glare spot with natural paint color and surface texture. Keep everything else exactly the same. Do not change the input aspect ratio.",
  };
  return prompts[issue] || "";
}

async function cleanupImage(
  ai: GoogleGenAI,
  imageBase64: string,
  issues: QualityIssue[],
): Promise<string> {
  const actionableIssues = issues.filter((i) => i !== "none");
  if (actionableIssues.length === 0) return imageBase64;
  let current = imageBase64;
  for (const issue of actionableIssues) {
    const promptText = buildCleanupPrompt(issue);
    if (!promptText) continue;
    console.log(`[cleanup] Running pass for issue: ${issue}`);
    try {
      const response: any = await withRetry(`cleanup:${issue}`, () =>
        ai.models.generateContent({
          model: MODEL_IMAGE,
          contents: [{ role: "user", parts: [{ text: promptText }, { text: "Image — the automotive photo to clean up" }, getImagePart(current)] }],
          config: { temperature: 0.05, topP: 0.1, topK: 5, candidateCount: 1, responseModalities: ["Image"], safetySettings: SAFETY_SETTINGS },
        }),
      );
      const imagePart = response.candidates?.[0]?.content?.parts?.find((part: any) => part.inlineData?.data);
      if (imagePart?.inlineData?.data) {
        validateImageOutput(imagePart.inlineData.data, `cleanup:${issue}`);
        current = `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`;
        console.log(`[cleanup] Pass for ${issue} succeeded.`);
      }
    } catch (err) {
      console.warn(`[cleanup] Pass for ${issue} failed, continuing:`, err);
    }
    await interCallDelay();
  }
  return current;
}

// -----------------------------------------------------------
// QA EVALUATION
// -----------------------------------------------------------
async function qaEvaluate(
  ai: GoogleGenAI,
  originalBase64: string,
  studioImageBase64: string,
  generatedBase64: string,
  studioHints?: StudioHints,
): Promise<QAEvaluation> {
  const isDark = studioHints?.studioTone === "dark";

  const qaPrompt = [
    "Compare Image 3 (result) against Image 1 (original) and Image 2 (target studio). Report any defects.",
    "Category: EXTERIOR.",
    "",
    "STRUCTURAL IDENTITY CHECKS:",
    "• geometry_changed: Vehicle shape, proportions, or camera angle differ from Image 1.",
    "• hallucinated_part: Details added that don't exist in Image 1.",
    "• plate_mismatch: License plate text or design changed.",
    "• paint_shift: Vehicle paint color/finish noticeably changed.",
    "• crop_changed: Framing significantly different.",
    "• wheel_design_changed: Spoke count, shape, finish, or centre cap differs.",
    "• badge_text_changed: Any badge text differs.",
    "• caliper_color_changed: Brake caliper color/shape differs.",
    "• trim_altered: Exterior trim shape or finish changed.",
    "• zoom_or_crop_drift: Image zoomed in/out compared to Image 1.",
    "• angle_or_direction_changed: Camera angle or vehicle direction changed. AUTOMATIC FAILURE.",
    "",
    "CLEANUP CHECKS:",
    "• cleanup_artifact_remaining: Photographer artifact still visible.",
    "",
    "EXTERIOR ENVIRONMENT CHECKS:",
    "• outdoor_reflection_left: Outdoor content visible in body panel reflections.",
    "• windshield_outdoor_content: Sky, trees, buildings visible through glass.",
    "• body_panel_outdoor_reflection: Outdoor scenery reflected in painted surfaces.",
    "• shadow_mismatch: Shadows don't match Image 2's lighting.",
    "• studio_surrounding_mismatch: Background doesn't match Image 2's studio.",
    isDark ? "• DARK STUDIO: Bright outdoor artifacts on dark paint/glass are automatic failures." : "",
    "",
    "Return pass=true ONLY if zero issues found.",
    "Structural identity changes are ALWAYS high severity with retry_recommended=true.",
    "EXTERIOR QUALITY: No outdoor artifacts may survive in a professional studio photo.",
  ].filter(Boolean).join("\n");

  const response = await withRetry("qaEvaluate", () =>
    ai.models.generateContent({
      model: MODEL_VISION,
      contents: [{
        role: "user",
        parts: [
          { text: qaPrompt },
          { text: "Image 1 - original upload" }, getImagePart(originalBase64),
          { text: "Image 2 - selected studio reference" }, getImagePart(studioImageBase64),
          { text: "Image 3 - generated result" }, getImagePart(generatedBase64),
        ],
      }],
      config: { temperature: 0, responseMimeType: "application/json", responseJsonSchema: QA_SCHEMA },
    }),
  );

  const data = JSON.parse(response.text || "{}");
  return {
    pass: Boolean(data.pass),
    issues: Array.isArray(data.issues) ? data.issues : [],
    severity: data.severity || "medium",
    retry_recommended: Boolean(data.retry_recommended),
  };
}

// -----------------------------------------------------------
// STEP 1 — BACKGROUND REMOVAL
// -----------------------------------------------------------
async function removeBackground(
  imageBase64: string,
  apiKey?: string,
): Promise<string> {
  if (!apiKey) return imageBase64;
  try {
    const fd = new FormData();
    fd.append("image_file_b64", stripDataPrefix(imageBase64));
    fd.append("size", "auto");
    fd.append("format", "png");
    const response = await fetch(REMBG_API, {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: fd,
    });
    if (!response.ok) return imageBase64;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return buildDataUri(bytes, "image/png");
  } catch (error) {
    console.warn("[removeBackground] Falling back to original image:", error);
    return imageBase64;
  }
}

// -----------------------------------------------------------
// GEMINI ISOLATION FALLBACK
// -----------------------------------------------------------
async function geminiIsolate(
  ai: GoogleGenAI,
  imageBase64: string,
): Promise<string> {
  await interCallDelay();
  const isolatePrompt = [
    "Extract ONLY the vehicle from this image and place it on a pure white (#FFFFFF) background.",
    "Remove EVERYTHING that is not part of the vehicle: road, pavement, buildings, sky, trees, people, shadows.",
    "The vehicle body, wheels, glass, mirrors, badges, and trim must remain exactly as-is.",
    "The white background must be flat and uniform with NO gradients and NO ground shadows.",
    "Do not change the input aspect ratio.",
  ].join(" ");

  const response: any = await withRetry("geminiIsolate", () =>
    ai.models.generateContent({
      model: MODEL_IMAGE,
      contents: [{ role: "user", parts: [{ text: isolatePrompt }, getImagePart(imageBase64)] }],
      config: { temperature: 0.05, topP: 0.15, topK: 5, candidateCount: 1, responseModalities: ["Image"] as string[], safetySettings: SAFETY_SETTINGS },
    }),
  );

  const part = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data);
  if (!part?.inlineData?.data) {
    throw new Error("Gemini failed to extract the vehicle onto a white background.");
  }
  validateImageOutput(part.inlineData.data, "geminiIsolate");
  return `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
}

// -----------------------------------------------------------
// STEP 1.5 — REFLECTION FIX (Developer A pipeline)
// -----------------------------------------------------------
async function fixReflections(
  ai: GoogleGenAI,
  carBase64: string,
): Promise<string> {
  const clean = stripDataPrefix(carBase64);
  try {
    console.log("[fixReflections] Stripping environment reflections...");
    const response: any = await withRetry("fixReflections", () =>
      ai.models.generateContent({
        model: MODEL_IMAGE,
        contents: [{
          role: "user",
          parts: [
            {
              text: `Remove all environment-specific reflections from this car's paint.
Strip: dealership walls, indoor ceiling colors, window light streaks, floor color bleed, any location-specific color visible in the paint.
Replace with: neutral flat mid-tone reflections — no color, no warmth, no coolness.
Keep everything else identical — shape, color, plate, lights, wheels.
The goal is a clean neutral base so the final compositor can apply correct reflections from the actual studio background.`,
            },
            { inlineData: { data: clean, mimeType: "image/png" } },
          ],
        }],
        config: { temperature: 0.35, topP: 0.6, topK: 20, responseModalities: ["IMAGE", "TEXT"] },
      }),
    );

    const imagePart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    console.log(`📊 [TOKENS][fixReflections] in:${response.usageMetadata?.promptTokenCount} out:${response.usageMetadata?.candidatesTokenCount} total:${response.usageMetadata?.totalTokenCount}`);
    if (!imagePart?.inlineData?.data) return carBase64;
    console.log("[fixReflections] ✓ Environment reflections stripped.");
    return `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`;
  } catch (err) {
    console.warn("[fixReflections] ⚠ Failed, using original:", err);
    return carBase64;
  }
}

// -----------------------------------------------------------
// STEP 3 — EXTERIOR STUDIO COMPOSITOR (Developer A)
// -----------------------------------------------------------
async function refineExterior(
  ai: GoogleGenAI,
  carImage: string,
  studioImage: string,
  angle: string,
  branding?: { isEnabled?: boolean; logoUrl?: string | null },
): Promise<string> {
  const isOpen = angle?.includes("OPEN") || false;

  const prompt = [
    `You are an automotive studio compositor.`,
    `Your tools are: background replacement, lighting adjustment, surface reflection editing, and ground shadow generation.`,
    `You do NOT retouch, repair, redesign, or restructure vehicles in any way.`,
    ``,
    `TARGET OUTPUT VISION:`,
    `The car must look like it was originally photographed in the studio environment shown in Image 2.`,
    `Study Image 2 carefully — its floor color, wall color, lighting color, brightness, and mood.`,
    `Every decision you make must be driven by what Image 2 looks like — not by any assumed studio style.`,
    `The final result must feel like a single cohesive photograph taken in that exact environment.`,
    ``,
    `═══ TASK A — BACKGROUND REPLACEMENT ═══`,
    `Replace EVERYTHING that is NOT the car with the studio environment from Image 2.`,
    `- Preserve the car's silhouette, position, and camera angle exactly — do NOT reframe`,
    `- Blend the car's edges smoothly into the floor and walls of Image 2 — no hard cutout lines`,
    `- The floor from Image 2 extends naturally beneath and around all four corners of the car`,
    `- Match the ambient colour temperature at the car's edges to the environment in Image 2`,
    ``,
    `═══ TASK B — SURFACE REFLECTION UPDATE ═══`,
    ``,
    `STEP 1 — READ IMAGE 2: Study the studio background carefully.`,
    `Note its dominant light color (warm, cool, neutral), brightness, and floor color.`,
    `All reflections you apply to the car must come from THIS environment — not from a generic white studio.`,
    ``,
    `STEP 2 — READ IMAGE 1: Identify the car's paint color (black, white, grey, silver, red, blue, etc.)`,
    ``,
    `STEP 3 — STRIP ALL ORIGINAL ENVIRONMENT REFLECTIONS from every body panel:`,
    `These must always be removed regardless of paint color or shooting angle:`,
    `- Dealership walls, banners, logos visible in the paint → REMOVE`,
    `- Ceiling tiles, fluorescent strips, indoor lighting colors → REMOVE`,
    `- Window light streaks, natural daylight patches → REMOVE`,
    `- Warm orange/amber floor glow on lower panels → REMOVE`,
    `- Any color belonging to the original shooting location → REMOVE`,
    ``,
    `STEP 4 — APPLY REFLECTIONS FROM IMAGE 2's ENVIRONMENT:`,
    `The reflection color, brightness, and tone must match Image 2's lighting — not assumed white:`,
    ``,
    `FOR LIGHT PAINT (white, silver, light grey, champagne):`,
    `- Upper panel edge: bright highlight streak matching Image 2's light source color`,
    `- Main panel: smooth horizontal gradient in Image 2's ambient tone`,
    `- Lower panel: slightly deeper, fading toward floor color from Image 2`,
    ``,
    `FOR MEDIUM PAINT (grey, graphite, dark silver, bronze, brown):`,
    `- Upper panel edge: sharp highlight streak from Image 2's light source`,
    `- Shoulder crease: secondary thinner highlight along body line`,
    `- Main panel: neutral mid-tone matching Image 2's ambient color temperature`,
    `- Lower panel: deeper tone fading down — no warm bleed unless Image 2 floor is warm`,
    ``,
    `FOR DARK PAINT (black, dark navy, dark green, dark red):`,
    `- Upper panel edge: sharp narrow highlight from Image 2's light source`,
    `- Shoulder crease: second thinner streak along body crease`,
    `- Everything else: deep intentional dark — correct for dark paint`,
    `- Only permit warm tones if Image 2's environment is genuinely warm-toned`,
    `- If Image 2 is neutral/cool — NO amber, NO orange anywhere on dark panels`,
    ``,
    `FOR BRIGHT/SATURATED PAINT (red, blue, yellow, orange, green):`,
    `- Keep base color fully saturated — do not grey it out`,
    `- Highlights blend naturally from Image 2's light source color into the base hue`,
    `- No foreign color mixing into the base hue`,
    ``,
    `APPLY TO ALL SURFACES EQUALLY — front, sides, AND rear panels must all match:`,
    `- Rear panels and trunk lid are most likely to retain original environment reflections — treat with extra care`,
    `- Chrome/trim: clean highlight from Image 2's light source, no original environment bleed`,
    `- Glass/windscreen: faint reflection of Image 2's ceiling/upper environment`,
    `- Tail lights and head lights: keep their natural color — do not alter`,
    ``,
    `═══ TASK C — LIGHTING MATCH ═══`,
    `Match the car's lighting to Image 2's environment exactly:`,
    `- Study Image 2 — is the lighting warm, cool, or neutral? Bright or moody? Directional or diffuse?`,
    `- Apply that same lighting character to the car body`,
    `- Remove all original directional shadows or harsh highlights from the car`,
    `- Metallic/glossy paint must hold mid-tone detail — do NOT blow any surface to pure featureless white or black`,
    `- The car's overall brightness and color temperature must match Image 2 seamlessly`,
    `- The car must not look pasted in from a different exposure or lighting environment`,
    ``,
    `═══ TASK D — SHADOW & GROUNDING ═══`,
    `Ground the car physically in the floor shown in Image 2:`,
    ``,
    `Study Image 2's floor — note its color, reflectivity, and any existing shadows or markings.`,
    `All grounding elements must be consistent with that floor.`,
    ``,
    `Tyre contact shadows (required for each visible tyre):`,
    `- Darkest exactly at rubber-to-floor contact point`,
    `- Softens and fades outward naturally — consistent with Image 2's lighting direction`,
    `- Each tyre must look compressed against the floor, not hovering`,
    ``,
    `Vehicle undercar shadow:`,
    `- Soft shadow fans outward from under the chassis`,
    `- Darkness and spread consistent with Image 2's lighting intensity`,
    `- Blends naturally into the floor — no sharp outer boundary`,
    ``,
    `Floor reflection (if Image 2's floor is glossy or reflective):`,
    `- Add a subtle reflection of the car's lower surfaces in the floor`,
    `- Match the reflectivity level visible in Image 2 — do not add gloss if Image 2 floor is matte`,
    ``,
    `If Image 2 has a turntable ring or floor markings — include them naturally beneath the car.`,
    ``,
    `═══ WHAT MUST NEVER CHANGE ═══`,
    ``,
    `❌ Camera angle — locked from Image 1`,
    `   Whatever angle is in Image 1 (front, rear, side, 3/4, diagonal) — output must match exactly`,
    `   Any angle change = automatic failure`,
    ``,
    `❌ Car orientation — no mirroring or flipping of any kind`,
    `   Every visible feature must be on the same side as in Image 1`,
    ``,
    `❌ Car geometry — proportions, shape, and all body panels unchanged`,
    ``,
    `❌ Damage — every scratch, dent, crumple, and broken piece stays fully visible`,
    `   Do NOT repair, smooth, heal, or hide any damage`,
    ``,
    `❌ Paint colour — base hue is fixed, do not shift it`,
    ``,
    `❌ ${isOpen ? "Open positions — doors/trunk/hood open in Image 1 STAY open" : "Closed state — all doors, hood, and trunk stay closed as in Image 1"}`,
    ``,
    `❌ Attached objects — number plates, tow bars, stickers all stay on`,
    ``,
    `❌ Interior — cabin completely unchanged`,
    ``,
    `LICENCE PLATE RULE:`,
    `If a licence plate is visible in Image 1 — reproduce it exactly in the output.`,
    `Same characters, same colors, same position on the car.`,
    `If the plate is not visible from the shooting angle — do not invent one.`,
    ``,
    `═══ OUTPUT SPECIFICATION ═══`,
    `- Aspect ratio: 4:3 (landscape)`,
    `- Car occupies 75–80% of frame width — comfortable breathing room on all sides`,
    `- Final image must feel like a single professional studio photograph taken in Image 2's environment — not a composite`,
    branding?.isEnabled ? `\n• BRANDING: Place the logo (Image 3) in the top-left corner — small and unobtrusive` : "",
  ].filter(Boolean).join("\n");

  return generateExteriorImage(ai, carImage, studioImage, branding, prompt);
}

// -----------------------------------------------------------
// CORE IMAGE GENERATOR
// -----------------------------------------------------------
async function generateExteriorImage(
  ai: GoogleGenAI,
  carImage: string,
  studioBackground: string,
  branding: { isEnabled?: boolean; logoUrl?: string | null } | undefined,
  promptText: string,
): Promise<string> {
  const cleanCar = stripDataPrefix(carImage);

  const parts: any[] = [
    { text: promptText },
    { text: "Image 1 — PRIMARY SUBJECT (car, preserve geometry exactly):" },
    { inlineData: { data: cleanCar, mimeType: detectMimeType(carImage) } },
  ];

  if (studioBackground) {
    const cleanStudio = stripDataPrefix(studioBackground);
    if (cleanStudio) {
      parts.push(
        { text: "Image 2 — STUDIO BACKGROUND environment:" },
        { inlineData: { data: cleanStudio, mimeType: detectMimeType(studioBackground) } },
      );
    }
  }

  if (branding?.isEnabled && branding?.logoUrl) {
    const cleanLogo = stripDataPrefix(branding.logoUrl);
    parts.push(
      { text: "Image 3 — BRANDING LOGO (place top-left corner, small):" },
      { inlineData: { data: cleanLogo, mimeType: "image/png" } },
    );
  }

  console.log(`   Generating with ${MODEL_IMAGE} (${parts.length} parts)...`);

  const response: any = await withRetry("generateExteriorImage", () =>
    ai.models.generateContent({
      model: MODEL_IMAGE,
      contents: [{ role: "user", parts }],
      config: {
        temperature: 0.01,
        topP: 0.05,
        topK: 2,
        candidateCount: 1,
        responseModalities: ["Image"] as string[],
        safetySettings: SAFETY_SETTINGS,
      },
    }),
  );

  const candidate = response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find((p: any) => p.inlineData?.data);
  console.log(`📊 [TOKENS][generateExteriorImage] in:${response.usageMetadata?.promptTokenCount} out:${response.usageMetadata?.candidatesTokenCount} total:${response.usageMetadata?.totalTokenCount}`);

  if (!imagePart?.inlineData?.data) {
    const reason = candidate?.finishReason || "UNKNOWN";
    throw new Error(`Exterior image generation failed. FinishReason: ${reason}`);
  }

  validateImageOutput(imagePart.inlineData.data, "generateExteriorImage");
  const mimeType = imagePart.inlineData.mimeType || "image/png";
  return `data:${mimeType};base64,${imagePart.inlineData.data}`;
}

// -----------------------------------------------------------
// EXTERIOR PIPELINE — Full flow
// remove.bg → fixReflections → refineExterior → QA
// -----------------------------------------------------------
async function runExteriorPipeline(params: {
  ai: GoogleGenAI;
  originalBase64: string;
  studioImageBase64: string;
  angle: string;
  branding?: { isEnabled?: boolean; logoUrl?: string | null };
  removeBgKey?: string;
  qaIssues?: string[];
}): Promise<string> {
  // Step 1: Background removal
  console.log("📷 [exterior] Step 1: Background removal");
  let subjectImage = params.originalBase64;
  if (params.removeBgKey) {
    console.log("[exterior] Trying remove.bg for car isolation...");
    const removed = await removeBackground(params.originalBase64, params.removeBgKey);
    if (removed !== params.originalBase64) {
      subjectImage = removed;
      console.log("[exterior] remove.bg isolation succeeded.");
    } else {
      console.warn("[exterior] remove.bg returned original — falling back to Gemini isolation.");
      subjectImage = await geminiIsolate(params.ai, params.originalBase64);
    }
  } else {
    console.log("[exterior] No REMOVE_BG_API_KEY — using Gemini isolation.");
    subjectImage = await geminiIsolate(params.ai, params.originalBase64);
  }

  // Step 1.5: Strip environment reflections
  console.log("🔧 [exterior] Step 1.5: Stripping environment reflections...");
  subjectImage = await fixReflections(params.ai, subjectImage);
  await interCallDelay();

  // Step 2: Studio compositing
  console.log("✨ [exterior] Step 2: AI studio compositor");
  const result = await refineExterior(
    params.ai,
    subjectImage,
    params.studioImageBase64,
    params.angle,
    params.branding,
  );

  console.log("✅ [exterior] Pipeline complete");
  return result;
}

// -----------------------------------------------------------
// PROCESS SINGLE GENERATION JOB (EXTERIOR ONLY)
// -----------------------------------------------------------
async function processExteriorJob(params: {
  ai: GoogleGenAI;
  supabase: SupabaseClientAny;
  job: JobRow;
  studioImageBase64: string;
  removeBgKey?: string;
  studioHints?: StudioHints;
  qualityReference?: QualityReference | null;
}) {
  const { ai, supabase, job, studioImageBase64, removeBgKey, studioHints } = params;

  await updateJob(supabase, job.id, {
    status: "classifying",
    attempt_count: (job.attempt_count || 0) + 1,
  });

  const originalBase64 = await fetchImageAsDataUri(job.original_image_url);
  const classification = await classifyImage(ai, originalBase64, job.original_angle);
  await interCallDelay();
  const effectiveCategory = (job.classification_override || classification.category) as string;

  // Save classification results
  await updateJob(supabase, job.id, {
    detected_category: classification.category,
    classifier_confidence: classification.confidence,
    subject_type: classification.subject_type,
    angle_family: classification.angle_family,
    crop_lock: classification.crop_lock,
    classification_notes: classification.notes,
    route_version: ROUTE_VERSION,
    prompt_version: PROMPT_VERSION,
  });

  // ── NOT EXTERIOR? Skip — let process-image handle it ──
  if (effectiveCategory !== "EXTERIOR") {
    console.log(`[process-exterior] Job ${job.id} is ${effectiveCategory}, not EXTERIOR — skipping (returning to pending)`);
    await updateJob(supabase, job.id, {
      status: "pending",
      error_message: null,
    });
    return;
  }

  // ── Reject or low confidence ──
  if (
    classification.category === "REJECT" ||
    (!job.classification_override && classification.confidence < CLASSIFICATION_CONFIDENCE_THRESHOLD)
  ) {
    await updateJob(supabase, job.id, {
      status: "needs_review",
      needs_review: true,
      qa_status: "failed",
      qa_issues: classification.category === "REJECT" ? ["category_mismatch"] : ["low_confidence"],
      qa_severity: "medium",
      error_message: classification.category === "REJECT"
        ? "Image could not be classified safely."
        : "Classification confidence below threshold.",
    });
    return;
  }

  await updateJob(supabase, job.id, {
    status: "processing",
    needs_review: false,
    error_message: null,
  });

  // Pre-generation cleanup
  const actionableIssues = classification.quality_issues.filter((i) => i !== "none");
  let cleanedBase64 = originalBase64;
  if (actionableIssues.length > 0) {
    cleanedBase64 = await cleanupImage(ai, originalBase64, classification.quality_issues);
    console.log(`[exterior] Cleanup applied for issues: ${actionableIssues.join(", ")}`);
    await updateJob(supabase, job.id, { quality_issues: actionableIssues });
  }

  // Run exterior pipeline
  let generated = await runExteriorPipeline({
    ai,
    originalBase64: cleanedBase64,
    studioImageBase64,
    angle: job.original_angle,
    removeBgKey,
  });

  // QA evaluation
  let qa = await qaEvaluate(ai, originalBase64, studioImageBase64, generated, studioHints);

  // Retry if QA recommends
  if (!qa.pass && qa.retry_recommended) {
    console.log("[exterior] QA retry — regenerating...");
    generated = await runExteriorPipeline({
      ai,
      originalBase64: cleanedBase64,
      studioImageBase64,
      angle: job.original_angle,
      removeBgKey,
      qaIssues: qa.issues,
    });
    qa = await qaEvaluate(ai, originalBase64, studioImageBase64, generated, studioHints);
  }

  // Upload and finalize
  const generatedRawUrl = await uploadImageToStorage(
    supabase,
    `${job.user_id}/${job.project_id}/jobs/${job.id}_generated_raw.png`,
    generated,
  );

  await updateJob(supabase, job.id, {
    status: qa.pass ? "completed" : "needs_review",
    generated_raw_url: generatedRawUrl,
    qa_status: qa.pass ? "passed" : "failed",
    qa_issues: qa.issues,
    qa_severity: qa.severity,
    needs_review: !qa.pass,
    error_message: qa.pass ? null : `QA flagged issues: ${qa.issues.join(", ")}`,
  });
}

// -----------------------------------------------------------
// BATCH PROCESSOR — 5 concurrent jobs
// -----------------------------------------------------------
async function processQueuedJobs(params: {
  ai: GoogleGenAI;
  supabase: SupabaseClientAny;
  projectId: string;
  studioImageBase64: string;
  removeBgKey?: string;
  studioHints?: StudioHints;
  qualityReference?: QualityReference | null;
}): Promise<{ processed: number; remaining: number }> {
  const { data: jobs, error } = await params.supabase
    .from("generation_jobs")
    .select("id,project_id,user_id,original_image_url,original_angle,studio_id,classification_override,attempt_count")
    .eq("project_id", params.projectId)
    .in("status", ["pending", "queued", "classifying", "processing"])
    .order("created_at", { ascending: true });

  if (error) throw error;

  const pendingJobs = (jobs || []) as JobRow[];
  if (pendingJobs.length === 0) {
    return { processed: 0, remaining: 0 };
  }

  // Take up to BATCH_CONCURRENCY jobs at a time
  const batch = pendingJobs.slice(0, BATCH_CONCURRENCY);
  console.log(`[process-exterior] Processing batch of ${batch.length} jobs (${pendingJobs.length} total pending)`);

  // Reset stuck intermediate-status jobs
  for (const job of batch) {
    if ((job as any).status === "classifying" || (job as any).status === "processing") {
      console.warn(`[process-exterior] Job ${job.id} was stuck in "${(job as any).status}" — resetting.`);
      await params.supabase
        .from("generation_jobs")
        .update({ status: "pending", error_message: null })
        .eq("id", job.id);
    }
  }

  // Process batch concurrently
  const results = await Promise.allSettled(
    batch.map(async (job) => {
      try {
        await processExteriorJob({
          ai: params.ai,
          supabase: params.supabase,
          job,
          studioImageBase64: params.studioImageBase64,
          removeBgKey: params.removeBgKey,
          studioHints: params.studioHints,
          qualityReference: params.qualityReference,
        });
      } catch (jobError) {
        console.error("[process-exterior] Job failed:", job.id, jobError);
        await updateJob(params.supabase, job.id, {
          status: "failed",
          qa_status: "failed",
          needs_review: true,
          error_message: jobError instanceof Error ? jobError.message : String(jobError),
        });
      }
    }),
  );

  await syncProjectSummary(params.supabase, params.projectId);

  const processed = results.filter((r) => r.status === "fulfilled").length;
  return { processed, remaining: pendingJobs.length - batch.length };
}

// -----------------------------------------------------------
// ENTRY POINT — Deno.serve
// -----------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── API Key Pool: pick random key from comma-separated list ──
    const apiKeysRaw = Deno.env.get("GEMINI_API_KEY");
    const removeBgKey = Deno.env.get("REMOVE_BG_API_KEY");
    const supabaseUrl =
      Deno.env.get("PROJECT_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
    const serviceRoleKey =
      Deno.env.get("PROJECT_SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!apiKeysRaw) throw new Error("GEMINI_API_KEY not configured");
    if (!supabaseUrl || !serviceRoleKey)
      throw new Error("Supabase service credentials not configured");

    const apiKeys = apiKeysRaw.split(",").map((k) => k.trim()).filter(Boolean);
    const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];
    console.log(`🔑 [KEY-POOL] Using key ${apiKeys.indexOf(apiKey) + 1}/${apiKeys.length}`);

    const ai = new GoogleGenAI({ apiKey });
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { action, payload } = await req.json();

    // ── Batch processing ──
    if (action === "process-generation-jobs") {
      const processingPromise = processQueuedJobs({
        ai,
        supabase,
        projectId: payload.projectId,
        studioImageBase64: payload.studioImageBase64,
        removeBgKey,
        studioHints: payload.studioHints,
        qualityReference: payload.qualityReference,
      });

      // @ts-ignore – EdgeRuntime is injected by the Supabase edge runtime
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(processingPromise);
      } else {
        await processingPromise;
      }

      return new Response(
        JSON.stringify({ ok: true, status: "processing", remaining: 1 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Single image processing (legacy) ──
    if (action === "process-image") {
      const result = await runExteriorPipeline({
        ai,
        originalBase64: payload.originalBase64,
        studioImageBase64: payload.studioImageBase64,
        angle: payload.angle || "EXTERIOR",
        branding: payload.branding,
        removeBgKey,
      });
      return new Response(JSON.stringify({ processedImage: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("process-exterior error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
