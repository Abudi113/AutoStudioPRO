// Gemini Service - Now using Supabase Edge Functions for secure API calls
// The API key is kept secure on the server side

import { callEdgeFunction, isSupabaseConfigured } from "./supabaseClient";
import { CameraAngle, BrandingConfig } from "../types";

/** Load a fixed studio reference image */
async function loadStudioRef(studioId: string): Promise<string> {
  const studioPathById: Record<string, string> = {
    "studio-01": "/studios/White Loft.png",
    // -------------------------------------------------
    // Added mappings for the user‑provided studios
    // -------------------------------------------------
    "studio-02": "/studios/Studio (1).jpeg",
    "studio-03": "/studios/Studio (2).jpeg",
    "studio-04": "/studios/Studio (3).jpeg",
    "studio-05": "/studios/Studio (4).jpeg",
    "studio-06": "/studios/Studio (5).jpeg",
    "studio-07": "/studios/Studio (6).jpeg",
    "studio-08": "/studios/Studio (7).jpeg",
    "studio-09": "/studios/Studio (8).jpeg",
    "studio-10": "/studios/Studio (9).jpeg",
    "studio-11": "/studios/Studio (10).jpeg",
    "studio-12": "/studios/Studio (11).jpeg",
  };

  const path = studioPathById[studioId];
  if (!path) {
    throw new Error(
      `Studio "${studioId}" has no fixed reference image mapping. Add it to studioPathById to ensure consistency.`
    );
  }

  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load studio reference: ${path}`);

  const blob = await res.blob();
  const reader = new FileReader();
  const base64 = await new Promise<string>((resolve, reject) => {
    reader.onerror = () => reject(new Error("Failed to read studio image"));
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });

  return base64;
}

/** Process car image with studio background via Supabase Edge Function */
export const processCarImage = async (
  originalBase64: string,
  studioId: string,
  angle: string,
  taskType: string = "bg-replacement",
  branding?: BrandingConfig
): Promise<string> => {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables."
    );
  }

  // Load the studio reference image on the client
  const studioImageBase64 = await loadStudioRef(studioId);

  // Call the Supabase Edge Function
  const result = await callEdgeFunction<{ processedImage: string }>("process-image", {
    action: "process-image",
    payload: {
      originalBase64,
      studioImageBase64,
      angle,
      taskType,
      branding: branding ? {
        isEnabled: branding.isEnabled,
        logoUrl: branding.logoUrl,
      } : undefined,
    },
  });

  return result.processedImage;
};
