import { GoogleGenAI } from '@google/genai';

const client = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || '',
});

export const getGeminiClient = () => client;

export interface GenerationResult {
    imagePath?: string;
    textResponse?: string;
    elapsedTime?: number;
    usage?: any;
    error?: string;
}

export type GeminiAspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "9:16" | "16:9" | "21:9";
export type GeminiImageSize = "1K" | "2K" | "4K";

export const SUPPORTED_ASPECT_RATIOS: GeminiAspectRatio[] = ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"];
export const SUPPORTED_IMAGE_SIZES: GeminiImageSize[] = ["1K", "2K", "4K"];

export function normalizeAspectRatio(input: string | null | undefined): GeminiAspectRatio {
    const raw = String(input || "").trim();
    // Accept both "16:9" and legacy labels like "16:9 (Widescreen)".
    const m = raw.match(/^(\d+:\d+)/);
    const candidate = (m ? m[1] : raw) as GeminiAspectRatio;
    return (SUPPORTED_ASPECT_RATIOS as string[]).includes(candidate) ? candidate : "1:1";
}

export function normalizeImageSize(input: string | null | undefined): GeminiImageSize {
    const raw = String(input || "").trim().toUpperCase();
    const candidate = (raw === "1K" || raw === "2K" || raw === "4K") ? (raw as GeminiImageSize) : null;
    return candidate || "1K";
}

/**
 * Expected output dimensions for metadata/display. Gemini may return slightly different
 * actual dimensions; for accuracy, read actual image dimensions when possible.
 */
export function expectedDims(aspectRatio: GeminiAspectRatio, imageSize: GeminiImageSize): [number, number] {
    const [wStr, hStr] = aspectRatio.split(":");
    const w = Number(wStr);
    const h = Number(hStr);
    const maxSide = imageSize === "4K" ? 4096 : imageSize === "2K" ? 2048 : 1024;
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return [maxSide, maxSide];

    if (w === h) return [maxSide, maxSide];
    if (w > h) return [maxSide, Math.max(1, Math.round((maxSide * h) / w))];
    return [Math.max(1, Math.round((maxSide * w) / h)), maxSide];
}

export const BACKGROUND_STYLES: Record<string, string> = {
    "Studio Grey": "neutral studio grey background",
    "White Seamless": "clean white seamless background",
    "Light Grey": "soft light grey background",
    "Pastel": "subtle pastel background"
};

function isInvalidArgumentError(e: any) {
    const msg = String(e?.message || "");
    return msg.includes("INVALID_ARGUMENT") || msg.toLowerCase().includes("invalid argument");
}

async function generateContentWithImageConfigFallback(args: {
    model: string;
    contents: any;
    baseConfig: any;
    imageConfig?: { aspectRatio?: string; imageSize?: string };
    logLabel: string;
}) {
    const { model, contents, baseConfig, imageConfig, logLabel } = args;

    // Attempt A: aspectRatio + imageSize
    if (imageConfig?.aspectRatio && imageConfig?.imageSize) {
        try {
            const res = await client.models.generateContent({
                model,
                contents,
                config: { ...baseConfig, imageConfig: { aspectRatio: imageConfig.aspectRatio, imageSize: imageConfig.imageSize } },
            });
            console.info(`[genai] imageConfig_attempt=A ${logLabel} aspectRatio=${imageConfig.aspectRatio} imageSize=${imageConfig.imageSize}`);
            return res;
        } catch (e: any) {
            if (!isInvalidArgumentError(e)) throw e;
            console.warn(`[genai] imageConfig_attempt=A_failed ${logLabel} (INVALID_ARGUMENT) retrying without imageSize`);
        }
    }

    // Attempt B: aspectRatio only
    if (imageConfig?.aspectRatio) {
        try {
            const res = await client.models.generateContent({
                model,
                contents,
                config: { ...baseConfig, imageConfig: { aspectRatio: imageConfig.aspectRatio } },
            });
            console.info(`[genai] imageConfig_attempt=B ${logLabel} aspectRatio=${imageConfig.aspectRatio}`);
            return res;
        } catch (e: any) {
            if (!isInvalidArgumentError(e)) throw e;
            console.warn(`[genai] imageConfig_attempt=B_failed ${logLabel} (INVALID_ARGUMENT) retrying without imageConfig`);
        }
    }

    // Attempt C: no imageConfig
    const res = await client.models.generateContent({
        model,
        contents,
        config: baseConfig,
    });
    console.info(`[genai] imageConfig_attempt=C ${logLabel} (no imageConfig)`);
    return res;
}

export const generateModelWithDress = async (
    dressImageBase64: string,
    angle: string,
    skinTone: string,
    region: string,
    background: string,
    referenceModelBase64?: string,
    additionalPrompt: string = "",
    gender: string = "Female",
    aspectRatioStr: string = "1:1",
    imageSizeStr: GeminiImageSize = "1K",
    opts?: { garmentMimeType?: string; referenceMimeType?: string; garmentView?: "front" | "back"; backDressBase64?: string; garmentType?: string }
) => {
    const model = "gemini-2.5-flash-image";
    const garmentMimeType = opts?.garmentMimeType || "image/jpeg";
    const referenceMimeType = opts?.referenceMimeType || "image/jpeg";
    const garmentView = opts?.garmentView || "front";
    const backDressBase64 = opts?.backDressBase64;
    const garmentType = opts?.garmentType || "Top";
    const aspectRatio = normalizeAspectRatio(aspectRatioStr);
    const imageSize = normalizeImageSize(imageSizeStr);

    const normalizedAngle = (angle || "").trim().toLowerCase();
    const angleInstruction = (() => {
        // Keep this very explicit so the model doesn't mirror left/right.
        if (normalizedAngle === "front") {
            return "Front view: model facing camera, shoulders square, centered.";
        }
        if (normalizedAngle === "back") {
            return "Back view: model facing away from camera; show the back of the garment clearly.";
        }
        if (normalizedAngle === "left-side" || normalizedAngle === "left side") {
            return "Left-Side profile: the model must be looking toward the LEFT edge of the image (nose points LEFT). Show a true side profile. Do NOT output a right-facing profile and do NOT mirror the Right-Side result.";
        }
        if (normalizedAngle === "right-side" || normalizedAngle === "right side") {
            return "Right-Side profile: the model must be looking toward the RIGHT edge of the image (nose points RIGHT). Show a true side profile. Do NOT output a left-facing profile and do NOT mirror the Left-Side result.";
        }
        if (normalizedAngle === "three-quarter" || normalizedAngle === "three quarter" || normalizedAngle === "3/4") {
            // Kept for backward compatibility if old jobs request it, even though UI no longer offers it.
            return "Three-quarter view: ~45-degree turn, with one shoulder slightly closer to camera; keep it distinct from pure side profile.";
        }
        if (normalizedAngle === "full body" || normalizedAngle === "full-body") {
            return "Wide-angle Full Body shot: Show the ENTIRE person from head to shoes. Do NOT crop at the knees or waist. The model MUST wear appropriate footwear (shoes, heels, sneakers) matching the outfit style; avoid bare feet.";
        }
        return `Follow this exact view: ${angle}. Ensure it is not accidentally mirrored or duplicated from another angle.`;
    })();

    let prompt = "";
    const parts: any[] = [];

    if (referenceModelBase64) {
        prompt = `
      SYSTEM GOAL: Produce one sharp, photorealistic fashion image.

      REFERENCE MODEL IMAGE: [reference_model_image]
      GARMENT IMAGE: [garment_image]

      RENDER SPECS:
      - View: ${angle} — ${angleInstruction}
      - Camera height: mid-torso; focal length ~50mm look; ${background}
      - Aspect ratio: ${aspectRatio} (strict)
      - Resolution: ${imageSize}

      INSTRUCTIONS:
      1) Keep the SAME person as in the reference image (face, hairline, skin texture, body proportions). Do NOT change identity.
      2) PRESERVE the EXACT hair style, length, color, and texture from the reference image across ALL angles. Hair must look identical.
      3) Remove original clothes and dress the model ONLY with the GARMENT IMAGE. Preserve fabric color/texture without distortion.
      3b) Output MUST include the full human model wearing the garment. DO NOT output an isolated product cutout or flat-lay.
      3c)       GARMENT ID LOCK (critical):
      - Treat the garment photo(s) as the ONLY truth. Do NOT invent, remove, or relocate details.
      - Closures: preserve exact closure type (zipper/buttons/none) and placement; keep center lines straight.
      - Pockets: preserve exact number, type, placement, and shape (if present).
      - Seams/panels: preserve all seam lines and panel proportions exactly; do not add or remove seams.
      - Prints/Logos: preserve exact artwork, scale, and placement; never add new branding.
      - Trims: preserve exact collar/hood/cuff/hem shape and ribbing thickness.
      - Do NOT stretch, slim, or warp the garment. Keep the exact silhouette and proportions.
      - The provided garment image is the ${garmentView.toUpperCase()} view. Do NOT mix front/back details.
      4) Fit realistically with correct wrinkles/physics; align neck/shoulders; no artifacts.
      5) Lighting consistent across the set; avoid added accessories or text.
      6) View consistency: the provided garment image is the ${garmentView.toUpperCase()} view. Do NOT mix front and back details.
      7) Angle fidelity (critical): Follow the View instruction exactly.\n+         - Left-Side must look LEFT (nose points left).\n+         - Right-Side must look RIGHT (nose points right).\n+         - They must not be mirrored duplicates.
      8) For BACK angle: show model's back; keep head shape and hair EXACTLY the same as reference identity.
      9) For SIDE angles: maintain the same hair style and positioning as shown in reference image.
      8) Output: a single image.

      ${
          backDressBase64
              ? `ADDITIONAL GARMENT VIEW (BACK): [back_garment_image]
         INSTRUCTION: Use BOTH the main (front) garment image and this back view to ensure all details (seams, hood, logos) are consistent across the requested angle.`
              : ""
      }

      EXTRA CONTEXT:
      - Gender: ${gender}
      - Garment Type: ${garmentType} (apply strictly to correct body part)
      - Skin tone: ${skinTone}
      - Region context (styling only): ${region}
      - Additional instructions: ${additionalPrompt}
    `;
        parts.push({ text: prompt });
        // IMPORTANT: order images reference-first, then garment
        parts.push({ inlineData: { data: referenceModelBase64, mimeType: referenceMimeType } });
        parts.push({ inlineData: { data: dressImageBase64, mimeType: garmentMimeType } });
        if (backDressBase64) {
            parts.push({ inlineData: { data: backDressBase64, mimeType: "image/jpeg" } });
        }
    } else {
        prompt = `
      Create a neutral, attractive ${gender.toLowerCase()} model with ${skinTone} skin tone. 
      Region context: ${region} (use only for styling/hair and sizing context, do not stereotype). 
      Maintain ${background}. 
      Show the model wearing the provided garment. View: ${angle} — ${angleInstruction}
      Aspect ratio: ${aspectRatio}.
      Resolution: ${imageSize}.
      Preserve the exact fabric, color, pattern, and design of the original garment.
      Output MUST include the full human model wearing the garment. DO NOT output an isolated product cutout or flat-lay.
      GARMENT ID LOCK (critical):
      - Treat the garment photo(s) as the ONLY truth. Do NOT invent, remove, or relocate details.
      - Closures: preserve exact closure type (zipper/buttons/none) and placement; keep center lines straight.
      - Pockets: preserve exact number, type, placement, and shape (if present).
      - Seams/panels: preserve all seam lines and panel proportions exactly; do not add or remove seams.
      - Prints/Logos: preserve exact artwork, scale, and placement; never add new branding.
      - Trims: preserve exact collar/hood/cuff/hem shape and ribbing thickness.
      - Do NOT stretch, slim, or warp the garment. Keep the exact silhouette and proportions.
      - The provided garment image is the ${garmentView.toUpperCase()} view. Do NOT mix front/back details.
      Angle fidelity (critical):\n+      - Left-Side must look LEFT (nose points left).\n+      - Right-Side must look RIGHT (nose points right).\n+      - They must not be mirrored duplicates.
      Ensure consistent hair style and appearance across all angles if generating multiple views.
      Ensure the image is high-quality, sharp, and photo-realistic.
      Garment Type: ${garmentType} (apply strictly to correct body part)
      Additional instructions: ${additionalPrompt}

      ${
          backDressBase64
              ? `ADDITIONAL GARMENT VIEW (BACK): [back_garment_image]
         INSTRUCTION: Use BOTH the main (front) garment image and this back view to ensure all details (seams, hood, logos) are consistent.`
              : ""
      }
    `;
        parts.push({ text: prompt });
        parts.push({ inlineData: { data: dressImageBase64, mimeType: garmentMimeType } });
        if (backDressBase64) {
            parts.push({ inlineData: { data: backDressBase64, mimeType: "image/jpeg" } });
        }
    }

    const baseConfig = {
        responseModalities: ['IMAGE', 'TEXT'],
        temperature: 0.1,
    };

    return await generateContentWithImageConfigFallback({
        model,
        contents: [{ role: 'user', parts }],
        baseConfig,
        imageConfig: { aspectRatio, imageSize },
        logLabel: "generateModelWithDress",
    });
};

export const generateVirtualTryOn = async (
    modelImageBase64: string,
    dressImageBase64: string,
    additionalPrompt: string = "",
    aspectRatioStr: string = "1:1",
    imageSizeStr: GeminiImageSize = "1K"
) => {
    const model = "gemini-2.5-flash-image";
    const aspectRatio = normalizeAspectRatio(aspectRatioStr);
    const imageSize = normalizeImageSize(imageSizeStr);

    const prompt = `
    Please generate a virtual try-on result.

    Model image: [model_image]
    Dress image: [dress_image]

PRIMARY TASK:
- Put the uploaded dress on the same person from the model image (keep identity).

GARMENT RULES:
    1. Remove the model's original clothing, shawl/dupatta, jewelry, and accessories completely.
2. Use ONLY the uploaded dress image as the clothing. Do not mix features of the original outfit.
    3. Preserve the exact fabric color, texture, embroidery, and design of the dress without fading or distortion.
4. Fit the dress naturally to the body with realistic folds, shadows, and lighting.

COMPOSITION / POSE / FRAMING (IMPORTANT):
- Follow the user's request below for camera framing and pose (e.g. \"full body\", \"zoom out\", \"center the subject\", \"straight pose\").
- If the request needs more canvas/background, extend the background in a consistent way (same style/lighting) rather than changing it.
 - Aspect ratio: ${aspectRatio} (strict)
 - Resolution: ${imageSize}

QUALITY + SAFETY:
- Keep face, skin tone, and hair consistent with the original person.
- Do not add text or watermarks.
- Output one sharp photorealistic image.

USER REQUEST:
${additionalPrompt}
  `;

    const baseConfig = {
        responseModalities: ['IMAGE', 'TEXT'],
        temperature: 0.1,
    };

    return await generateContentWithImageConfigFallback({
        model,
        contents: [
            {
                role: 'user',
                parts: [
                    { text: prompt },
                    { inlineData: { data: modelImageBase64, mimeType: 'image/jpeg' } },
                    { inlineData: { data: dressImageBase64, mimeType: 'image/jpeg' } },
                ],
            },
        ],
        baseConfig,
        imageConfig: { aspectRatio, imageSize },
        logLabel: "generateVirtualTryOn",
    });
};

export const generateVideo = async (
    prompt: string,
    dressImageBase64: string,
    modelImageBase64?: string
) => {
    const model = "veo-3.1-generate-preview";

    // Note: The SDK might handle images differently for generateVideos
    // Based on the d.ts, it takes GenerateVideosParameters
    const response = await client.models.generateVideos({
        model,
        prompt,
        config: {
            numberOfVideos: 1,
        },
    });

    return response;
};

export const pollVideoOperation = async (operationId: string) => {
    let operation = await client.operations.get({
        operation: { name: operationId } as any
    });

    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await client.operations.get({
            operation: { name: operationId } as any
        });
    }

    return operation;
};

export async function editImageWithMask(args: {
    baseImageB64: string;
    baseMimeType: string;
    prompt: string;
    maskImageB64?: string | null;
    maskMimeType?: string;
    invert?: boolean;
    feather?: number;
}) {
    const chatModel = "gemini-2.5-flash-image";

    const featherText = typeof args.feather === "number" && args.feather > 0
        ? `Mask edges are feathered by ~${Math.round(args.feather)}px. Blend seamlessly at the boundary.`
        : "Mask edges are crisp.";

    const baseRules = `
You are an expert photo retoucher and image editor.

TASK: Edit the image according to the user's request.

ABSOLUTE CONSTRAINTS (must follow):
- Treat the provided mask as authoritative. If the user's text conflicts with the mask location, follow the mask.
- Do NOT change framing, crop, zoom, camera angle, or overall image dimensions.
- Do NOT mirror/flip the image.
- Keep everything outside the editable mask unchanged.
- Preserve identity, background, lighting, and garment details as much as possible.
- Do not add text or watermarks.
- Output a single PNG image.
`;

    const maskRules = args.maskImageB64
        ? `
MASKING:
- A user-provided mask is provided.
- White pixels = editable, black pixels = protected.
- ${featherText}
- Keep all protected pixels unchanged (pixel-perfect if possible).
- If there are multiple painted regions, apply the edit only within the main painted region.
`
        : `
MASKING:
- No mask provided. Apply the edit to the whole image, while preserving identity/background.
`;

    const fullPrompt = `${baseRules}\n${maskRules}\nUSER REQUEST:\n${args.prompt}\n`;

    // Gemini Developer API: use Gemini image chat editing. (Imagen editImage is Vertex AI only.)
    const parts: any[] = [
        { text: fullPrompt },
        { inlineData: { data: args.baseImageB64, mimeType: args.baseMimeType || "image/png" } },
    ];

    if (args.maskImageB64) {
        parts.push({ inlineData: { data: args.maskImageB64, mimeType: args.maskMimeType || "image/png" } });
    }

    const response: any = await client.models.generateContent({
        model: chatModel,
        contents: [{ role: "user", parts }],
        config: { responseModalities: ["IMAGE", "TEXT"], temperature: 0.1 },
    });

    const respParts = response?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = respParts.find((p: any) => p.inlineData?.data);
    if (!imagePart?.inlineData?.data) throw new Error("No image generated");
    return { b64: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType || "image/png" };
}
