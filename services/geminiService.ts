// Gemini Service - Now using Supabase Edge Functions for secure API calls
// The API key is kept secure on the server side

import { callEdgeFunction, isSupabaseConfigured } from "./supabaseClient";
import { CameraAngle, BrandingConfig } from "../types";

/** Load a fixed studio reference image */
async function loadStudioRef(studioId: string): Promise<string> {
  const studioPathById: Record<string, string> = {
    "white-infinity": "/studios/white-infinity-studio.png",
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

/** Detect if image is interior or exterior */
export const detectCarAngle = async (base64Image: string): Promise<CameraAngle> => {
  if (!isSupabaseConfigured()) {
    console.warn("Supabase not configured, defaulting to 'front' angle");
    return 'front';
  }

  try {
    const result = await callEdgeFunction<{ angle: string }>("process-image", {
      action: "detect-angle",
      payload: { base64Image },
    });

    const validAngles: CameraAngle[] = [
      'front', 'rear', 'left', 'right',
      'front_left_34', 'front_right_34', 'rear_left_34', 'rear_right_34',
      'interior'
    ];

    return validAngles.includes(result.angle as CameraAngle)
      ? (result.angle as CameraAngle)
      : 'front';
  } catch (error) {
    console.error("Detection Error:", error);
    return 'front';
  }
};

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
