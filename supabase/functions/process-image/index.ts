// Supabase Edge Function for Gemini AI image processing
// This keeps your API key secure on the server

// @ts-ignore
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

      // ── Persist the result if a userId is provided ──────────────────────────
      if (payload.userId) {
        try {
          await saveGeneration(result, payload.userId, payload.angle);
        } catch (saveErr) {
          // Log but don't fail the whole request — the image was generated successfully
          console.error("Failed to save generation:", saveErr);
        }
      }

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

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

function buildInteriorPrompt(): string {
  return `
ROLE: AI IMAGE EXECUTION ENGINE (Master Retoucher)
TASK: Precise Interior Enhancement & Rendering

INPUTS: Image 1 (Car Interior), Image 2 (Studio Environment / Window View).

STRICT EXECUTION RULES:
1. PIXEL LOCK: Keep camera angle, frame, dashboard geometry, and steering wheel
   perspective EXACTLY 1:1 with the original. Any alteration to the car's
   structures is a CRITICAL FAILURE.
2. LIGHTING NEUTRALIZATION: Remove all direct sunlight patches, sunbeams, and
   harsh directional shadows. Replace with soft, diffuse, 6500K neutral studio
   ambience.
3. REFLECTION ERASURE: Erase all outdoor reflections from infotainment screens,
   digital clusters, piano black trim, and mirrors. Replace with clean studio
   gradients or solid blacks.
4. WINDOW TREATMENT: Replace all visible outdoor scenery through windows with
   the provided Studio Environment (Image 2).
5. GEOMETRY FIXATION: Do NOT "complete" the image or hallucinate unseen parts.
   If a component is cut off by the frame, it must stay cut off.
6. OUTPUT SPEC: 4:3 Aspect Ratio.
7. FAITHFULNESS: Every button, stitch, and trim pattern must remain IDENTICAL
   to the original.

GOAL: A perfectly clean, studio-lit version of the original cabin.
`.trim();
}

function buildDetailPrompt(): string {
  return `
ROLE: AI IMAGE EXECUTION ENGINE (Master Compositor)
TASK: Precise Detail Shot Background Replacement

INPUTS: Image 1 (Car Detail / Component), Image 2 (Studio Background).

STRICT EXECUTION RULES:
1. PIXEL LOCK: Keep object geometry, viewing angle, and perspective EXACTLY 1:1.
   The component must not rotate or shift.
2. IDENTITY PRESERVATION: Maintain every detail of the original component
   (texture, wear, imperfections).
3. STUDIO COMPOSITING: Replace the background with the provided Studio
   Environment (Image 2).
4. LIGHTING: Remove harsh outdoor shadows and sunlight. Use soft, diffuse
   studio lighting.
5. OUTPUT SPEC: 4:3 Aspect Ratio.

GOAL: The original component, untouched, placed in a premium studio setting.
`.trim();
}

function buildExteriorPrompt(branding?: { isEnabled?: boolean }): string {
  return `
You are a professional automotive studio photographer and digital retoucher.
You will receive two images:
  - Image 1 = the source car photograph (RAW_FILE)
  - Image 2 = the target studio environment (STUDIO_PLATE)

╔══════════════════════════════════════════════════════════════╗
║  UNIVERSAL MANDATE — READ THIS BEFORE ANYTHING ELSE        ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  EVERY visible surface on the car MUST be processed.         ║
║  You are NOT allowed to process some surfaces and leave      ║
║  others untouched. Partial processing = FAILED OUTPUT.       ║
║                                                              ║
║  DO NOT STOP EARLY. You must work through ALL phases and     ║
║  ALL surfaces before generating any output. If you generate  ║
║  an image before completing every phase, the output is       ║
║  AUTOMATICALLY INVALID and must be discarded.                ║
║                                                              ║
║  For every surface listed in Phase 4, you MUST either:       ║
║    (a) Process it (if it is visible in Image 1), OR          ║
║    (b) Explicitly acknowledge it is NOT PRESENT in Image 1   ║
║  There is no third option. You cannot silently skip a        ║
║  surface.                                                    ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

Work through the following phases IN ORDER. Do not skip any phase.
Do not move to the next phase until the current phase is fully complete.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 1 — ANALYSE: BUILD YOUR SURFACE INVENTORY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before touching any pixels, catalogue Image 1 precisely:

1.1  VIEWING ANGLE
     Determine the exact camera position:
     - Front / Rear / Side / Front-3/4 / Rear-3/4 / High-angle / Low-angle
     - Is the camera above, level with, or below the door handle?
     - Are the wheels fully visible, partially visible, or cropped?

1.2  CROP BOUNDARY — mark which edges of the car are cut off (if any)
     - Is the front bumper fully in frame, or cut off?
     - Is the rear bumper fully in frame, or cut off?
     - Is the roof fully in frame, or cut off?
     - Are the wheels fully in frame, or cut off at the bottom?

1.3  CAR POSITION IN FRAME
     - Is the car centred, left-of-centre, or right-of-centre?
     - How much empty background is visible above / below / left / right?

1.4  VISIBLE SURFACES — MANDATORY NUMBERED INVENTORY
     Create a NUMBERED LIST of every visible surface and component.
     Go through these categories systematically and list every item you can
     see. This numbered list becomes your BINDING CONTRACT — every item on
     this list MUST be processed in Phase 4 and accounted for in Phase 6.

     Categories to scan:
       - Painted body panels (hood, roof, trunk, doors, fenders, bumpers,
         side skirts, pillars, spoiler, diffuser, running boards, etc.)
       - Glass surfaces (windshield, rear window, side windows, quarter
         glass, sunroof, etc.)
       - Chrome/metal trim (door handles, window surrounds, grille, badges,
         exhaust tips, trim strips, fuel cap, etc.)
       - Lights (headlights, taillights, fog lights, DRLs, turn signals,
         reverse lights, etc.)
       - Wheels (spokes, rim lip, centre cap, lug nuts, brake components,
         tyre sidewalls, etc.)
       - Mirrors (glass, housing/cap)
       - Miscellaneous (roof rails, antenna, sensor pods, camera lenses,
         etc.)

     COUNT the total number of items. Write: "TOTAL SURFACES: [N]"
     This number N is your target. Phase 4 must address exactly N surfaces.

     You will extract ONLY the parts on this list.
     You will NOT add any part of the car that is not on this list.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 2 — EXTRACT: ISOLATE THE CAR FROM IMAGE 1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2.1  Draw a precise mask around every visible part of the car identified in
     Phase 1. The mask must follow the actual edge of the car exactly —
     including:
     - Complex curves of body panels
     - Gaps between tyres and wheel arches
     - Side mirror protrusions
     - Antenna tips
     - Any overhang at the bumper or roof

2.2  The mask must NOT include:
     - Any part of the original background (sky, ground, building, dealership)
     - Any shadow cast on the original floor (leave behind in the source)
     - Any part of the car that is cropped out / not visible in Image 1

2.3  Extract the masked car as a clean, isolated layer.
     The silhouette of the extracted car must be 100% identical to Image 1.
     Every panel edge, every body line must be preserved exactly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 3 — COMPOSITE: PLACE THE CAR INTO THE STUDIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3.1  Take the extracted car from Phase 2 and place it into Image 2's studio
     environment.

3.2  POSITION RULES — the car's position in the final frame must be IDENTICAL
     to Image 1:
     - Same horizontal position (centred / left / right)
     - Same vertical position
     - Same amount of background visible around the car
     - Same crop boundaries (if a bumper was cropped in Image 1, it is cropped
       here too)

3.3  GEOMETRY LOCK — the car must not be:
     - Zoomed in or zoomed out
     - Rotated or flipped
     - Perspective-corrected or "improved" in any way
     The geometry is sacred. It must be pixel-identical to Image 1.

3.4  FLOOR CONTACT
     - The tyres must sit firmly on the studio floor of Image 2
     - No floating — no gap between tyre and floor
     - Cast a soft, realistic contact shadow directly beneath each tyre

3.5  At the end of this phase the background is 100% from Image 2.
     Nothing from Image 1's original background is visible anywhere.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 4 — REFLECTION PURGE: PROCESS EVERY SINGLE SURFACE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This phase is MANDATORY. Every reflective surface on the car still carries
reflections baked in from Image 1's original environment. You MUST remove
ALL of them from EVERY surface — no exceptions, no partial passes, no
skipping.

⚠️  CRITICAL: You must process EVERY surface from your Phase 1 inventory.
    Work through the reference list below. For each item:
      - If visible in Image 1 → PROCESS IT (remove reflections, apply studio)
      - If NOT visible in Image 1 → mentally note "not present" and continue
    DO NOT silently skip any surface that IS visible. That is a FAILED output.

MASTER CONTAMINATION LIST — remove every instance of these from EVERY surface:
  ✗ Trees, branches, leaves, foliage (any colour, any season)
  ✗ Sky (blue, white, grey, gradient, overcast, dawn, dusk)
  ✗ Clouds, sun disc, sunbeams, sun glare, lens flare
  ✗ Buildings, facades, walls, windows, architectural structures
  ✗ Roads, asphalt, concrete, kerbs, pavements, parking lot markings
  ✗ Dealership showroom interior (ceiling tiles, fluorescent strips,
      showroom floor, display banners, other cars on the lot)
  ✗ Indoor overhead lighting (strip lights, pendant lights, spotlights,
      chandeliers, fluorescent tubes — any fixture that is not a studio lamp)
  ✗ Other vehicles (cars, trucks, trailers, motorcycles)
  ✗ People, pedestrians, staff, or shadows of people
  ✗ Street furniture (poles, signs, bollards, fences, overhead wires,
      traffic lights, lamp posts)
  ✗ Any other identifiable real-world environment object

WORK THROUGH EVERY SURFACE BELOW. DO NOT STOP UNTIL YOU REACH THE END.

  ── PAINTED BODY PANELS ──────────────────────────────────────────────────────
  Process EVERY painted panel that appears in your Phase 1 inventory.

  HOOD / BONNET
    Scan the entire painted surface from edge to edge.
    Remove every tree, sky gradient, building, or environment element.
    Replace with a smooth soft-white gradient representing the studio ceiling
    overhead. No distinct shapes. No colour casts. Pure tonal gradient only.

  ROOF
    Scan the entire roof surface from windshield header to rear window edge.
    Remove every trace of sky, clouds, trees, and environment completely.
    Replace with soft white studio-ceiling gradient — smooth and featureless.

  TRUNK / BOOT LID
    Scan the entire trunk lid surface.
    Remove all outdoor or indoor environment reflections without exception.
    Replace with soft studio-ceiling gradient matching the roof treatment.

  FRONT DOORS (every front door that is visible — driver side, passenger side)
    Scan the entire painted surface of each visible front door.
    Remove every outdoor and showroom reflection from the paint. Side doors
    typically carry the sky horizon at mid-height and road/ground reflections
    at the lower edge — remove both completely.
    Replace with a soft vertical studio-wall gradient (brighter at centre and
    top, gradually darker toward the lower edge).

  REAR DOORS (every rear door that is visible)
    Scan the entire painted surface of each visible rear door.
    Remove every outdoor and showroom reflection from the paint. These carry
    the same sky-horizon and road reflections as front doors.
    Replace with a soft vertical studio-wall gradient (brighter at centre and
    top, gradually darker toward the lower edge).

  FRONT FENDERS / WINGS (every visible front fender)
    Scan the entire painted surface of each visible front fender.
    Remove all sky, tree-top, building, and environment reflections.
    Replace with soft studio-wall gradient.

  REAR FENDERS / QUARTER PANELS (every visible rear fender)
    Scan the entire painted surface of each visible rear fender.
    Remove all sky, tree-top, building, and outdoor reflections.
    Replace with soft studio-wall gradient.

  FRONT BUMPER
    Scan the entire front bumper surface including lower air dams and splitter.
    Remove road surface, sky, and any environment reflections.
    Replace with soft studio-floor gradient (light grey / white).

  REAR BUMPER
    Scan the entire rear bumper surface including diffuser area.
    Remove road surface, sky, and any environment reflections.
    Replace with soft studio-floor gradient (light grey / white).

  SIDE SKIRTS / ROCKER PANELS (every visible side skirt)
    These panels sit very close to the ground and typically carry strong road
    and pavement reflections. Scan the full length of every visible side skirt.
    Remove ALL road, pavement, and environment reflections completely.
    Replace with a soft dark-grey studio-floor gradient.

  A-PILLARS, B-PILLARS, C-PILLARS, D-PILLARS (every visible pillar)
    Scan every visible pillar surface individually.
    Remove sky and outdoor environment from each pillar surface.
    Replace with soft studio gradient matching the adjacent body panel tone.

  SPOILER / WING (process this surface if it is visible — do not skip)
    Remove outdoor reflections from the entire spoiler surface.
    Replace with soft studio-ceiling gradient.

  REAR DIFFUSER / LOWER VALANCE (process this surface if visible — do not skip)
    Remove road and ground reflections from the diffuser.
    Replace with soft studio-floor gradient.

  RUNNING BOARDS / SIDE STEPS (process if visible — do not skip)
    Remove road and pavement reflections from the surface.
    Replace with soft studio-floor gradient.

  ANY OTHER PAINTED PANEL visible in your Phase 1 inventory that is not
  listed above — process it now using the same method: remove all outdoor
  environment reflections, replace with appropriate studio gradient.

  ── GLASS SURFACES ───────────────────────────────────────────────────────────
  After this section, ZERO outdoor scenery must be visible IN or ON any glass.
  Process EVERY glass surface from your Phase 1 inventory.

  WINDSHIELD (front)
    Remove everything visible THROUGH the glass:
      - Sky visible through top portion of windshield
      - Dashboard reflection of the outdoor scene
      - Trees or buildings seen through the glass
    Remove everything reflected ON the outer glass surface:
      - Sky reflection sitting on the glass
      - Building or tree reflections on the glass
    Replace with: soft white studio-wall / ceiling gradient visible through
    the glass. The car's interior (steering wheel, dashboard) may remain
    visible if seen through the glass — but every trace of the outdoor scene,
    whether behind the glass or on its surface, must be gone.

  REAR WINDOW
    Remove all outdoor scenery visible THROUGH the glass — sky, trees,
    buildings, other vehicles, everything.
    Remove all outdoor reflections sitting ON the glass surface.
    Replace with soft studio-environment gradient.

  FRONT SIDE WINDOWS — DRIVER SIDE
    Remove sky, trees, buildings visible through or reflected in the glass.
    Remove dealership/showroom interior if reflected in the window.
    Replace with soft studio-wall gradient visible through the glass.

  FRONT SIDE WINDOWS — PASSENGER SIDE (process if visible — do not skip)
    Remove sky, trees, buildings visible through or reflected in the glass.
    Remove dealership/showroom interior if reflected in the window.
    Replace with soft studio-wall gradient visible through the glass.

  REAR SIDE WINDOWS — DRIVER SIDE (process if visible — do not skip)
    Remove sky, trees, buildings visible through or reflected in the glass.
    Remove dealership/showroom interior if reflected in the window.
    Replace with soft studio-wall gradient visible through the glass.

  REAR SIDE WINDOWS — PASSENGER SIDE (process if visible — do not skip)
    Remove sky, trees, buildings visible through or reflected in the glass.
    Remove dealership/showroom interior if reflected in the window.
    Replace with soft studio-wall gradient visible through the glass.

  QUARTER GLASS (small fixed pane near C-pillar — process if visible)
    Remove all outdoor reflections and see-through scenery.
    Replace with soft studio gradient.

  SUNROOF / MOONROOF GLASS (process if visible from outside — do not skip)
    Remove all sky and overhead outdoor environment.
    Replace with soft studio-ceiling gradient.

  ANY OTHER GLASS SURFACE visible in your Phase 1 inventory that is not
  listed above — process it now: remove all outdoor environment, replace
  with studio gradient.

  ── CHROME AND POLISHED METAL ────────────────────────────────────────────────
  Chrome is highly reflective and holds a wide-angle panorama of the
  environment. Process EVERY chrome element from your Phase 1 inventory.

  DOOR HANDLES (every visible door handle — do not skip any)
    Remove all outdoor environment from each handle surface.
    Replace with bright white studio-wall highlight.

  WINDOW SURROUNDS / TRIM STRIPS (every visible window surround)
    Remove outdoor scene reflected along the entire length of each trim strip.
    Replace with a bright white studio-highlight streak — thin, linear, clean.

  GRILLE BARS, MESH, AND SURROUND
    Remove sky and tree reflections from every individual bar and the surround
    frame. Replace with bright-white studio highlights on the bars and a soft
    dark-grey studio-floor gradient on the lower grille area.

  BUMPER CHROME STRIPS — FRONT (process if visible — do not skip)
    Remove road and sky reflections from the entire strip.
    Replace with a clean linear studio-highlight gradient.

  BUMPER CHROME STRIPS — REAR (process if visible — do not skip)
    Remove road and sky reflections from the entire strip.
    Replace with a clean linear studio-highlight gradient.

  SIDE BODY MOULDINGS / TRIM (process every visible moulding)
    Remove outdoor reflections from each moulding surface.
    Replace with soft studio-wall gradient.

  EXHAUST TIPS (process every visible exhaust tip — do not skip)
    Remove road and ground reflections from each exhaust tip.
    Replace with a circular studio-ceiling highlight inside the tip opening.

  MIRROR CAPS (process every visible mirror cap — chromed or gloss painted)
    Remove outdoor environment reflections from each mirror cap.
    Replace with soft studio-wall gradient.

  BADGE / EMBLEM SURROUNDS (process every visible badge surround)
    Remove outdoor reflections from the metallic surround ring or frame.
    The badge itself — logo shape, colour, lettering — must remain unchanged.

  FUEL FILLER CAP (process if visible — do not skip)
    Remove outdoor reflections from the cap surface.
    Replace with soft studio highlight.

  ANY OTHER CHROME OR METAL TRIM visible in your Phase 1 inventory that is
  not listed above — process it now: remove outdoor reflections, replace
  with studio highlight.

  ── HEADLIGHTS ───────────────────────────────────────────────────────────────
  Process EVERY headlight component from your Phase 1 inventory.

  HEADLIGHT OUTER LENS SURFACE (every visible headlight)
    Remove sky and tree reflections sitting on the outside of each lens.
    Replace with a soft white studio-ceiling gradient on each lens surface.

  HEADLIGHT INTERNAL CHROME REFLECTOR BOWLS (every visible headlight)
    Remove any outdoor environment visible inside each headlight housing.
    Replace with a soft studio-light gradient (the reflector must look as
    though it is illuminated by a white studio ceiling, not the sky).

  DRL / LED LIGHT STRIPS (process every visible DRL element)
    Remove outdoor environment from chrome surrounds of each DRL element.
    Replace with studio-ceiling highlight.

  FOG LIGHT LENSES (process every visible fog light — do not skip)
    Remove outdoor reflections from each fog light lens.
    Replace with soft studio gradient.

  ── TAILLIGHTS ───────────────────────────────────────────────────────────────
  Process EVERY taillight component from your Phase 1 inventory.

  TAILLIGHT OUTER LENSES (every visible taillight)
    Remove outdoor environment reflections from each lens surface.
    PRESERVE the red / amber factory tint — do not alter the colour.
    Remove only what is reflected on or visible through each lens.

  TAILLIGHT INTERNAL CHROME ELEMENTS (every visible taillight)
    Remove outdoor reflections from internal chrome of each tail light.
    Replace with soft studio-ceiling gradient.

  REVERSE LIGHT LENSES (process every visible reverse light — do not skip)
    Remove outdoor reflections from each reverse light lens.
    Keep factory lens colour intact.

  TURN SIGNAL LENSES (process every visible turn signal — do not skip)
    Remove outdoor reflections from each turn signal lens.
    Keep factory lens colour intact.

  ── WHEELS AND BRAKES ────────────────────────────────────────────────────────
  Process EVERY visible wheel completely. Do not process one wheel and skip
  the other. If two wheels are visible, both must be fully processed.

  WHEEL FACES AND SPOKES (every visible wheel)
    Critical for alloy, machined, or chrome wheels — each spoke face acts as
    an individual mirror. Remove ALL outdoor environment from every spoke face
    on every visible wheel.
    Replace with:
      - Upper-facing spokes  → soft white studio-wall reflection
      - Lower-facing spokes  → soft grey studio-floor reflection
      - Spoke edges          → thin white studio-highlight rim

  WHEEL BARREL / RIM LIP (every visible wheel)
    Remove outdoor environment from each wheel's rim lip.
    Replace with a crisp white linear studio highlight.

  CENTRE CAP (every visible wheel)
    Remove outdoor reflections from each wheel's centre cap.
    Replace with soft studio-ceiling gradient.

  LUG NUTS / BOLTS (process on every visible wheel where nuts are visible)
    Remove outdoor reflections from each visible lug nut.

  BRAKE CALIPERS (process on every visible wheel where calipers show through)
    Remove outdoor environment visible behind or around spokes.
    Apply neutral studio lighting.

  BRAKE ROTORS (process on every visible wheel where rotors show through)
    Remove outdoor environment from each rotor surface. The rotor must look
    neutrally lit by the studio, not reflecting the outside world.

  TYRE SIDEWALLS (process on every visible wheel — glossy or not)
    Remove road and environment reflections from each tyre sidewall surface.
    Ensure neutral studio lighting on sidewall.

  ── SIDE MIRRORS ─────────────────────────────────────────────────────────────
  Process EVERY visible side mirror completely.

  MIRROR GLASS — the reflective viewing surface (every visible mirror)
    Remove all outdoor scenery reflected in each mirror glass.
    Replace with the studio environment from Image 2.

  MIRROR HOUSING / CAP (every visible mirror)
    Remove outdoor reflections from each painted or glossy housing surface.
    Replace with soft studio-wall gradient.

  ── MISCELLANEOUS REFLECTIVE PARTS ──────────────────────────────────────────
  Process EVERY miscellaneous reflective part from your Phase 1 inventory.
  Do not skip any of these items.

  ROOF RAILS / CROSSBARS (process if visible — do not skip)
    Remove outdoor reflections from each rail / bar surface.
    Replace with soft studio-ceiling highlight.

  ROOF ANTENNA / SHARK-FIN ANTENNA (process if visible — do not skip)
    Remove outdoor reflections from the antenna surface.
    Replace with soft studio gradient.

  SENSOR PODS / RADAR HOUSINGS (process if visible — do not skip)
    Remove outdoor reflections from each sensor surface.
    Replace with soft studio gradient.

  BODY-MOUNTED CAMERA LENSES (process if visible — do not skip)
    Remove outdoor reflections from each camera lens.
    Replace with soft studio gradient.

  TOW HOOK COVER (process if visible — do not skip)
    Remove outdoor reflections. Replace with studio gradient.

  RAIN GUTTERS / DRIP RAILS (process if visible — do not skip)
    Remove outdoor reflections. Replace with studio gradient.

  ANY OTHER REFLECTIVE SURFACE visible in your Phase 1 inventory that is not
  listed above — process it now: remove outdoor reflections, replace with
  appropriate studio gradient or highlight.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 4B — MANDATORY CATCH-ALL SWEEP (DO NOT SKIP THIS PHASE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Now that you have gone through the detailed reference list, perform a FULL
SWEEP of the ENTIRE car from left edge to right edge, top to bottom:

4B.1  Scan the car's TOP EDGE — roof, antenna, roof rails. Any remaining
      outdoor reflections? Process them now.

4B.2  Scan the car's UPPER ZONE — hood, windshield, A-pillars, mirrors.
      Any remaining outdoor reflections? Process them now.

4B.3  Scan the car's MID ZONE — doors, fenders, windows, B-pillars, C-pillars,
      all chrome trim, all glass. Any remaining outdoor reflections? Process
      them now.

4B.4  Scan the car's LOWER ZONE — bumpers, side skirts, fog lights, lower
      grille, wheels, brake components, tyre sidewalls. Any remaining outdoor
      reflections? Process them now.

4B.5  Scan the car's REAR — trunk, taillights, rear window, rear bumper,
      exhaust tips, rear badge. Any remaining outdoor reflections? Process
      them now.

4B.6  FINAL PIXEL-LEVEL SCAN: Look at every single pixel of the car surface.
      If ANY pixel still contains colour or shape from the original outdoor
      environment, fix it now. The car must be 100% free of outdoor
      contamination.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 5 — STUDIO LIGHTING CORRECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Now that all reflections are clean on EVERY surface, correct the car's
lighting to match the studio environment in Image 2. Apply these changes
to the ENTIRE car — not just some panels.

REMOVE from EVERY surface of the car:
  ✗ Hard directional sunlight highlights and hot-spots
  ✗ Harsh outdoor shadows cast across body panels
  ✗ Warm golden / orange colour cast from sunset or halogen lights
  ✗ Cool blue colour cast from overcast sky or open shade
  ✗ Uneven natural light falloff across the car body

ADD studio lighting to the ENTIRE car:
  ✓ Soft diffuse key light — primary illumination, no hard shadow edges
  ✓ Fill light — lifts the shadow side of the car, preserves detail in
      darker areas
  ✓ Rim / separation light — subtle highlight along the roofline and rear
      edges to visually separate the car from the background
  ✓ Neutral colour temperature — 5500 to 6500 Kelvin, pure white light
  ✓ Even illumination — no panel should be dramatically brighter than its
      adjacent panels
  ✓ Soft contact shadow beneath the tyres on the studio floor

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 6 — INVENTORY VERIFICATION (MANDATORY — DO NOT SKIP)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Go back to your Phase 1 NUMBERED INVENTORY. For EVERY item on that list,
verify:

6.1  Was this surface processed in Phase 4? (reflection removal + studio
     gradient applied)
6.2  Was studio lighting applied to this surface in Phase 5?
6.3  Is the surface identity preserved? (shape, colour, finish, texture)

Additionally verify these elements are unchanged from Image 1:
  ✓ All manufacturer badges and emblems — shape, colour, finish, position
  ✓ License plate or plate mount — keep exactly as shown in Image 1
  ✓ Body panel gaps — the spacing between panels must not change
  ✓ Body lines and character creases — all sculpting preserved
  ✓ Paint colour and finish — metallic flake, pearl, matte, gloss unchanged
  ✓ Any tyre sidewall lettering visible in Image 1
  ✓ Windshield wipers if visible
  ✓ Antenna if visible
  ✓ Contrasting roof colour or roof wrap if applicable

SURFACE COUNT CHECK:
  Count how many surfaces you processed in Phase 4.
  Compare to your Phase 1 TOTAL SURFACES count.
  If the number processed is LESS than the total inventory → you missed
  surfaces. Go back to Phase 4 and process the missing ones before continuing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL GATE — EVERY BOX MUST BE CHECKED BEFORE OUTPUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMPLETENESS:
[ ] EVERY surface from Phase 1 inventory was processed — none were skipped
[ ] Phase 4B catch-all sweep was completed across all zones
[ ] Surface count processed = Surface count inventoried (no mismatch)

EXTRACTION & GEOMETRY:
[ ] Car silhouette is identical to Image 1
[ ] No part of Image 1's original background is visible anywhere
[ ] Car is in the same position in the frame as Image 1
[ ] Zoom level is identical to Image 1
[ ] No body panels added that were not visible in Image 1
[ ] No body panels that were cropped in Image 1 are now visible

REFLECTION PURGE — ZERO TOLERANCE ON EVERY SURFACE:
[ ] ZERO trees or foliage visible on ANY surface
[ ] ZERO sky or clouds visible on ANY surface
[ ] ZERO buildings or architecture visible on ANY surface
[ ] ZERO road, ground, or parking lot visible on ANY surface
[ ] ZERO dealership or showroom interior visible on ANY surface
[ ] ZERO indoor light fixtures (other than studio) visible on ANY surface
[ ] ZERO other vehicles visible on ANY surface
[ ] ZERO people or shadows of people visible on ANY surface
[ ] ZERO street furniture visible on ANY surface
[ ] ALL glass surfaces show ONLY studio environment — no exceptions
[ ] ALL chrome shows ONLY studio highlights — no exceptions
[ ] ALL wheel spokes on ALL wheels show ONLY studio reflections
[ ] ALL mirrors show ONLY studio environment — no exceptions
[ ] ALL headlight and taillight surfaces are clean — no exceptions

STUDIO INTEGRATION:
[ ] Background is entirely from Image 2
[ ] Tyres make solid contact with studio floor — no floating
[ ] Soft shadow beneath the car on studio floor
[ ] Car lighting matches the soft studio lighting of Image 2 on ALL surfaces
[ ] No outdoor colour cast remains on ANY panel

QUALITY:
[ ] Output looks like a REAL PHOTOGRAPH — not CGI, not an illustration
[ ] All badges, logos, and panel details are preserved from Image 1
[ ] Output is sharp and high resolution

INSTANT FAIL — any one of these means the output is INVALID:
  ✗ ANY surface from Phase 1 inventory was not processed (skipped/missed)
  ✗ Car geometry changed from Image 1 (zoom, angle, crop, or rotation)
  ✗ Any outdoor reflection visible on any surface anywhere
  ✗ Any part of Image 1's original background still visible
  ✗ Car appears to float above the studio floor
  ✗ CGI / rendered / illustrated appearance
  ✗ Body panels hallucinated beyond what was visible in Image 1
  ✗ One wheel processed but another wheel left untouched
  ✗ One side of the car cleaned but the other side still has reflections
  ✗ Any glass surface still showing outdoor scenery

OUTPUT SPEC: 4:3 aspect ratio. Photorealistic photograph quality.
${branding?.isEnabled ? "BRANDING: Place the provided logo in the top-left corner, sized to 8% of image width, with 10% opacity reduction for subtlety." : ""}
`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// ANGLE DETECTION
// ─────────────────────────────────────────────────────────────────────────────

async function detectCarAngle(
  ai: GoogleGenerativeAI,
  base64Image: string
): Promise<{ angle: string; confidence: number }> {
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

    const model = ai.getGenerativeModel({
      model: "gemini-1.5-pro",
      generationConfig: { responseMimeType: "application/json" },
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

    const data = JSON.parse(text);
    const category = data.category?.toUpperCase() || "EXTERIOR_CAR";
    const confidence = typeof data.confidence === "number" ? data.confidence : 0;

    console.log(`✅ Parsed Category: ${category} (Confidence: ${confidence})`);
    return { angle: category, confidence };

  } catch (error) {
    console.error("❌ Detection failed, defaulting to EXTERIOR_CAR:", error);
    return { angle: "EXTERIOR_CAR", confidence: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENCE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload a base64 result image to the `generated-images` bucket and insert a
 * row into the `generations` table. Uses the service role key to bypass RLS.
 */
async function saveGeneration(
  resultBase64: string, // e.g. "data:image/png;base64,..."
  userId: string,
  angle?: string
): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, serviceKey);

  // Strip the data URL prefix to get the raw base64 bytes
  const base64Data = resultBase64.includes(",")
    ? resultBase64.split(",")[1]
    : resultBase64;

  // Decode base64 → Uint8Array
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const fileName = `${userId}/${Date.now()}.png`;

  const { error: uploadError } = await supabase.storage
    .from("generated-images")
    .upload(fileName, bytes, { contentType: "image/png", upsert: false });

  if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

  // Get the public URL
  const { data: urlData } = supabase.storage
    .from("generated-images")
    .getPublicUrl(fileName);

  const resultUrl = urlData.publicUrl;

  const { error: dbError } = await supabase
    .from("generations")
    .insert({ user_id: userId, result_url: resultUrl, angle: angle ?? null });

  if (dbError) throw new Error(`DB insert failed: ${dbError.message}`);

  console.log(`✅ Generation saved: ${resultUrl}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTING
// ─────────────────────────────────────────────────────────────────────────────

async function processCarImage(
  ai: GoogleGenerativeAI,
  originalBase64: string,
  studioImageBase64: string,
  angle: string,
  taskType: string = "bg-replacement",
  branding?: { isEnabled?: boolean; logoUrl?: string | null }
): Promise<string> {

  // Interior
  if (angle === "INTERIOR_CAR" || angle === "interior" || taskType === "interior") {
    return processGenAI(
      ai,
      originalBase64,
      studioImageBase64,
      branding,
      buildInteriorPrompt()
    );
  }

  // Detail / close-up
  if (angle === "DETAIL_CAR" || angle === "detail") {
    return processGenAI(
      ai,
      originalBase64,
      studioImageBase64,
      branding,
      buildDetailPrompt()
    );
  }

  // All exterior variants (EXTERIOR_CAR, DOOR_OPEN, TRUNK_OPEN, HOOD_OPEN)
  return processGenAI(
    ai,
    originalBase64,
    studioImageBase64,
    branding,
    buildExteriorPrompt(branding)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE GENERATION
// ─────────────────────────────────────────────────────────────────────────────

async function processGenAI(
  ai: GoogleGenerativeAI,
  image1Base64: string,
  image2Base64: string | null,
  branding: { isEnabled?: boolean; logoUrl?: string | null } | undefined,
  promptText: string
): Promise<string> {
  const clean1 = image1Base64.includes(",") ? image1Base64.split(",")[1] : image1Base64;

  const parts: any[] = [
    { inlineData: { data: clean1, mimeType: "image/png" } },
  ];

  if (image2Base64) {
    const clean2 = image2Base64.includes(",") ? image2Base64.split(",")[1] : image2Base64;
    parts.push({ inlineData: { data: clean2, mimeType: "image/png" } });
  }

  if (branding?.isEnabled && branding?.logoUrl) {
    const cleanLogo = branding.logoUrl.includes(",")
      ? branding.logoUrl.split(",")[1]
      : branding.logoUrl;
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
    ],
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
      const textPart = candidate?.content?.parts?.find((p: any) => p.text)?.text;
      throw new Error(
        `AI Failure. Model: ${MODEL_IMAGE}. FinishReason: ${finishReason}. ` +
        `Text: "${textPart?.substring(0, 50)}...". Check logs for full response.`
      );
    }

    return `data:image/png;base64,${imagePart.inlineData.data}`;

  } catch (err) {
    console.error("Gemini GenAI Error:", err);
    throw err;
  }
}