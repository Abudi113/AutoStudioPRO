// Gemini Service - Now using Supabase Edge Functions for secure API calls
// The API key is kept secure on the server side

import { callEdgeFunction, isSupabaseConfigured } from "./supabaseClient";
import { CameraAngle, BrandingConfig } from "../types";

/** Load a fixed studio reference image */
async function loadStudioRef(studioId: string): Promise<string> {
  const studioPathById: Record<string, string> = {
    "white-infinity": "/studios/white-infinity-studio.png",
    "studio-01": "/studios/hf_20260128_234306_1ef50d5c-b3ba-4a27-a180-5892106e378a.png",
    "studio-02": "/studios/hf_20260129_000619_0e1ac526-afac-4dec-a296-65f8b7fadbf7 (1).png",
    "studio-03": "/studios/hf_20260131_172446_27da6c94-9022-4ecd-a3d1-7137e812a0a2.png",
    "studio-04": "/studios/hf_20260131_172835_e9dbe07b-ec07-4b90-be9f-f1839a1112d3 (1).png",
    "studio-05": "/studios/hf_20260131_174838_9296d3af-ed3d-4eef-8db8-d95235f76ada.png",
    "studio-06": "/studios/hf_20260131_174910_8237c869-bf7a-4ff6-9a06-f1e3e170b391.png",
    "studio-07": "/studios/hf_20260131_175332_bdd605f1-4360-47dc-9f5b-6b84ec6f8bff.png",
    "studio-08": "/studios/hf_20260131_175415_386a1ed2-6203-40f8-93b2-54f960fad58b.png",
    "studio-09": "/studios/hf_20260131_175533_ef1d84ff-b634-4958-aebf-78b3b4ef72ba.png",
    "studio-10": "/studios/hf_20260131_175725_46a96841-791a-4593-ab91-fbbe2adda571.png",
    "studio-11": "/studios/hf_20260131_181211_9f2b33f8-674f-4d69-b067-4ebc6eda5bc8 (1).png",
    "studio-12": "/studios/hf_20260131_181256_6ffd4fe5-0038-4e22-9f4e-b4960917f8b0.png",
    "studio-13": "/studios/hf_20260131_181317_05fe04b5-0fa7-4e66-ae4c-3e94224c94f0.png",
    "studio-14": "/studios/hf_20260131_181539_6f8f0e41-a742-4fc2-b55b-ee336769c415.png",
    "studio-15": "/studios/hf_20260131_181551_b401a893-c115-44ce-87b9-7c2a7b18a4e7.png",
    "studio-16": "/studios/hf_20260131_181734_89b78e68-e821-46df-b016-614cfc620eac (1).png",
    "studio-17": "/studios/hf_20260131_181747_8489648e-abeb-46ef-b1c0-0f3ad8db0d4e.png",
    "studio-18": "/studios/hf_20260131_182511_ae00d5cc-771d-43fd-a021-3ee1354626af (1).png",
    "studio-19": "/studios/hf_20260131_182707_42c8ea73-7282-4a82-9290-ad604b6aa987.png",
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
    console.log('🌐 Calling Supabase edge function for angle detection...');
    const result = await callEdgeFunction<{ angle: string }>("process-image", {
      action: "detect-angle",
      payload: { base64Image },
    });

    console.log('📡 Raw result from Supabase:', result);

    const validAngles: CameraAngle[] = [
      'front', 'rear', 'left', 'right',
      'front_left_34', 'front_right_34', 'rear_left_34', 'rear_right_34',
      'interior',
      'detail',
      'door_open',
      'trunk_open',
      'hood_open'
    ];

    console.log('🔍 Detection result from server:', result.angle);
    console.log('✓ Valid angles list:', validAngles);
    console.log('🔎 Is angle valid?', validAngles.includes(result.angle as CameraAngle));

    const finalAngle = validAngles.includes(result.angle as CameraAngle)
      ? (result.angle as CameraAngle)
      : 'front';

    console.log('✅ Final angle being returned:', finalAngle);

    return finalAngle;
  } catch (error) {
    console.error("❌ Detection Error:", error);
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
      angle: taskType === 'interior' ? 'interior' : angle,
      taskType,
      branding: branding ? {
        isEnabled: branding.isEnabled,
        logoUrl: branding.logoUrl,
      } : undefined,
    },
  });

  return result.processedImage;
};
