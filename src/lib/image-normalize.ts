import sharp from "sharp";

export type NormalizedImage = {
  buffer: Buffer;
  mimeType: "image/jpeg";
  width?: number;
  height?: number;
};

function extFromName(name: string) {
  const lower = name.toLowerCase();
  const idx = lower.lastIndexOf(".");
  return idx >= 0 ? lower.slice(idx + 1) : "";
}

export async function normalizeBufferToJpeg(
  input: Buffer,
  opts?: { maxSide?: number; quality?: number }
): Promise<NormalizedImage> {
  // Gemini image endpoints can be picky; keep uploads reasonably small.
  const maxSide = opts?.maxSide ?? 1024;
  const quality = opts?.quality ?? 82;

  try {
    const base = sharp(input, { failOnError: false }).rotate();
    const meta = await base.metadata();

    // Try progressively smaller outputs until under a safe size.
    const attempts: Array<{ side: number; q: number }> = [
      { side: maxSide, q: quality },
      { side: Math.min(maxSide, 960), q: Math.min(quality, 78) },
      { side: Math.min(maxSide, 896), q: Math.min(quality, 74) },
      { side: Math.min(maxSide, 768), q: Math.min(quality, 70) },
      { side: Math.min(maxSide, 640), q: Math.min(quality, 62) },
    ];

    const maxBytes = 3_500_000; // ~3.5MB safety
    let last: Buffer | null = null;

    for (const a of attempts) {
      const out = await sharp(input, { failOnError: false })
        .rotate()
        .toColorspace("srgb")
        .resize({ width: a.side, height: a.side, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: a.q, mozjpeg: true })
        .toBuffer();
      last = out;
      if (out.length <= maxBytes) {
        return { buffer: out, mimeType: "image/jpeg", width: meta.width, height: meta.height };
      }
    }

    if (last) return { buffer: last, mimeType: "image/jpeg", width: meta.width, height: meta.height };
    throw new Error("Unable to process input image");
  } catch (e: any) {
    throw new Error(e?.message || "Unable to process input image");
  }
}

export async function normalizeToJpeg(file: File, opts?: { maxSide?: number; quality?: number }): Promise<NormalizedImage> {
  const input = Buffer.from(await file.arrayBuffer());
  try {
    return await normalizeBufferToJpeg(input, opts);
  } catch (e: any) {
    const ext = extFromName(file.name || "");
    const type = (file.type || "").toLowerCase();
    // Common case: HEIC/HEIF from iPhone uploads (often unsupported by server runtimes)
    if (type.includes("heic") || type.includes("heif") || ext === "heic" || ext === "heif") {
      throw new Error("Unsupported image format (HEIC). Please convert to JPG/PNG and retry.");
    }
    throw new Error(e?.message || "Unable to process input image");
  }
}


