// @ts-ignore
import {
  GoogleGenAI,
  createPartFromUri,
  HarmBlockThreshold,
  HarmCategory,
  type SafetySetting,
} from "npm:@google/genai";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL_IMAGE = "gemini-2.5-flash-image";
const MODEL_IMAGE_INTERIOR = "gemini-3.1-flash-image-preview";
const MODEL_VISION = "gemini-2.5-flash";
const REMBG_API = "https://api.remove.bg/v1.0/removebg";
const STORAGE_BUCKET = "project-images";
const CLASSIFICATION_CONFIDENCE_THRESHOLD = 0.85;
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1200;
const RETRY_QUOTA_DELAY_MS = 20000; // 20s base for 429/quota errors
const INTER_CALL_DELAY_MS = 1500; // pause between sequential model calls
const ROUTE_VERSION = "2026-03-08";
const PROMPT_VERSION = "2026-03-09-reflection-quality-v27";

const SAFETY_SETTINGS: SafetySetting[] = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CLASSIFICATION_SCHEMA = {
  type: "object",
  properties: {
    category: {
      type: "string",
      enum: [
        "EXTERIOR",
        "EXTERIOR_DETAIL",
        "INTERIOR",
        "INTERIOR_DETAIL",
        "REJECT",
      ],
    },
    confidence: { type: "number" },
    subject_type: {
      type: "string",
      enum: ["full_vehicle", "cabin", "component", "invalid"],
    },
    angle_family: {
      type: "string",
      enum: [
        "front",
        "rear",
        "side",
        "three_quarter",
        "interior",
        "detail",
        "unknown",
      ],
    },
    crop_lock: { type: "boolean" },
    notes: {
      type: "array",
      items: { type: "string" },
    },
    quality_issues: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "none",
          "photographer_visible",
          "photographer_reflection",
          "camera_obstruction",
          "motion_blur",
          "out_of_focus",
          "severe_noise",
          "underexposed",
          "overexposed",
          "flash_glare",
        ],
      },
    },
  },
  required: [
    "category",
    "confidence",
    "subject_type",
    "angle_family",
    "crop_lock",
    "notes",
    "quality_issues",
  ],
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
          "geometry_changed",
          "hallucinated_part",
          "plate_mismatch",
          "paint_shift",
          "crop_changed",
          "outdoor_reflection_left",
          "windshield_outdoor_content",
          "body_panel_outdoor_reflection",
          "shadow_mismatch",
          "studio_surrounding_mismatch",
          "interior_structure_changed",
          "interior_color_changed",
          "interior_content_lost",
          "window_outdoor_content_remaining",
          "window_studio_not_visible",
          "interior_lighting_mismatch",
          "zoom_or_crop_drift",
          "angle_or_direction_changed",
          "wheel_design_changed",
          "badge_text_changed",
          "caliper_color_changed",
          "trim_altered",
          "component_detail_lost",
          "material_texture_changed",
          "cleanup_artifact_remaining",
          "not_4_3",
          "category_mismatch",
          "low_confidence",
        ],
      },
    },
    severity: { type: "string", enum: ["low", "medium", "high"] },
    retry_recommended: { type: "boolean" },
  },
  required: ["pass", "issues", "severity", "retry_recommended"],
};

type QualityIssue =
  | "none"
  | "photographer_visible"
  | "photographer_reflection"
  | "camera_obstruction"
  | "motion_blur"
  | "out_of_focus"
  | "severe_noise"
  | "underexposed"
  | "overexposed"
  | "flash_glare";

type ClassificationResult = {
  category:
  | "EXTERIOR"
  | "EXTERIOR_DETAIL"
  | "INTERIOR"
  | "INTERIOR_DETAIL"
  | "REJECT";
  confidence: number;
  subject_type: "full_vehicle" | "cabin" | "component" | "invalid";
  angle_family:
  | "front"
  | "rear"
  | "side"
  | "three_quarter"
  | "interior"
  | "detail"
  | "unknown";
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

function stripDataPrefix(base64: string): string {
  return base64.includes(",") ? base64.split(",")[1] : base64;
}

function detectMimeType(image: string): string {
  if (image.startsWith("data:image/png")) return "image/png";
  if (image.startsWith("data:image/webp")) return "image/webp";
  return "image/jpeg";
}

function decodeBase64(base64: string): Uint8Array {
  const clean = stripDataPrefix(base64);
  const binary = atob(clean);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  // Plain for-loop avoids per-element JS callback overhead of Uint8Array.from
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function buildDataUri(bytes: Uint8Array, mimeType: string): string {
  // Process in 32 KB chunks via String.fromCharCode.apply to avoid the
  // O(n²) per-byte string-concatenation that was killing the CPU budget.
  const CHUNK = 0x8000; // 32 768 bytes
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    // @ts-ignore – spread into apply is intentional here
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

  // Reject tiny responses (< 5KB base64) which are typical for API degradation/429s returning 1x1 or error icons
  if (cleanData.length < 5000) {
    throw new Error(
      `[${label}] Image output too small (${cleanData.length} chars). Potential API degradation or rate limit.`,
    );
  }

  // Magic bytes check
  if (
    !cleanData.startsWith("iVBORw0KGgo") &&
    !cleanData.startsWith("/9j/") &&
    !cleanData.startsWith("UklGR")
  ) {
    console.warn(
      `[${label}] Possible image corruption: missing JPG/PNG/WEBP magic bytes (${cleanData.substring(0, 10)}...)`,
    );
  }
}

function isTransientError(message: string): boolean {
  return [
    "500",
    "503",
    "429",
    "overloaded",
    "UNAVAILABLE",
    "INTERNAL",
    "RESOURCE_EXHAUSTED",
    "fetch",
    "SendRequest",
    "connection error",
    "close_notify",
    "TLS",
    "ECONNRESET",
    "ETIMEDOUT",
    "error reading",
    "body from connection",
    "unexpected eof",
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
      if (!isTransientError(message) || attempt === RETRY_ATTEMPTS) {
        break;
      }
      // 429 / quota errors need a much longer wait than ordinary transient errors.
      // Standard backoff (1.2 s, 2.4 s) is far too short for Google's rate-limit
      // reset window, so we use 20 s / 40 s for quota exhaustion.
      const isQuota = isQuotaError(message);
      const delay = isQuota
        ? RETRY_QUOTA_DELAY_MS * attempt // 20 s, 40 s
        : RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1); // 1.2 s, 2.4 s
      console.warn(
        `[${label}] attempt ${attempt} failed (${isQuota ? "QUOTA" : "transient"}). Retrying in ${delay}ms.`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

/** Small pause injected between sequential model calls to reduce burst rate. */
async function interCallDelay(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, INTER_CALL_DELAY_MS));
}

async function fetchImageAsDataUri(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${url}`);
  }
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
    .upload(path, bytes, {
      contentType,
      upsert: true,
    });
  if (error) throw error;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function ensureStudioFile(
  ai: GoogleGenAI,
  supabase: SupabaseClientAny,
  studioId: string,
  studioImageBase64: string,
): Promise<{ uri: string; mimeType: string } | null> {
  try {
    const { data: studio } = await supabase
      .from("studio_catalog")
      .select("id,gemini_file_uri,gemini_file_name")
      .eq("studio_id", studioId)
      .maybeSingle();

    if (studio?.gemini_file_uri && studio?.gemini_file_name) {
      return {
        uri: studio.gemini_file_uri,
        mimeType: detectMimeType(studioImageBase64),
      };
    }

    const bytes = decodeBase64(studioImageBase64);
    const buffer = Uint8Array.from(bytes).buffer as ArrayBuffer;
    const blob = new Blob([buffer], {
      type: detectMimeType(studioImageBase64),
    });
    const uploaded = await ai.files.upload({
      file: blob,
      config: {
        mimeType: blob.type,
        displayName: `studio-${studioId}`,
      },
    });

    await supabase
      .from("studio_catalog")
      .update({
        gemini_file_uri: uploaded.uri,
        gemini_file_name: uploaded.name,
      })
      .eq("studio_id", studioId);

    return uploaded.uri ? { uri: uploaded.uri, mimeType: blob.type } : null;
  } catch (error) {
    console.warn(
      "[studio-file-cache] Falling back to inline studio image:",
      error,
    );
    return null;
  }
}

function createStudioPart(
  studioImageBase64: string,
  studioFile: { uri: string; mimeType: string } | null,
) {
  if (studioFile?.uri) {
    return createPartFromUri(studioFile.uri, studioFile.mimeType);
  }
  return getImagePart(studioImageBase64);
}

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
                "  • motion_blur: the image is blurry due to camera shake or movement during capture.",
                "  • out_of_focus: the main subject (vehicle/component) is soft or unfocused.",
                "  • severe_noise: the image is very grainy or noisy (typical of low-light phone shots).",
                "  • underexposed: the image is too dark to clearly see vehicle details.",
                "  • overexposed: large areas are blown out / pure white with lost detail.",
                "  • flash_glare: harsh flash reflection creates a bright glare spot on the vehicle surface.",
                "  • none: the image is clean with none of the above issues.",
                '  List every issue that is present. If the image is clean, return ["none"].',
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
  const rawIssues: string[] = Array.isArray(data.quality_issues)
    ? data.quality_issues
    : ["none"];
  const validIssues: QualityIssue[] = rawIssues.filter(
    (i: string): i is QualityIssue =>
      [
        "none",
        "photographer_visible",
        "photographer_reflection",
        "camera_obstruction",
        "motion_blur",
        "out_of_focus",
        "severe_noise",
        "underexposed",
        "overexposed",
        "flash_glare",
      ].includes(i),
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

// Build a targeted inpainting prompt for each quality issue type.
// Following Google's official guidance: one concern per pass, using
// "change only X, keep everything else exactly the same" pattern.
function buildCleanupPrompt(issue: QualityIssue): string {
  const prompts: Record<QualityIssue, string> = {
    none: "",
    photographer_visible: [
      "Using the provided image, remove the visible photographer — including any hands, arms, fingers, phone device, or body parts that are directly visible in the frame.",
      "Fill the area where they were with the natural continuation of the vehicle surface, interior, or background that would realistically be there.",
      "Keep everything else in the image exactly the same: vehicle shape, paint color, all vehicle details, framing, and composition.",
      "Do not change the input aspect ratio.",
    ].join(" "),
    photographer_reflection: [
      "Using the provided image, remove the photographer's reflection — including any reflected silhouette, hands, phone device, or dark human-shaped outline visible in the car's painted panels, chrome trim, glass, mirrors, instrument-cluster covers, infotainment screens, glossy piano-black trim, glossy wood trim, or chrome bezels.",
      "On interior glossy surfaces, replace the human reflection with a clean studio-consistent highlight or the true underlying display/material detail that should be visible there with no person present.",
      "Preserve all screen content, digits, icons, text, gauge markings, and trim geometry exactly. Do not blur, blank, simplify, or redesign any display or reflective component.",
      "Keep everything else in the image exactly the same: vehicle geometry, paint color, all surface details, framing, and composition.",
      "Do not change the input aspect ratio.",
    ].join(" "),
    camera_obstruction: [
      "Using the provided image, remove any physical obstruction at the frame edges — including fingers, hand edges, phone case corners, or lens obstructions partially blocking the view.",
      "Fill the obscured area with the natural continuation of whatever is behind it (vehicle body, background, etc.).",
      "Keep everything else in the image exactly the same.",
      "Do not change the input aspect ratio.",
    ].join(" "),
    motion_blur: [
      "Using the provided image, correct the motion blur throughout the image to produce a sharp, clear photograph.",
      "Restore fine surface details on the vehicle — panel edges, badging, wheel spokes, texture — as they would appear in a sharp capture from the same angle.",
      "Keep the composition, framing, vehicle shape, colors, and all content exactly the same. Do not add or remove any elements.",
      "Do not change the input aspect ratio.",
    ].join(" "),
    out_of_focus: [
      "Using the provided image, correct the soft focus so that the main automotive subject is sharp and in focus.",
      "Restore visible surface details — paint texture, badge lettering, trim edges, stitching — as they would appear in a properly focused capture.",
      "Keep the composition, framing, colors, and all content exactly the same. Do not add or remove any elements.",
      "Do not change the input aspect ratio.",
    ].join(" "),
    severe_noise: [
      "Using the provided image, reduce the severe digital noise and grain to produce a clean, smooth photograph.",
      "Preserve all underlying vehicle detail — do not smooth away real surface texture, badge text, or structural edges.",
      "Keep the composition, framing, colors, and all content exactly the same.",
      "Do not change the input aspect ratio.",
    ].join(" "),
    underexposed: [
      "Using the provided image, correct the underexposure to reveal full vehicle detail.",
      "Brighten shadow areas naturally so that vehicle paint, trim, interior leather, dashboard surfaces, seat textures, and all materials are clearly visible with full detail, matching a properly exposed professional photograph.",
      "Recover detail in dark footwells, door pockets, lower dashboard areas, and seat creases.",
      "Keep the composition, framing, and all content exactly the same. Do not change colors beyond restoring natural brightness.",
      "Do not change the input aspect ratio.",
    ].join(" "),
    overexposed: [
      "Using the provided image, correct the overexposure by recovering blown-out highlight areas.",
      "Restore detail in bright surfaces — paint highlights, window glass, light-colored trim, leather seat highlights, dashboard gloss, steering wheel shine, and any interior surface where texture detail has been lost to overexposure.",
      "Ensure material textures (leather grain, stitching, perforations, wood grain, brushed metal) are visible in previously blown-out areas.",
      "Keep the composition, framing, and all content exactly the same. Do not change colors beyond restoring natural tones.",
      "Do not change the input aspect ratio.",
    ].join(" "),
    flash_glare: [
      "Using the provided image, remove the harsh flash glare spots from the vehicle surfaces.",
      "Replace each glare spot with the natural paint color, surface texture, and ambient reflection that would appear in that area without direct flash.",
      "Keep everything else in the image exactly the same: vehicle shape, all other colors, composition, and framing.",
      "Do not change the input aspect ratio.",
    ].join(" "),
  };
  return prompts[issue] || "";
}

async function cleanupImage(
  ai: GoogleGenAI,
  imageBase64: string,
  issues: QualityIssue[],
): Promise<string> {
  // Filter out 'none' — only process real issues
  const actionableIssues = issues.filter((i) => i !== "none");
  if (actionableIssues.length === 0) return imageBase64;

  let current = imageBase64;

  // Process one issue at a time — Google recommends single-concern edits per pass
  for (const issue of actionableIssues) {
    const promptText = buildCleanupPrompt(issue);
    if (!promptText) continue;

    console.log(`[cleanup] Running pass for issue: ${issue}`);
    try {
      const response: any = await withRetry(`cleanup:${issue}`, () =>
        ai.models.generateContent({
          model: MODEL_IMAGE,
          contents: [
            {
              role: "user",
              parts: [
                { text: promptText },
                { text: "Image — the automotive photo to clean up" },
                getImagePart(current),
              ],
            },
          ],
          config: {
            temperature: 0.05,
            topP: 0.1,
            topK: 5,
            candidateCount: 1,
            responseModalities: ["Image"],
            safetySettings: SAFETY_SETTINGS,
          },
        }),
      );

      const imagePart = response.candidates?.[0]?.content?.parts?.find(
        (part: any) => part.inlineData?.data,
      );
      if (imagePart?.inlineData?.data) {
        validateImageOutput(imagePart.inlineData.data, `cleanup:${issue}`);
        current = `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`;
        console.log(`[cleanup] Pass for ${issue} succeeded.`);
      } else {
        console.warn(
          `[cleanup] Pass for ${issue} produced no image output — skipping.`,
        );
      }
    } catch (err) {
      // If a cleanup pass fails, log and continue with the previous image
      console.warn(
        `[cleanup] Pass for ${issue} failed, continuing with previous image:`,
        err,
      );
    }
    await interCallDelay();
  }

  return current;
}

async function qaEvaluate(
  ai: GoogleGenAI,
  originalBase64: string,
  studioImageBase64: string,
  generatedBase64: string,
  category: string,
  studioHints?: StudioHints,
): Promise<QAEvaluation> {
  const isDark = studioHints?.studioTone === "dark";
  const isInterior = category === "INTERIOR" || category === "INTERIOR_DETAIL";
  const isDetail =
    category === "EXTERIOR_DETAIL" || category === "INTERIOR_DETAIL";

  const structuralChecks = [
    "• geometry_changed: Vehicle/component shape, proportions, or camera angle differ from Image 1.",
    "• hallucinated_part: Details were added that don't exist in Image 1 (extra vents, changed grille, altered bodywork).",
    "• plate_mismatch: License plate text or design changed.",
    "• paint_shift: Vehicle paint color/finish noticeably changed.",
    "• crop_changed: Framing significantly different from expected output.",
    "• wheel_design_changed: Spoke count, spoke shape, spoke finish, or centre cap badge differs from Image 1. Compare carefully.",
    "• badge_text_changed: Any badge text (model name, ABT, M, AMG, S-line, etc.) differs from Image 1.",
    "• caliper_color_changed: Brake caliper color/shape differs from Image 1 (e.g. was red, now black).",
    "• trim_altered: Exterior trim (chrome, black trim, carbon fiber) shape or finish changed.",
    "• zoom_or_crop_drift: Image is zoomed in/out compared to Image 1, or panned to a different position.",
    "• angle_or_direction_changed: The vehicle/component is seen from a DIFFERENT camera angle or the vehicle faces a different direction than in Image 1. For example: Image 1 shows a direct front view but Image 3 shows a three-quarter view, or the car faces left in Image 1 but right in Image 3. This is an AUTOMATIC FAILURE.",
  ];

  const exteriorEnvChecks = [
    "• outdoor_reflection_left: ANY outdoor content visible in body panel reflections, chrome, or mirrors.",
    "• windshield_outdoor_content: Sky, trees, buildings, or outdoor light visible THROUGH any glass.",
    "• body_panel_outdoor_reflection: Outdoor scenery reflected in painted surfaces.",
    "• shadow_mismatch: Shadows don't match Image 2's lighting.",
    "• studio_surrounding_mismatch: Background around car doesn't match Image 2's studio.",
    isDark
      ? "• DARK STUDIO: Bright outdoor artifacts on dark paint/glass are automatic failures."
      : "",
  ].filter(Boolean);

  const interiorChecks = [
    "• window_outdoor_content_remaining: ANY outdoor content (sky, trees, buildings, sun glare, parking lot, road, other cars) is still visible through ANY window — windshield, side windows, rear window, sunroof, or mirrors. This is an AUTOMATIC FAILURE — every window must show studio environment, not outdoors.",
    "• window_studio_not_visible: Windows show a flat/blank/white/grey fill instead of Image 2's actual studio walls, ceiling, and space. Windows must clearly show the studio geometry — not just a uniform color wash. HIGH severity.",
    "• interior_lighting_mismatch: Interior lighting does not match Image 2's studio ambiance. If Image 2 is a dark studio, interior should have moody/atmospheric lighting. If bright studio, interior should be evenly well-lit. Flag if the interior lighting feels inconsistent with the studio.",
    "• interior_color_changed: ANY material color HUE changed (brown became orange, black became grey, tan became white). Compare leather, fabric, plastic, trim colors — the BASE HUE must match. Note: enhanced vibrancy/richness of the SAME color is acceptable and expected. AUTOMATIC FAILURE only if hue shifted.",
    "• interior_content_lost: Interior content replaced with studio/empty space — seats, dashboard, console, or controls disappeared. AUTOMATIC FAILURE.",
    "• interior_structure_changed: Seat shapes, dashboard layout, or components differ from Image 1.",
    "• material_texture_changed: Real texture grain replaced with smooth/plastic look, or stitching pattern removed.",
  ];

  const detailChecks = [
    "• component_detail_lost: Fine details from Image 1 are missing (bolt patterns, tyre sidewall text, lens patterns, weave patterns, stitching).",
    "• material_texture_changed: Material texture, grain direction, or surface finish altered.",
  ];

  const categoryChecks = isInterior ? interiorChecks : exteriorEnvChecks;

  const cleanupCheck = [
    "• cleanup_artifact_remaining: The result still contains a visible photographer artifact that should have been removed — e.g. a hand, arm, phone, human silhouette, photographer reflection in paint/glass, photographer reflection in instrument-cluster glass or infotainment screens, or lens obstruction. Flag this if ANY human presence artifact is still visible in Image 3.",
  ];

  const qaPrompt = [
    "Compare Image 3 (result) against Image 1 (original) and Image 2 (target studio). Report any defects.",
    `Category: ${category}.`,
    "",
    "STRUCTURAL IDENTITY CHECKS (applies to ALL categories — the vehicle/component must be identical to Image 1):",
    ...structuralChecks,
    "",
    "CLEANUP CHECKS (flag if original artifacts were not fully removed):",
    ...cleanupCheck,
    "",
    `CATEGORY-SPECIFIC CHECKS for ${category}:`,
    ...categoryChecks,
    ...(isDetail ? detailChecks : []),
    "",
    "Return pass=true ONLY if zero issues are found.",
    "Structural identity changes (geometry_changed, angle_or_direction_changed, wheel_design_changed, badge_text_changed, caliper_color_changed, interior_color_changed, interior_content_lost) are ALWAYS high severity with retry_recommended=true.",
    "cleanup_artifact_remaining is always high severity with retry_recommended=true.",
    isInterior
      ? [
        "INTERIOR WINDOW CHECK (critical): Look at EVERY window/glass surface in Image 3. Each must clearly show Image 2's studio environment — actual studio walls, ceiling, space. If ANY window shows outdoor content (sky, trees, sun) or just a flat uniform fill instead of visible studio geometry, flag it as window_outdoor_content_remaining or window_studio_not_visible with HIGH severity and retry_recommended=true.",
        "INTERIOR LIGHTING CHECK: Interior surfaces must feel like they are lit by Image 2's studio ambient. If Image 2 is dark/moody, interior should be atmospheric. If bright, interior should be well-lit. Flag interior_lighting_mismatch if inconsistent.",
        "INTERIOR REFLECTION CHECK: Inspect glossy instrument-cluster covers, infotainment screens, glossy piano-black trim, glossy wood trim, chrome bezels, mirror glass, and any other reflective interior surface. If any person, hand, phone, camera, or dark human silhouette is reflected there, flag cleanup_artifact_remaining with HIGH severity and retry_recommended=true.",
        "INTERIOR IDENTITY: Result must be the SAME interior with studio-matching lighting and enhanced details — not a different interior or empty studio. Enhanced vibrancy is EXPECTED. Only flag interior_color_changed if the actual HUE shifted (brown to orange, not brown looking richer).",
      ].join("\n")
      : "EXTERIOR QUALITY: No outdoor artifacts may survive in a professional studio photo.",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await withRetry("qaEvaluate", () =>
    ai.models.generateContent({
      model: MODEL_VISION,
      contents: [
        {
          role: "user",
          parts: [
            { text: qaPrompt },
            { text: "Image 1 - original upload" },
            getImagePart(originalBase64),
            { text: "Image 2 - selected studio reference" },
            getImagePart(studioImageBase64),
            { text: "Image 3 - generated result" },
            getImagePart(generatedBase64),
          ],
        },
      ],
      config: {
        temperature: 0,
        responseMimeType: "application/json",
        responseJsonSchema: QA_SCHEMA,
      },
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

    if (!response.ok) {
      return imageBase64;
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    return buildDataUri(bytes, "image/png");
  } catch (error) {
    console.warn("[removeBackground] Falling back to original image:", error);
    return imageBase64;
  }
}

async function geminiIsolate(
  ai: GoogleGenAI,
  imageBase64: string,
): Promise<string> {
  await interCallDelay();
  // Single-pass isolation: extract vehicle directly onto a pure white background.
  // This replaces the old 2-pass green-screen approach and saves one model call,
  // keeping us well within Supabase edge runtime CPU/wall-clock limits while
  // producing a clean white-background cutout for compositing.
  const isolatePrompt = [
    "Extract ONLY the vehicle from this image and place it on a pure white (#FFFFFF) background.",
    "Remove EVERYTHING that is not part of the vehicle: road surface, pavement, cobblestones, buildings, sky, trees, other cars, people, shadows on the ground, and any background objects.",
    "The vehicle body, wheels, glass, mirrors, badges, and all trim must remain exactly as-is — same angle, same crop, same zoom level, same framing.",
    "The white background must be completely flat and uniform with NO gradients and NO ground shadows.",
    "The car should appear to float slightly above the white background with only its tyres touching the bottom edge of the white floor.",
    "Do not change the input aspect ratio.",
  ].join(" ");

  console.log("[gemini-isolate] Single-pass white-background extraction...");
  const response: any = await withRetry("geminiIsolate-white", () =>
    ai.models.generateContent({
      model: MODEL_IMAGE,
      contents: [
        {
          role: "user",
          parts: [{ text: isolatePrompt }, getImagePart(imageBase64)],
        },
      ],
      config: {
        temperature: 0.05,
        topP: 0.15,
        topK: 5,
        candidateCount: 1,
        responseModalities: ["Image"] as string[],
        safetySettings: SAFETY_SETTINGS,
      },
    }),
  );

  const part = response.candidates?.[0]?.content?.parts?.find(
    (p: any) => p.inlineData?.data,
  );
  if (!part?.inlineData?.data) {
    throw new Error(
      "Gemini failed to extract the vehicle onto a white background.",
    );
  }

  validateImageOutput(part.inlineData.data, "geminiIsolate:white_bg");
  console.log("[gemini-isolate] Single-pass isolation complete.");
  return `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
}

async function isolateCar(
  ai: GoogleGenAI,
  imageBase64: string,
  removeBgKey?: string,
): Promise<string> {
  if (removeBgKey) {
    console.log("[isolate] Using remove.bg API...");
    const result = await removeBackground(imageBase64, removeBgKey);
    if (result !== imageBase64) {
      console.log("[isolate] remove.bg succeeded.");
      return result;
    }
    console.warn(
      "[isolate] remove.bg returned original — falling back to Gemini isolate.",
    );
  }
  console.log("[isolate] Using Gemini green-screen isolation...");
  return geminiIsolate(ai, imageBase64);
}

async function generateImage(
  ai: GoogleGenAI,
  promptText: string,
  subjectImage: string,
  studioImageBase64: string,
  studioFile: { uri: string; mimeType: string } | null,
  qualityReference: QualityReference | null,
  branding?: { isEnabled?: boolean; logoUrl?: string | null },
  category?: string,
): Promise<string> {
  const labelMap: Record<string, { img1: string; img2: string }> = {
    EXTERIOR: {
      img1: "Image 1 — the car with its background already removed and placed on a white background. This is the clean vehicle subject to composite into the studio. Preserve the car's exact shape, paint, wheels, badges, trim, camera angle, zoom level, crop, and framing. Do NOT alter the vehicle itself in any way.",
      img2: "Image 2 — the target studio environment. Use this studio's floor, walls, ceiling, and lighting to build the entire scene around Image 1's car. The floor color, wall color, and light direction must exactly match this image.",
    },
    EXTERIOR_DETAIL: {
      img1: "Image 1 — close-up of an automotive component. Keep every single detail EXACTLY as-is: spoke geometry, caliper color, badge text, bolt pattern, tyre sidewall text, paint finish, carbon fiber weave, lens pattern, chrome highlights. Change NOTHING on the component itself.",
      img2: "Image 2 — studio reference. Use ONLY for the background behind the component and for ambient lighting/reflection tone. Do NOT use it to alter the component.",
    },
    INTERIOR: {
      img1: "Image 1 — the car interior photo to edit. This is the MASTER reference. Every pixel of the car must stay identical: same seats, dashboard, steering wheel, materials, colors, textures, shapes, positions, camera angle, zoom, crop, and framing. You are NOT recreating this image — you are making minimal, surgical edits to it.",
      img2: "Image 2 — the studio reference. Use ONLY to determine: (a) what studio environment to show through windows, and (b) the color temperature/tone of the ambient light. Do NOT use this to change any car geometry, materials, or camera angle.",
    },
    INTERIOR_DETAIL: {
      img1: "Image 1 — the interior detail photo to edit. This is the MASTER reference. Every component stays identical: same geometry, materials, colors, textures, positions, zoom, and framing. You are making minimal edits only.",
      img2: "Image 2 — the studio reference. Use ONLY to determine the ambient light color temperature and tone. Do NOT use this to change any geometry or materials.",
    },
  };
  const labels = labelMap[category || "EXTERIOR"] || labelMap.EXTERIOR;
  const image1Label = labels.img1;
  const image2Label = labels.img2;

  const isInteriorCategory =
    category === "INTERIOR" || category === "INTERIOR_DETAIL";

  let parts: any[];

  if (isInteriorCategory) {
    // For interiors: car image FIRST as the anchor (master reference),
    // studio image SECOND as a lighting/environment reference only.
    parts = [
      { text: promptText },
      { text: image1Label },
      getImagePart(subjectImage),
      { text: image2Label },
      createStudioPart(studioImageBase64, studioFile),
    ];
  } else {
    parts = [
      { text: promptText },
      { text: image1Label },
      getImagePart(subjectImage),
      { text: image2Label },
      createStudioPart(studioImageBase64, studioFile),
    ];

    if (qualityReference?.imageBase64) {
      parts.push({ text: `Image 3 - ${qualityReference.label}` });
      parts.push(getImagePart(qualityReference.imageBase64));
    }

    if (branding?.isEnabled && branding.logoUrl) {
      const brandingImageNumber = qualityReference?.imageBase64 ? 4 : 3;
      parts.push({
        text: `Image ${brandingImageNumber} - branding logo, place subtly in the top-left if present`,
      });
      parts.push(getImagePart(branding.logoUrl));
    }
  }

  const imageModel = isInteriorCategory ? MODEL_IMAGE_INTERIOR : MODEL_IMAGE;
  const genConfig = isInteriorCategory
    ? {
      temperature: 0.15,
      topP: 0.3,
      topK: 10,
      candidateCount: 1,
      responseModalities: ["Image"] as string[],
      safetySettings: SAFETY_SETTINGS,
    }
    : {
      temperature: 0.2,
      topP: 0.4,
      topK: 10,
      candidateCount: 1,
      responseModalities: ["Image"] as string[],
      safetySettings: SAFETY_SETTINGS,
    };

  console.log(
    `[generateImage] Using model: ${imageModel} for category: ${category}`,
  );
  await interCallDelay();
  const response: any = await withRetry("generateImage", () =>
    ai.models.generateContent({
      model: imageModel,
      contents: [{ role: "user", parts }],
      config: genConfig,
    }),
  );

  const imagePart = response.candidates?.[0]?.content?.parts?.find(
    (part: any) => part.inlineData?.data,
  );
  if (!imagePart?.inlineData?.data) {
    throw new Error(
      `AutoStudio composite generation failed. Finish reason: ${response.candidates?.[0]?.finishReason || "UNKNOWN"}`,
    );
  }

  validateImageOutput(imagePart.inlineData.data, "generateImage");
  return `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`;
}

async function interiorStudioRefinement(params: {
  ai: GoogleGenAI;
  generatedBase64: string;
  studioImageBase64: string;
  originalBase64: string;
  studioHints?: StudioHints;
  category?: string;
  qaIssues?: string[];
}): Promise<string> {
  const isDark = params.studioHints?.studioTone === "dark";

  const lightingFix = isDark
    ? "The lighting must be dark and moody like this studio — remove all bright daylight from interior surfaces. Shadows should be deep and atmospheric."
    : "The lighting must be bright and even like this studio — remove all harsh outdoor directional light from interior surfaces. Shadows should be soft and diffused.";
  const qaFixes = buildQaFixSection(
    params.category || "INTERIOR",
    params.qaIssues || [],
  );

  const prompt = [
    "You are retouching Image 1. The camera angle, zoom, crop, and framing of Image 1 must remain IDENTICAL in the output.",
    "Image 2 is a studio reference — use it only to determine what to show through windows and the lighting tone.",
    `Make ONLY these targeted fixes to Image 1: (a) replace any remaining outdoor content through windows with the studio from Image 2; (b) ${lightingFix}; (c) remove any photographer or camera reflections from glass and screens — preserve all gauge numbers, icons, and screen text exactly.`,
    "DO NOT change: camera angle, zoom, crop, framing, seat shapes, dashboard layout, material colors, material textures, or any component geometry.",
    qaFixes,
    "Do not change the input aspect ratio.",
  ].join(" ");

  console.log(
    `[interior-refine] Studio refinement pass starting (model: ${MODEL_IMAGE_INTERIOR})...`,
  );
  await interCallDelay();
  const response: any = await withRetry("interiorStudioRefinement", () =>
    params.ai.models.generateContent({
      model: MODEL_IMAGE_INTERIOR,
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              text: "Image 1 — the car interior to retouch. This is the MASTER. All geometry, colors, materials, framing, zoom, and crop must be preserved exactly.",
            },
            getImagePart(params.generatedBase64),
            {
              text: "Image 2 — the studio reference. Use only for window content and lighting tone.",
            },
            getImagePart(params.studioImageBase64),
          ],
        },
      ],
      config: {
        temperature: 0.1,
        topP: 0.2,
        topK: 10,
        candidateCount: 1,
        responseModalities: ["Image"] as string[],
        safetySettings: SAFETY_SETTINGS,
      },
    }),
  );

  const imagePart = response.candidates?.[0]?.content?.parts?.find(
    (part: any) => part.inlineData?.data,
  );
  if (imagePart?.inlineData?.data) {
    console.log("[interior-refine] Studio refinement pass succeeded.");
    validateImageOutput(imagePart.inlineData.data, "interiorStudioRefinement");
    return `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`;
  }
  console.warn(
    "[interior-refine] No image produced — returning first generation.",
  );
  return params.generatedBase64;
}

async function refineExteriorGrounding(params: {
  ai: GoogleGenAI;
  generatedBase64: string;
  studioImageBase64: string;
  originalBase64: string;
  studioHints?: StudioHints;
  qaIssues?: string[];
}): Promise<string> {
  const fixes = params.qaIssues?.length
    ? `\nQA issues to correct: ${params.qaIssues.join(", ")}.`
    : "";
  const studio = buildStudioContext(params.studioHints);
  const isDark = params.studioHints?.studioTone === "dark";
  // Post-composite grounding: Image 1 is already a studio composite — fix edge artifacts, shadows, and surface quality
  const promptText = [
    "Image 1 is a studio composite of a car. Your job is to refine the quality of this composite. Image 2 is the target studio reference. Image 3 is the original car photo for vehicle detail verification.",
    "⚠ Same crop, zoom, framing as Image 1 — do not recompose.",
    "",
    `STUDIO CONTEXT: ${studio}`,
    "",
    "FIX EDGE ARTIFACTS:",
    "• If the car outline has a halo, fringe, color bleed, or ghosting at the edges where the car meets the background, clean these up. The transition between car and background should be sharp and natural.",
    "• Any remaining green tinge or translucency from background extraction should be fully removed.",
    "",
    "FIX FLOOR/ENVIRONMENT:",
    "• FLOOR: Ensure the floor color exactly matches Image 2. Place a natural contact shadow where tyres meet the floor.",
    "• WALLS: Ensure background walls match Image 2.",
    "• Glass: windows should show Image 2's studio environment.",
    isDark
      ? "• DARK STUDIO: check for bright artifacts on paint, glass, or floor."
      : "",
    "",
    "FIX REFLECTIONS:",
    "• Paint: smooth overhead studio gradient reflections — no sharp shapes, no showroom lights visible. Soft light-to-dark gradient on dark paint, even white highlight on light paint.",
    "• Chrome/trim: clean sharp studio highlight streaks. No environmental reflections.",
    "",
    "ENHANCE SURFACE QUALITY:",
    "• PAINT: Clean all panels — remove dirt, dust, water spots, grime. Fix minor dents, scratches. Enhance gloss under studio lighting. CRITICAL: do NOT change paint color, hue, shade, or saturation.",
    "• TYRES (if visible): Clean sidewalls, jet black, freshly-dressed appearance. NEVER change tyre text, tread, spoke geometry, or caliper color.",
    "",
    "ABSOLUTE RULES — zero tolerance:",
    "• Camera angle, zoom, crop, framing: IDENTICAL to Image 1. No recomposing.",
    "• Vehicle body shape, paint color, wheel design, badges, plates, trim: unchanged.",
    "Do not change the input aspect ratio." + fixes,
  ]
    .filter(Boolean)
    .join("\n");

  await interCallDelay();
  const response: any = await withRetry("refineExteriorGrounding", () =>
    params.ai.models.generateContent({
      model: MODEL_IMAGE,
      contents: [
        {
          role: "user",
          parts: [
            { text: promptText },
            {
              text: "Image 1 — the studio composite to refine (fix edges, shadows, and surface quality)",
            },
            getImagePart(params.generatedBase64),
            {
              text: "Image 2 — target studio reference (floor, walls, lighting)",
            },
            getImagePart(params.studioImageBase64),
            {
              text: "Image 3 — original car photo (use only to verify vehicle details are preserved)",
            },
            getImagePart(params.originalBase64),
          ],
        },
      ],
      config: {
        temperature: 0.2,
        topP: 0.4,
        topK: 10,
        candidateCount: 1,
        responseModalities: ["Image"],
        safetySettings: SAFETY_SETTINGS,
      },
    }),
  );

  const imagePart = response.candidates?.[0]?.content?.parts?.find(
    (part: any) => part.inlineData?.data,
  );
  if (!imagePart?.inlineData?.data) {
    throw new Error(
      `Exterior grounding refinement failed. Finish reason: ${response.candidates?.[0]?.finishReason || "UNKNOWN"}`,
    );
  }

  validateImageOutput(imagePart.inlineData.data, "refineExteriorGrounding");
  return `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`;
}

async function refineExteriorDetailGrounding(params: {
  ai: GoogleGenAI;
  generatedBase64: string;
  studioImageBase64: string;
  originalBase64: string;
  studioHints?: StudioHints;
  qaIssues?: string[];
}): Promise<string> {
  const isDark = params.studioHints?.studioTone === "dark";
  const fixes = buildQaFixSection("EXTERIOR_DETAIL", params.qaIssues || []);

  const promptText = [
    "Image 1 is a studio composite of an automotive component. Refine its quality. Image 2 is the target studio reference. Image 3 is the original component photo for detail verification.",
    "The output must have the EXACT same crop, zoom, framing, and camera position as Image 1 — do NOT recompose or change the shot.",
    "",
    "FIX 1 — EDGE AND ENVIRONMENT:",
    "• EDGE ARTIFACTS: Clean any halo, fringe, color bleed, or ghosting at the component edge where it meets the background. Transition should be sharp and natural.",
    "• BACKGROUND: Any remaining non-studio environment must be replaced with Image 2's studio backdrop.",
    "• PANEL REFLECTIONS: Any reflections of showroom lights or windows on painted panels must be replaced with clean studio-consistent gradients from Image 2.",
    "• CHROME REFLECTIONS: Replace location reflections with smooth studio highlight streaks from Image 2's key light.",
    isDark
      ? "• DARK STUDIO: Bright artifacts are especially visible — check all glossy surfaces."
      : "",
    "",
    "FIX 2 — PAINT & BODY ENHANCEMENT:",
    "• Clean all painted panels: remove dirt, dust, water spots, road grime, tar. Fix minor dents and panel dings — restore smooth factory geometry. Remove light scratches and swirl marks. Fix washed-out/overexposed panels — recover correct paint color and depth. Enhance gloss under studio lighting.",
    "• CRITICAL: Do NOT change paint color, hue, shade, or saturation at all. Only clean and enhance.",
    "",
    "FIX 3 — TYRE CLEANING & POLISHING (if tyres are visible):",
    "• Clean tyre sidewalls: remove mud, brown oxidation, and brake dust. Make tyres look clean and jet black.",
    "• If tyres appear old, faded, or weathered — darken to freshly-dressed appearance.",
    "• Clean brake dust off spokes and caliper surfaces.",
    "• NEVER change: tyre brand text, size markings, tread pattern, spoke geometry, spoke finish, caliper color.",
    "",
    "PRESERVE EXACTLY (zero tolerance):",
    "• Every physical detail — shape, geometry, paint color, finish type, grille mesh, badge logos, headlight lenses, spoke design, caliper color, tyre text, tread pattern",
    "• Camera angle, zoom level, crop, and framing — must match Image 1 and Image 3 exactly",
    fixes,
    "Do not change the input aspect ratio.",
  ]
    .filter(Boolean)
    .join("\n");

  await interCallDelay();
  const response: any = await withRetry("refineExteriorDetailGrounding", () =>
    params.ai.models.generateContent({
      model: MODEL_IMAGE,
      contents: [
        {
          role: "user",
          parts: [
            { text: promptText },
            {
              text: "Image 1 — current output to fix (has remaining showroom environment)",
            },
            getImagePart(params.generatedBase64),
            {
              text: "Image 2 — target studio (use only for background and reflection reference)",
            },
            getImagePart(params.studioImageBase64),
            {
              text: "Image 3 — original component photo (use only to verify component details are preserved)",
            },
            getImagePart(params.originalBase64),
          ],
        },
      ],
      config: {
        temperature: 0.2,
        topP: 0.4,
        topK: 10,
        candidateCount: 1,
        responseModalities: ["Image"] as string[],
        safetySettings: SAFETY_SETTINGS,
      },
    }),
  );

  const imagePart = response.candidates?.[0]?.content?.parts?.find(
    (part: any) => part.inlineData?.data,
  );
  if (!imagePart?.inlineData?.data) {
    throw new Error(
      `Exterior detail grounding refinement failed. Finish reason: ${response.candidates?.[0]?.finishReason || "UNKNOWN"}`,
    );
  }

  validateImageOutput(
    imagePart.inlineData.data,
    "refineExteriorDetailGrounding",
  );
  return `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`;
}

async function correctFloor(params: {
  ai: GoogleGenAI;
  generatedBase64: string;
  studioImageBase64: string;
  studioHints?: StudioHints;
}): Promise<string> {
  const isBright = params.studioHints?.studioTone === "bright";
  const targetFloorColor = isBright
    ? "WHITE or very light gray"
    : params.studioHints?.studioTone === "dark"
      ? "dark gray or black"
      : "medium gray";

  const prompt = [
    "Image 1 is a studio composite. Look at it. Check if the floor surface (the horizontal area under and around the car) matches the studio floor in Image 2.",
    `The floor MUST be ${targetFloorColor}. If it is already correct, return Image 1 unchanged.`,
    `If the floor is the WRONG color, replace ONLY the floor surface with ${targetFloorColor}. Keep a natural contact shadow under the tyres.`,
    "CRITICAL: Do NOT change ANYTHING else. Same crop, zoom, framing, camera angle. Do not touch the car, paint, wheels, reflections, or background walls. ONLY the floor color.",
  ].join(" ");

  console.log(
    `[floor-correct] Running floor correction pass (target: ${targetFloorColor})...`,
  );
  await interCallDelay();
  const response: any = await withRetry("correctFloor", () =>
    params.ai.models.generateContent({
      model: MODEL_IMAGE,
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { text: "Image 1 — the photo to check and fix (floor only)." },
            getImagePart(params.generatedBase64),
            {
              text: "Image 2 — studio reference showing the correct floor color.",
            },
            getImagePart(params.studioImageBase64),
          ],
        },
      ],
      config: {
        temperature: 0.15,
        topP: 0.3,
        topK: 10,
        candidateCount: 1,
        responseModalities: ["Image"] as string[],
        safetySettings: SAFETY_SETTINGS,
      },
    }),
  );

  const imagePart = response.candidates?.[0]?.content?.parts?.find(
    (part: any) => part.inlineData?.data,
  );
  if (imagePart?.inlineData?.data) {
    console.log("[floor-correct] Floor correction pass succeeded.");
    validateImageOutput(imagePart.inlineData.data, "correctFloor");
    return `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`;
  }
  console.warn(
    "[floor-correct] No image produced — returning input unchanged.",
  );
  return params.generatedBase64;
}

function buildStudioContext(hints?: StudioHints): string {
  if (!hints)
    return "Study Image 2 carefully — its floor, walls, light direction, and mood define every decision you make.";

  const lighting: Record<string, string> = {
    warm: "warm-toned key light with golden fill, soft amber rolloff on surfaces",
    cool: "cool-toned key light with crisp white fill, clean neutral-to-blue rolloff",
    neutral:
      "balanced neutral key light with soft white fill, even rolloff across surfaces",
  };

  const platform: Record<string, string> = {
    round_platform:
      "circular display turntable — the car sits on a raised round platform with a subtle edge",
    flat_floor:
      "flat continuous floor extending naturally under and around the vehicle",
    interior_ambient:
      "ambient studio environment visible through windows and glass",
  };

  const studioTone: Record<string, string> = {
    bright:
      "high-key bright WHITE studio — walls are WHITE, floor is WHITE or very light gray, ceiling is WHITE. Background must be bright white, not gray or dark",
    mid: "balanced mid-tone studio — walls are light gray, floor is medium gray. Background must match these exact tones",
    dark: "low-key dark studio — walls are dark gray/black, floor is dark. CRITICAL: every outdoor artifact is highly visible against the dark environment and must be completely eliminated",
  };

  const floorFinish: Record<string, string> = {
    matte: "matte floor with minimal reflection and soft edge transitions",
    semi_gloss:
      "semi-gloss floor with restrained reflection and readable contact shadow separation",
    glossy:
      "glossy floor with visible but controlled reflections directly tied to studio lighting",
  };

  return [
    `Studio: "${hints.name}".`,
    `Lighting: ${lighting[hints.lightingProfile] || lighting.neutral}.`,
    `Floor: ${platform[hints.platformType] || platform.flat_floor}.`,
    `Tone: ${studioTone[hints.studioTone] || studioTone.mid}.`,
    `Floor finish: ${floorFinish[hints.floorFinish] || floorFinish.matte}.`,
    hints.exposureNote ? `Photographer note: ${hints.exposureNote}` : "",
    "Study Image 2 carefully — its floor color, wall tone, light direction, and mood define every decision you make.",
  ]
    .filter(Boolean)
    .join(" ");
}

function describeAngle(angleFamily: string): string {
  const descriptions: Record<string, string> = {
    front:
      "direct front view — camera is positioned directly in front of the vehicle, facing the front grille/bumper head-on",
    rear: "direct rear view — camera is positioned directly behind the vehicle, facing the rear bumper/tailgate head-on",
    side: "side profile view — camera is positioned at the side of the vehicle, showing a full lateral profile",
    three_quarter:
      "three-quarter view — camera is positioned at an angle showing both the front/rear and one side of the vehicle",
    interior: "interior view — camera is inside the vehicle cabin",
    detail: "detail close-up — camera is focused on a specific component",
  };
  return descriptions[angleFamily] || `camera angle: ${angleFamily}`;
}

function buildQaFixSection(category: string, qaIssues: string[] = []): string {
  if (!qaIssues.length) return "";

  const isInterior = category === "INTERIOR" || category === "INTERIOR_DETAIL";
  const lines = ["QA FIXES (must be corrected in this render):"];

  for (const issue of qaIssues) {
    switch (issue) {
      case "cleanup_artifact_remaining":
        lines.push(
          isInterior
            ? "• Remove every remaining human/camera artifact. No photographer, phone, hand, arm, silhouette, or human reflection may remain anywhere. Inspect instrument-cluster glass, infotainment screens, glossy piano-black trim, glossy wood, chrome bezels, mirror glass, and metallic trim. Replace those reflections with clean studio-consistent highlights while preserving the underlying gauges, icons, text, and trim details exactly."
            : "• Remove every remaining human/camera artifact. No photographer, phone, hand, arm, silhouette, or human reflection may remain on any paint, chrome, glass, mirror, or body panel.",
        );
        break;
      case "window_outdoor_content_remaining":
        lines.push(
          "• Every visible window and glass surface must show the selected studio environment only. Remove all sky, trees, road, cars, parking lot, and daylight artifacts.",
        );
        break;
      case "window_studio_not_visible":
        lines.push(
          "• Windows must show real studio geometry from the selected studio image, not a flat white/grey fill.",
        );
        break;
      case "interior_lighting_mismatch":
        lines.push(
          "• Rebuild interior lighting and shadows so they clearly match the selected studio mood, direction, softness, and color temperature.",
        );
        break;
      case "outdoor_reflection_left":
      case "body_panel_outdoor_reflection":
        lines.push(
          "• Remove all remaining outdoor reflections and replace them with reflections derived from the selected studio lighting and surfaces only.",
        );
        break;
      case "windshield_outdoor_content":
        lines.push(
          "• The windshield and all other glass must show only the selected studio, never outdoor scenery or daylight.",
        );
        break;
      case "shadow_mismatch":
        lines.push(
          "• Rebuild shadows so they match the selected studio lighting direction, softness, and floor behavior. Ensure the floor color matches the studio.",
        );
        break;
      case "studio_surrounding_mismatch":
        lines.push(
          "• The floor and/or walls do not match the studio. Replace the ENTIRE floor surface and all walls with the exact colors from the studio image. For a bright/white studio, the floor must be WHITE, not dark.",
        );
        break;
      default:
        lines.push(`• Resolve the remaining QA issue: ${issue}.`);
        break;
    }
  }

  return lines.join("\n");
}

function buildPrompt(
  category: string,
  originalAngle: string,
  qaIssues: string[] = [],
  studioHints?: StudioHints,
  qualityReference?: QualityReference | null,
  angleFamily?: string,
): string {
  const fixes = buildQaFixSection(category, qaIssues);
  const studio = buildStudioContext(studioHints);
  const qualitySection = qualityReference
    ? "QUALITY TARGET: Use Image 3 only as a finish-quality benchmark for realism, dynamic range, shadow softness, tyre-to-floor contact, reflection cleanliness, and believable studio grounding. Do not copy Image 3's vehicle shape, crop, camera angle, or studio design."
    : "";
  const isDark = studioHints?.studioTone === "dark";
  const angleLock =
    angleFamily && angleFamily !== "unknown"
      ? `\nCAMERA ANGLE LOCKED: The original photo is a ${describeAngle(angleFamily)}. You MUST produce the output from this EXACT same camera angle and perspective. Do not rotate, orbit, or shift the viewpoint. Do not change the input aspect ratio. The vehicle must face the same direction and show the same surfaces as in Image 1.`
      : "\nCAMERA ANGLE LOCKED: Reproduce the EXACT same camera angle, perspective, and viewpoint as Image 1. Do not rotate, orbit, or shift the viewpoint. Do not change the input aspect ratio.";

  if (category === "EXTERIOR") {
    const angleDesc =
      angleFamily && angleFamily !== "unknown"
        ? `The car is shown from a ${describeAngle(angleFamily)} perspective.`
        : "The car angle and framing in Image 1 define the final composition.";

    const floorDesc = isDark
      ? "dark studio floor matching Image 2 — deep shadows, minimal reflection"
      : studioHints?.floorFinish === "glossy"
        ? "glossy studio floor from Image 2 with a clean reflection of the car directly beneath it"
        : studioHints?.floorFinish === "matte"
          ? "matte studio floor from Image 2 with soft contact shadow, no reflection"
          : "semi-gloss studio floor from Image 2 with a faint, soft reflection of the car";

    const wallDesc = isDark
      ? "dark studio walls/background from Image 2"
      : "bright white or light studio walls/background from Image 2";

    return [
      `Create a professional automotive studio photograph by compositing the car from Image 1 into the studio environment from Image 2.`,
      "",
      `Image 1 is the car on a white background — it is the SUBJECT. ${angleDesc} Preserve the car's exact shape, paint color, wheel design, badges, trim, camera angle, zoom level, and framing. Do NOT alter the vehicle in any way.`,
      "",
      `Image 2 is the TARGET STUDIO. Build the entire scene around the car using Image 2's environment.`,
      "",
      `STUDIO CONTEXT: ${studio}`,
      qualitySection,
      "",
      "ENVIRONMENT — build entirely from Image 2:",
      `• BACKGROUND/WALLS: ${wallDesc}. The background must visually match Image 2.`,
      `• FLOOR: Place the car on a ${floorDesc}. The floor must fill the entire lower portion of the image and match Image 2's floor tone exactly.`,
      "• CONTACT SHADOW: Add a natural shadow under the tyres where they meet the floor — darkest at the contact point, softening outward.",
      "• WINDOWS/GLASS: Show the studio environment from Image 2 through the windshield and side windows (walls, ceiling, ambient light).",
      "",
      "PAINT REFLECTIONS — generate fresh studio-quality reflections:",
      "• PAINTED PANELS (bonnet/hood, doors, fenders, roof, rear bumper): Generate smooth, continuous overhead studio light gradients on the paint. On dark paint, a gentle bright-to-dark gradient from top of panel to bottom. On light paint, an even soft highlight. No showroom ceiling lights, no strip lights, no windows, no environmental shapes in the reflection.",
      "• CHROME AND TRIM: Clean, sharp highlight streaks from Image 2's overhead key light.",
      isDark
        ? "• DARK STUDIO: ensure no bright artifacts appear on dark paint — only studio-controlled highlights."
        : "",
      "",
      "VEHICLE SURFACE ENHANCEMENT:",
      "• Clean the paint: remove dirt, dust, water spots, and grime. Restore gloss and depth.",
      "• Fix minor dents, scratches, swirl marks. Recover overexposed panel areas.",
      "• CRITICAL: Do NOT change paint color, hue, shade, or saturation at all.",
      "• TYRES: Clean sidewalls — jet black, no brown oxidation. Freshen rubber to tyre-shine appearance. Never change tyre text, tread, spoke geometry, or caliper color.",
      "",
      "FRAMING — absolute zero tolerance:",
      "• The output crop, zoom level, and camera angle must match Image 1 exactly. Do not zoom out, zoom in, pan, or reveal more car than Image 1 shows.",
      "• Vehicle body shape, proportions, badges, plates, and all trim must be identical to Image 1.",
      "",
      "Do not change the input aspect ratio.",
      fixes,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (category === "INTERIOR") {
    const lightingTone = isDark
      ? "shift the ambient light to dark moody tones — deep controlled shadows, no daylight"
      : studioHints?.lightingProfile === "warm"
        ? "shift the ambient light to warm golden tones from overhead softboxes"
        : studioHints?.lightingProfile === "cool"
          ? "shift the ambient light to cool crisp white tones from overhead LEDs"
          : "normalize the ambient light to clean even neutral studio tones";

    const interiorAngleLock =
      angleFamily && angleFamily !== "unknown"
        ? `This is a ${describeAngle(angleFamily)} shot. The output must match this exact viewpoint.`
        : "The output must match the exact viewpoint of Image 1.";

    return [
      `You are retouching Image 1. ${interiorAngleLock}`,
      `Image 2 is a studio reference — use it ONLY to determine what to show through windows and what lighting tone to apply.`,
      ``,
      `Make ONLY these four targeted changes to Image 1. Change nothing else:`,
      ``,
      `1. WINDOWS ONLY: Replace the content visible through windshield, side windows, rear window, and sunroof with the studio environment from Image 2. The glass areas are the ONLY regions that may be substantially altered.`,
      ``,
      `2. LIGHTING TONE ONLY: ${lightingTone}. Adjust color temperature and remove outdoor sun patches/streaks. Do not repaint surfaces — only adjust tone as if the light source changed.`,
      ``,
      `3. REFLECTION CLEANUP ONLY: On instrument-cluster glass, infotainment screens, chrome bezels, and mirror glass — remove any photographer, hand, or phone reflections. Replace with clean neutral highlights. Preserve all gauge numbers, icons, and screen UI exactly.`,
      ``,
      `4. EXPOSURE RECOVERY ONLY: If areas are severely overexposed or underexposed, recover detail. Do not alter correctly-exposed areas.`,
      ``,
      `DO NOT CHANGE UNDER ANY CIRCUMSTANCES:`,
      `• Camera angle, perspective, zoom level, or framing — output crop must be pixel-identical to Image 1`,
      `• Seat shapes, positions, upholstery colors, or materials`,
      `• Dashboard layout, steering wheel shape, center console geometry`,
      `• Any surface color, material texture, or component shape`,
      `• Any physical object position, size, or proportion`,
      ``,
      `Do not change the input aspect ratio.`,
      fixes,
    ].join("\n");
  }

  if (category === "EXTERIOR_DETAIL") {
    return [
      "Using the provided Image 1, do two things: (1) replace all environment/background with Image 2's studio, and (2) enhance the vehicle surface quality.",
      angleLock,
      "",
      `STUDIO CONTEXT: ${studio}`,
      qualitySection,
      "",
      "PART 1 — ENVIRONMENT REPLACEMENT (everything that is not the car):",
      "• BACKGROUND: Every pixel that is not part of the vehicle must become Image 2's studio. Replace showroom walls, outdoor pavement, concrete blocks, sky, buildings, parked cars, and any non-vehicle surface.",
      "• FLOOR: Replace any showroom floor, pavement, paving stones, or road surface under/around the car with Image 2's studio floor. Add a contact shadow consistent with Image 2's lighting direction.",
      "• PANEL REFLECTIONS: On painted body panels and bonnet/hood — remove showroom ceiling lights, walls, windows from reflections. Replace with a clean overhead gradient from Image 2's studio lighting.",
      "• CHROME & TRIM REFLECTIONS: On chrome grille surrounds, door handles, trim strips — replace location-specific reflections with smooth studio highlight streaks from Image 2.",
      "",
      "PART 2 — PAINT & BODY ENHANCEMENT:",
      "• Clean every painted panel: remove all dirt, dust, water spots, road grime, and surface contamination.",
      "• Fix minor dents and panel dings — restore panel surfaces to smooth factory-correct geometry.",
      "• Remove light scratches, swirl marks, and wash hazing.",
      "• Fix overexposed or washed-out panel areas — fully recover the correct paint color and depth.",
      "• Enhance paint gloss and depth under studio lighting — result should look freshly valeted.",
      "• CRITICAL: Do NOT change the paint color, hue, shade, or saturation in any way. Only clean and enhance the surface.",
      "",
      "PART 3 — TYRE CLEANING & POLISHING (mandatory if tyres are visible):",
      "• Clean tyre sidewalls: remove all mud, brown oxidation, brake dust, and road grime. Tyres must look clean and jet black.",
      "• If tyres appear old, faded, or weathered — darken and enrich the rubber to look freshly dressed (tyre shine effect).",
      "• Clean brake dust off wheel spokes, barrel, and caliper surfaces.",
      "• NEVER change: tyre brand text, tyre size markings, tyre tread pattern, spoke geometry, spoke finish, caliper color.",
      "",
      "WHAT MUST NEVER CHANGE (zero tolerance):",
      "• Vehicle body shape, proportions, and panel geometry",
      "• Paint color, hue, shade, and finish type (matte, gloss, metallic, satin) — no color shift at all",
      "• Grille mesh pattern, headlight lens shape, LED element geometry",
      "• Badge text, logo shape, and logo color",
      "• Wheel spoke design, spoke count, spoke finish, caliper color, tyre sidewall markings, tread pattern",
      "• Camera angle, zoom, crop, and framing — output composition must be identical to Image 1",
      "",
      "FRAMING: Do not zoom, pan, or reframe. Do not change the input aspect ratio.",
      fixes,
    ].join("\n");
  }

  if (category === "INTERIOR_DETAIL") {
    const detailLighting = isDark
      ? "dark, moody studio lighting with refined highlights and atmospheric shadows"
      : studioHints?.lightingProfile === "warm"
        ? "warm golden studio lighting with soft warm shadows"
        : studioHints?.lightingProfile === "cool"
          ? "cool crisp white studio lighting with clean minimal shadows"
          : "bright even neutral studio lighting with soft diffused shadows";

    const detailAngleLock =
      angleFamily && angleFamily !== "unknown"
        ? `This is a ${describeAngle(angleFamily)} shot. Output must match this exact viewpoint.`
        : "Output must match the exact viewpoint of Image 1.";

    return [
      `You are retouching Image 1. ${detailAngleLock}`,
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
      fixes,
    ].join("\n");
  }

  // ENGINE or unknown category — minimal retouching
  return [
    "Using the provided Image 1, change ONLY the background behind the engine bay. Keep the engine and all components exactly the same.",
    angleLock,
    "",
    `STUDIO CONTEXT: ${studio}`,
    qualitySection,
    "",
    "PRESERVE EXACTLY: every engine component, hose, wire, cover, cap, fluid reservoir, label, and surface finish.",
    "CHANGE ONLY: visible background and ambient lighting to match Image 2.",
    "FRAMING: Do not change the input aspect ratio, crop, or zoom.",
    "OUTPUT: same dimensions and framing as Image 1.",
    fixes,
  ].join("\n");
}

async function runRouteGeneration(params: {
  ai: GoogleGenAI;
  category: string;
  originalBase64: string;
  originalAngle: string;
  angleFamily?: string;
  studioImageBase64: string;
  studioFile: { uri: string; mimeType: string } | null;
  qualityReference?: QualityReference | null;
  branding?: { isEnabled?: boolean; logoUrl?: string | null };
  removeBgKey?: string;
  qaIssues?: string[];
  studioHints?: StudioHints;
}): Promise<string> {
  const isExterior = params.category === "EXTERIOR";
  const isInterior =
    params.category === "INTERIOR" || params.category === "INTERIOR_DETAIL";
  const qualityReference =
    isExterior || isInterior ? params.qualityReference || null : null;

  if (isExterior) {
    // Isolate the car before compositing so the model gets a clean subject.
    // Priority: remove.bg API (fastest, one HTTP call) → single-pass Gemini
    // white-background extraction (one model call, replaces old 2-pass green-screen).
    let subjectImage = params.originalBase64;
    if (params.removeBgKey) {
      console.log("[route] Trying remove.bg for car isolation...");
      const removed = await removeBackground(
        params.originalBase64,
        params.removeBgKey,
      );
      if (removed !== params.originalBase64) {
        subjectImage = removed;
        console.log("[route] remove.bg isolation succeeded.");
      } else {
        console.warn(
          "[route] remove.bg returned original — falling back to Gemini single-pass isolation.",
        );
        subjectImage = await geminiIsolate(params.ai, params.originalBase64);
      }
    } else {
      console.log(
        "[route] No REMOVE_BG_API_KEY — using Gemini single-pass isolation.",
      );
      subjectImage = await geminiIsolate(params.ai, params.originalBase64);
    }
    return generateImage(
      params.ai,
      buildPrompt(
        params.category,
        params.originalAngle,
        params.qaIssues,
        params.studioHints,
        qualityReference,
        params.angleFamily,
      ),
      subjectImage,
      params.studioImageBase64,
      params.studioFile,
      qualityReference,
      params.branding,
      params.category,
    );
  }

  return generateImage(
    params.ai,
    buildPrompt(
      params.category,
      params.originalAngle,
      params.qaIssues,
      params.studioHints,
      qualityReference,
      params.angleFamily,
    ),
    params.originalBase64,
    params.studioImageBase64,
    params.studioFile,
    qualityReference,
    params.branding,
    params.category,
  );
}

async function finalizePostGeneration(params: {
  ai: GoogleGenAI;
  category: string;
  generatedBase64: string;
  studioImageBase64: string;
  originalBase64: string;
  studioHints?: StudioHints;
  qaIssues?: string[];
}): Promise<string> {
  if (params.category === "EXTERIOR") {
    // Skip correctFloor (extra model call) — refineExteriorGrounding already
    // handles floor color and quality. Removing this pass reduces CPU time
    // significantly and keeps us within Supabase edge runtime limits.
    return refineExteriorGrounding({
      ai: params.ai,
      generatedBase64: params.generatedBase64,
      studioImageBase64: params.studioImageBase64,
      originalBase64: params.originalBase64,
      studioHints: params.studioHints,
      qaIssues: params.qaIssues,
    });
  }

  if (params.category === "EXTERIOR_DETAIL") {
    console.log("[pipeline] Running exterior detail refinement pass");
    return refineExteriorDetailGrounding({
      ai: params.ai,
      generatedBase64: params.generatedBase64,
      studioImageBase64: params.studioImageBase64,
      originalBase64: params.originalBase64,
      studioHints: params.studioHints,
      qaIssues: params.qaIssues,
    });
  }

  if (params.category === "INTERIOR" || params.category === "INTERIOR_DETAIL") {
    console.log(
      `[pipeline] Running interior studio refinement for ${params.category}`,
    );
    return interiorStudioRefinement({
      ai: params.ai,
      generatedBase64: params.generatedBase64,
      studioImageBase64: params.studioImageBase64,
      originalBase64: params.originalBase64,
      studioHints: params.studioHints,
      category: params.category,
      qaIssues: params.qaIssues,
    });
  }

  return params.generatedBase64;
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
    processedImage:
      row.final_4_3_url || row.generated_raw_url || row.original_image_url,
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

async function processGenerationJob(params: {
  ai: GoogleGenAI;
  supabase: SupabaseClientAny;
  job: JobRow;
  studioImageBase64: string;
  removeBgKey?: string;
  studioHints?: StudioHints;
  qualityReference?: QualityReference | null;
}) {
  const {
    ai,
    supabase,
    job,
    studioImageBase64,
    removeBgKey,
    studioHints,
    qualityReference,
  } = params;
  await updateJob(supabase, job.id, {
    status: "classifying",
    attempt_count: (job.attempt_count || 0) + 1,
  });

  const originalBase64 = await fetchImageAsDataUri(job.original_image_url);
  const classification = await classifyImage(
    ai,
    originalBase64,
    job.original_angle,
  );
  await interCallDelay();
  const effectiveCategory = (job.classification_override ||
    classification.category) as string;

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

  // ── EXTERIOR jobs are handled by the process-exterior function ──
  if (effectiveCategory === "EXTERIOR") {
    console.log(
      `[process-image] Job ${job.id} is EXTERIOR — skipping (returning to pending for process-exterior)`,
    );
    await updateJob(supabase, job.id, {
      status: "pending",
      error_message: null,
    });
    return;
  }

  if (
    classification.category === "REJECT" ||
    (!job.classification_override &&
      classification.confidence < CLASSIFICATION_CONFIDENCE_THRESHOLD)
  ) {
    await updateJob(supabase, job.id, {
      status: "needs_review",
      needs_review: true,
      qa_status: "failed",
      qa_issues:
        classification.category === "REJECT"
          ? ["category_mismatch"]
          : ["low_confidence"],
      qa_severity: "medium",
      error_message:
        classification.category === "REJECT"
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

  // Pre-generation cleanup: remove photographer artifacts, fix blur/exposure issues
  // For interiors: only clean artifact issues — skip exposure issues to avoid anchoring original lighting
  const isInteriorJob =
    effectiveCategory === "INTERIOR" || effectiveCategory === "INTERIOR_DETAIL";
  const ARTIFACT_ISSUES_JOB: QualityIssue[] = [
    "photographer_visible",
    "photographer_reflection",
    "camera_obstruction",
  ];
  const actionableIssues = classification.quality_issues.filter(
    (i) => i !== "none",
  );

  let cleanedBase64 = originalBase64;
  if (actionableIssues.length > 0) {
    if (isInteriorJob) {
      const artifactOnly = actionableIssues.filter((i) =>
        ARTIFACT_ISSUES_JOB.includes(i),
      );
      const skippedIssues = actionableIssues.filter(
        (i) => !ARTIFACT_ISSUES_JOB.includes(i),
      );
      if (artifactOnly.length > 0) {
        console.log(
          `[pipeline] Interior cleanup: fixing artifacts (${artifactOnly.join(", ")}), skipping exposure issues (${skippedIssues.join(", ") || "none"})`,
        );
        cleanedBase64 = await cleanupImage(ai, originalBase64, artifactOnly);
        await updateJob(supabase, job.id, { quality_issues: artifactOnly });
      } else {
        console.log(
          `[pipeline] Skipping cleanup for interior — only exposure issues (${skippedIssues.join(", ")})`,
        );
      }
    } else {
      cleanedBase64 = await cleanupImage(
        ai,
        originalBase64,
        classification.quality_issues,
      );
      console.log(
        `[pipeline] Cleanup applied for issues: ${actionableIssues.join(", ")}`,
      );
      await updateJob(supabase, job.id, { quality_issues: actionableIssues });
    }
  }

  const studioFile = await ensureStudioFile(
    ai,
    supabase,
    job.studio_id,
    studioImageBase64,
  );
  let generated = await runRouteGeneration({
    ai,
    category: effectiveCategory,
    originalBase64: cleanedBase64,
    originalAngle: job.original_angle,
    angleFamily: classification.angle_family,
    studioImageBase64,
    studioFile,
    qualityReference,
    removeBgKey,
    studioHints,
  });
  generated = await finalizePostGeneration({
    ai,
    category: effectiveCategory,
    generatedBase64: generated,
    studioImageBase64,
    originalBase64: cleanedBase64,
    studioHints,
  });

  // QA compares against the original upload (not cleaned) to catch identity changes,
  // but uses cleanedBase64 for the generation context
  let qa = await qaEvaluate(
    ai,
    originalBase64,
    studioImageBase64,
    generated,
    effectiveCategory,
    studioHints,
  );
  if (!qa.pass && qa.retry_recommended) {
    generated = await runRouteGeneration({
      ai,
      category: effectiveCategory,
      originalBase64: cleanedBase64,
      originalAngle: job.original_angle,
      angleFamily: classification.angle_family,
      studioImageBase64,
      studioFile,
      qualityReference,
      removeBgKey,
      qaIssues: qa.issues,
      studioHints,
    });
    generated = await finalizePostGeneration({
      ai,
      category: effectiveCategory,
      generatedBase64: generated,
      studioImageBase64,
      originalBase64: cleanedBase64,
      studioHints,
      qaIssues: qa.issues,
    });
    qa = await qaEvaluate(
      ai,
      originalBase64,
      studioImageBase64,
      generated,
      effectiveCategory,
      studioHints,
    );
  }

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
    error_message: qa.pass
      ? null
      : `QA flagged issues: ${qa.issues.join(", ")}`,
  });
}

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
    .select(
      "id,project_id,user_id,original_image_url,original_angle,studio_id,classification_override,attempt_count",
    )
    .eq("project_id", params.projectId)
    // Also pick up jobs stuck in classifying/processing from a previously
    // killed invocation so they are not orphaned forever.
    .in("status", ["pending", "queued", "classifying", "processing"])
    .order("created_at", { ascending: true });

  if (error) throw error;

  const pendingJobs = (jobs || []) as JobRow[];

  if (pendingJobs.length === 0) {
    return { processed: 0, remaining: 0 };
  }

  // Process up to 5 jobs concurrently per invocation.
  const BATCH_CONCURRENCY = 5;
  const batch = pendingJobs.slice(0, BATCH_CONCURRENCY);
  console.log(
    `[process-image] Processing batch of ${batch.length} jobs (${pendingJobs.length} total pending)`,
  );

  // Reset stuck intermediate-status jobs back to pending so they go through
  // the full pipeline cleanly rather than being skipped by status guards.
  for (const job of batch) {
    if (
      (job as any).status === "classifying" ||
      (job as any).status === "processing"
    ) {
      console.warn(
        `[queue] Job ${job.id} was stuck in "${(job as any).status}" — resetting to pending.`,
      );
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
        await processGenerationJob({
          ai: params.ai,
          supabase: params.supabase,
          job,
          studioImageBase64: params.studioImageBase64,
          removeBgKey: params.removeBgKey,
          studioHints: params.studioHints,
          qualityReference: params.qualityReference,
        });
      } catch (error) {
        console.error("[generation-job] failed", job.id, error);
        await updateJob(params.supabase, job.id, {
          status: "failed",
          qa_status: "failed",
          needs_review: true,
          error_message:
            error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );

  await syncProjectSummary(params.supabase, params.projectId);

  const processed = results.filter((r) => r.status === "fulfilled").length;
  return { processed, remaining: pendingJobs.length - batch.length };
}

async function legacyProcessImage(params: {
  ai: GoogleGenAI;
  originalBase64: string;
  studioImageBase64: string;
  angle: string;
  pipelineCategory?: string;
  branding?: { isEnabled?: boolean; logoUrl?: string | null };
  removeBgKey?: string;
  studioHints?: StudioHints;
  qualityReference?: QualityReference | null;
}): Promise<{
  processedImage: string;
  classification: ClassificationResult;
  qa: QAEvaluation;
}> {
  console.log(`[legacy] Received payload sizes:`);
  console.log(
    `[legacy]   originalBase64: ${((params.originalBase64?.length || 0) / 1024) | 0} kB`,
  );
  console.log(
    `[legacy]   studioImageBase64: ${((params.studioImageBase64?.length || 0) / 1024) | 0} kB`,
  );
  console.log(
    `[legacy]   studioImageBase64 starts: ${(params.studioImageBase64 || "").substring(0, 30)}`,
  );
  console.log(`[legacy]   qualityRef present: ${!!params.qualityReference}`);
  const classification = await classifyImage(
    params.ai,
    params.originalBase64,
    params.angle,
  );
  const effectiveCategory = params.pipelineCategory || classification.category;
  console.log(
    `[legacy] Category: ${effectiveCategory} (detected: ${classification.category}, override: ${params.pipelineCategory || "none"})`,
  );
  console.log(
    `[legacy] Quality issues: ${classification.quality_issues.join(", ")}`,
  );
  console.log(
    `[legacy] Studio hints: ${params.studioHints?.name || "none"}, tone: ${params.studioHints?.studioTone || "unknown"}`,
  );

  // Pre-generation cleanup pass
  // For interiors: only clean artifact issues (photographer, obstruction) — skip exposure issues to avoid anchoring original lighting
  const isInterior =
    effectiveCategory === "INTERIOR" || effectiveCategory === "INTERIOR_DETAIL";
  const ARTIFACT_ISSUES: QualityIssue[] = [
    "photographer_visible",
    "photographer_reflection",
    "camera_obstruction",
  ];
  const actionableIssues = classification.quality_issues.filter(
    (i) => i !== "none",
  );

  let cleanedBase64 = params.originalBase64;
  if (actionableIssues.length > 0) {
    if (isInterior) {
      const artifactOnly = actionableIssues.filter((i) =>
        ARTIFACT_ISSUES.includes(i),
      );
      const skippedIssues = actionableIssues.filter(
        (i) => !ARTIFACT_ISSUES.includes(i),
      );
      if (artifactOnly.length > 0) {
        console.log(
          `[legacy] Interior cleanup: fixing artifacts (${artifactOnly.join(", ")}), skipping exposure issues (${skippedIssues.join(", ") || "none"})`,
        );
        cleanedBase64 = await cleanupImage(
          params.ai,
          params.originalBase64,
          artifactOnly,
        );
      } else {
        console.log(
          `[legacy] Skipping cleanup for interior — only exposure issues (${skippedIssues.join(", ")})`,
        );
      }
    } else {
      cleanedBase64 = await cleanupImage(
        params.ai,
        params.originalBase64,
        classification.quality_issues,
      );
    }
  }

  console.log(`[legacy] Running generation for ${effectiveCategory}...`);
  const generated = await runRouteGeneration({
    ai: params.ai,
    category: effectiveCategory,
    originalBase64: cleanedBase64,
    originalAngle: params.angle,
    angleFamily: classification.angle_family,
    studioImageBase64: params.studioImageBase64,
    studioFile: null,
    qualityReference: params.qualityReference,
    branding: params.branding,
    removeBgKey: params.removeBgKey,
    studioHints: params.studioHints,
  });
  console.log(
    `[legacy] Generation complete. Running post-generation for ${effectiveCategory}...`,
  );
  const grounded = await finalizePostGeneration({
    ai: params.ai,
    category: effectiveCategory,
    generatedBase64: generated,
    studioImageBase64: params.studioImageBase64,
    originalBase64: cleanedBase64,
    studioHints: params.studioHints,
  });
  console.log(`[legacy] Post-generation complete. Running QA...`);
  const qa = await qaEvaluate(
    params.ai,
    params.originalBase64,
    params.studioImageBase64,
    grounded,
    effectiveCategory,
    params.studioHints,
  );
  console.log(
    `[legacy] QA result: pass=${qa.pass}, issues=[${qa.issues.join(", ")}], severity=${qa.severity}`,
  );
  return { processedImage: grounded, classification, qa };
}

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

    if (action === "process-generation-jobs") {
      // Build the processing promise but do NOT await it before responding.
      // EdgeRuntime.waitUntil keeps the isolate alive while the job runs in
      // the background, so the HTTP response is returned to the frontend
      // immediately — eliminating any client-side timeout regardless of how
      // long the Gemini calls take.
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
        // Local dev-serve or non-Supabase runtime: just await normally
        await processingPromise;
      }

      return new Response(
        JSON.stringify({
          ok: true,
          status: "processing",
          // remaining is unknown at this point since we didn't await;
          // the frontend's poll loop will re-kickoff as needed.
          remaining: 1,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (action === "process-image") {
      const result = await legacyProcessImage({
        ai,
        originalBase64: payload.originalBase64,
        studioImageBase64: payload.studioImageBase64,
        angle: payload.angle,
        pipelineCategory: payload.pipelineCategory,
        branding: payload.branding,
        removeBgKey,
        studioHints: payload.studioHints,
        qualityReference: payload.qualityReference,
      });
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("process-image error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
