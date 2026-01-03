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

export const RATIO_MAP: Record<string, [number, number]> = {
    "1:1 (Square)": [1024, 1024],
    "2:3 (Portrait)": [832, 1216],
    "3:2 (Landscape)": [1216, 832],
    "4:5 (Portrait)": [896, 1120],
    "9:16 (Vertical)": [768, 1344]
};

export const BACKGROUND_STYLES: Record<string, string> = {
    "Studio Grey": "neutral studio grey background",
    "White Seamless": "clean white seamless background",
    "Light Grey": "soft light grey background",
    "Pastel": "subtle pastel background"
};

export const generateModelWithDress = async (
    dressImageBase64: string,
    angle: string,
    skinTone: string,
    region: string,
    background: string,
    referenceModelBase64?: string,
    additionalPrompt: string = "",
    gender: string = "Female",
    aspectRatioStr: string = "1:1"
) => {
    const model = "gemini-2.5-flash-image-preview";

    let prompt = "";
    const parts: any[] = [];

    if (referenceModelBase64) {
        prompt = `
      SYSTEM GOAL: Produce one sharp, photorealistic fashion image.

      REFERENCE MODEL IMAGE: [reference_model_image]
      GARMENT IMAGE: [garment_image]

      RENDER SPECS:
      - Angle: ${angle}
      - Camera height: mid-torso; focal length ~50mm look; ${background}
      - Aspect ratio: ${aspectRatioStr} (strict)

      INSTRUCTIONS:
      1) Keep the SAME person as in the reference image (face, hairline, skin texture, body proportions). Do NOT change identity.
      2) PRESERVE the EXACT hair style, length, color, and texture from the reference image across ALL angles. Hair must look identical.
      3) Remove original clothes and dress the model ONLY with the GARMENT IMAGE. Preserve fabric color/texture without distortion.
      3b) Output MUST include the full human model wearing the garment. DO NOT output an isolated product cutout or flat-lay.
      4) Fit realistically with correct wrinkles/physics; align neck/shoulders; no artifacts.
      5) Lighting consistent across the set; avoid added accessories or text.
      6) For BACK angle: show model's back; keep face/head shape and hair EXACTLY the same as reference identity.
      7) For SIDE angles: maintain the same hair style and positioning as shown in reference image.
      8) Output: a single image.

      EXTRA CONTEXT:
      - Gender: ${gender}
      - Skin tone: ${skinTone}
      - Region context (styling only): ${region}
      - Additional instructions: ${additionalPrompt}
    `;
        parts.push({ text: prompt });
        // IMPORTANT: order images reference-first, then garment
        parts.push({ inlineData: { data: referenceModelBase64, mimeType: 'image/jpeg' } });
        parts.push({ inlineData: { data: dressImageBase64, mimeType: 'image/jpeg' } });
    } else {
        prompt = `
      Create a neutral, attractive ${gender.toLowerCase()} model with ${skinTone} skin tone. 
      Region context: ${region} (use only for styling/hair and sizing context, do not stereotype). 
      Maintain ${background}. 
      Show the model wearing the provided garment from ${angle} angle.
      Aspect ratio: ${aspectRatioStr}.
      Preserve the exact fabric, color, pattern, and design of the original garment.
      Output MUST include the full human model wearing the garment. DO NOT output an isolated product cutout or flat-lay.
      Ensure consistent hair style and appearance across all angles if generating multiple views.
      Ensure the image is high-quality, sharp, and photo-realistic.
      Additional instructions: ${additionalPrompt}
    `;
        parts.push({ text: prompt });
        parts.push({ inlineData: { data: dressImageBase64, mimeType: 'image/jpeg' } });
    }

    const response = await client.models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        config: {
            responseModalities: ['IMAGE', 'TEXT'],
            temperature: 0.3,
        },
    });

    return response;
};

export const generateVirtualTryOn = async (
    modelImageBase64: string,
    dressImageBase64: string,
    additionalPrompt: string = ""
) => {
    const model = "gemini-2.5-flash-image-preview";

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

QUALITY + SAFETY:
- Keep face, skin tone, and hair consistent with the original person.
- Do not add text or watermarks.
- Output one sharp photorealistic image.

USER REQUEST:
${additionalPrompt}
  `;

    const response = await client.models.generateContent({
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
        config: {
            responseModalities: ['IMAGE', 'TEXT'],
            temperature: 0.1,
        },
    });

    return response;
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
    const model = "gemini-2.5-flash-image-preview";

    const invertText = args.invert
        ? "INVERT MODE: The mask indicates PROTECTED region; edit everything else."
        : "DEFAULT MODE: The mask indicates EDITABLE region; edit only inside it.";

    const featherText = typeof args.feather === "number" && args.feather > 0
        ? `Mask edges are feathered by ~${Math.round(args.feather)}px. Blend seamlessly at the boundary.`
        : "Mask edges are crisp.";

    const baseRules = `
You are an expert photo retoucher and image editor.

TASK: Edit the image according to the user's request.

CONSTRAINTS:
- Preserve identity, background, and lighting as much as possible.
- Do not add text or watermarks.
- Output a single PNG image.
`;

    const maskRules = args.maskImageB64
        ? `
MASKING:
- A mask image is provided as the SECOND image.
- White pixels = editable, black pixels = protected.
- ${invertText}
- ${featherText}
- Keep all protected pixels unchanged (pixel-perfect if possible).
`
        : `
MASKING:
- No mask provided. Apply the edit to the whole image, while preserving identity/background.
`;

    const fullPrompt = `${baseRules}\n${maskRules}\nUSER REQUEST:\n${args.prompt}\n`;

    const parts: any[] = [
        { text: fullPrompt },
        { inlineData: { data: args.baseImageB64, mimeType: args.baseMimeType || "image/png" } },
    ];

    if (args.maskImageB64) {
        parts.push({ inlineData: { data: args.maskImageB64, mimeType: args.maskMimeType || "image/png" } });
    }

    const response = await client.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: { responseModalities: ["IMAGE", "TEXT"], temperature: 0.1 },
    });

    return response;
}
