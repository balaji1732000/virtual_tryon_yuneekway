import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getGeminiClient } from "@/lib/gemini";
import { normalizeBufferToJpeg, normalizeToJpeg } from "@/lib/image-normalize";

function extractInlineImage(response: any): { b64: string; mimeType: string } | null {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p: any) => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) return null;
  return { b64: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType || "image/png" };
}

function sha256Hex(buf: Buffer) {
  return createHash("sha256").update(buf).digest("hex");
}

async function downloadToBuffer(supabase: SupabaseClient, bucket: string, path: string): Promise<Buffer> {
  const dl = await supabase.storage.from(bucket).download(path);
  if (dl.error) throw new Error(dl.error.message);
  const ab = await dl.data.arrayBuffer();
  return Buffer.from(ab);
}

export async function getOrCreateGarmentCutout(args: {
  supabase: SupabaseClient;
  userId: string;
  kind: "front" | "back";
  image: File | Buffer;
}) {
  // Normalize first: stable hashing + Gemini input safety.
  const norm = Buffer.isBuffer(args.image) ? await normalizeBufferToJpeg(args.image) : await normalizeToJpeg(args.image);
  const hash = sha256Hex(norm.buffer);

  // Cache lookup
  const existing = await args.supabase
    .from("garment_cutouts")
    .select("storage_bucket,storage_path,mime_type")
    .eq("user_id", args.userId)
    .eq("source_hash", hash)
    .eq("source_kind", args.kind)
    .maybeSingle();

  if (existing.data?.storage_bucket && existing.data?.storage_path) {
    const buf = await downloadToBuffer(args.supabase, existing.data.storage_bucket, existing.data.storage_path);
    return {
      b64: buf.toString("base64"),
      mimeType: existing.data.mime_type || "image/png",
      sourceHash: hash,
      bucket: existing.data.storage_bucket,
      path: existing.data.storage_path,
      cached: true,
    };
  }

  // Cache miss: run extraction (transparent PNG)
  const prompt = `
You are an expert ecommerce photo editor.

TASK: Extract ONLY the garment from the input image and remove the background.

REQUIREMENTS:
- Output must be a PNG with a TRANSPARENT background.
- Keep the garment edges clean and sharp.
- Preserve the exact garment colors, prints, embroidery, logos, and texture.
- Do not add shadows, reflections, mannequins, hangers, hands, or extra objects.
- Do not change garment shape or proportions.

Return ONLY the final cutout image.
`.trim();

  const client = getGeminiClient();
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }, { inlineData: { data: norm.buffer.toString("base64"), mimeType: "image/jpeg" } }],
      },
    ],
    config: { responseModalities: ["IMAGE", "TEXT"], temperature: 0.1 },
  });

  const extracted = extractInlineImage(response);
  if (!extracted) throw new Error("No cutout returned from AI");

  const outBuffer = Buffer.from(extracted.b64, "base64");
  const bucket = "extractions";
  const path = `${args.userId}/garment_cutouts/${hash}_${args.kind}.png`;

  const up = await args.supabase.storage.from(bucket).upload(path, outBuffer, {
    contentType: extracted.mimeType || "image/png",
    upsert: true,
  });
  if (up.error) throw new Error(up.error.message);

  // Record in DB (best-effort; keep going if insert fails due to race)
  const ins = await args.supabase
    .from("garment_cutouts")
    .upsert(
      {
        user_id: args.userId,
        source_hash: hash,
        source_kind: args.kind,
        storage_bucket: bucket,
        storage_path: path,
        mime_type: extracted.mimeType || "image/png",
      },
      { onConflict: "user_id,source_hash,source_kind" }
    );
  if (ins.error) {
    // ignore
  }

  return {
    b64: extracted.b64,
    mimeType: extracted.mimeType || "image/png",
    sourceHash: hash,
    bucket,
    path,
    cached: false,
  };
}




