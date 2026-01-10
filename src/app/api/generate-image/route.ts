import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabaseAuthedClient } from "@/lib/supabase/auth";
import { generateModelWithDress, generateVirtualTryOn, RATIO_MAP } from "@/lib/gemini";
import { normalizeBufferToJpeg, normalizeToJpeg } from "@/lib/image-normalize";
import { getOrCreateGarmentCutout } from "@/lib/garment-cutout";

function firstInlineImage(response: any): { b64: string; mimeType: string } | null {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p: any) => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) return null;
  return { b64: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType || "image/png" };
}

type StorageRef = { bucket: string; path: string };

function isGeminiInvalidImageError(e: any) {
  const msg = String(e?.message || "");
  return msg.includes("Unable to process input image") || msg.includes("INVALID_ARGUMENT");
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!isGeminiInvalidImageError(e)) throw e;
    // one quick retry (Gemini preview endpoints can be flaky)
    await new Promise((r) => setTimeout(r, 600));
    return await fn();
  }
}

async function downloadRefToBuffer(supabase: any, ref: StorageRef): Promise<Buffer> {
  const dl = await supabase.storage.from(ref.bucket).download(ref.path);
  if (dl.error || !dl.data) throw new Error(dl.error?.message || "Failed to download input image");
  const ab = await dl.data.arrayBuffer();
  return Buffer.from(ab);
}

export async function POST(req: NextRequest) {
    try {
    const { user, supabase } = await getSupabaseAuthedClient(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const contentType = (req.headers.get("content-type") || "").toLowerCase();
    const isJson = contentType.includes("application/json");
    const body = isJson ? await req.json().catch(() => null) : null;
    const formData = isJson ? null : await req.formData();

    const getField = (key: string) => (isJson ? (body as any)?.[key] : (formData as any).get(key));

    const type = String(getField("type") || ""); // 'pack' | 'tryon'
    const requestedJobId = (getField("jobId") as string) || null;
    const jobId = requestedJobId || randomUUID();

    if (type === "tryon") {
      const additionalPrompt = (getField("additionalPrompt") as string) || "";
      const modelRef = (isJson ? (body as any)?.modelRef : null) as StorageRef | null;
      const dressRef = (isJson ? (body as any)?.dressRef : null) as StorageRef | null;
      const modelImage = isJson ? null : ((formData as any).get("modelImage") as File | null);
      const dressImage = isJson ? null : ((formData as any).get("dressImage") as File | null);

      if ((!modelImage && !modelRef) || (!dressImage && !dressRef)) {
        return NextResponse.json({ error: "Missing images" }, { status: 400 });
      }

      let modelNorm: Awaited<ReturnType<typeof normalizeBufferToJpeg>>;
      let dressNorm: Awaited<ReturnType<typeof normalizeBufferToJpeg>>;
      try {
        const modelBuf = modelImage ? Buffer.from(await modelImage.arrayBuffer()) : await downloadRefToBuffer(supabase, modelRef as any);
        const dressBuf = dressImage ? Buffer.from(await dressImage.arrayBuffer()) : await downloadRefToBuffer(supabase, dressRef as any);
        modelNorm = await normalizeBufferToJpeg(modelBuf);
        dressNorm = await normalizeBufferToJpeg(dressBuf);
      } catch (e: any) {
        return NextResponse.json({ error: e?.message || "Unable to process input image" }, { status: 400 });
      }
      const modelBase64 = modelNorm.buffer.toString("base64");
      const dressBase64 = dressNorm.buffer.toString("base64");

      const response = await withRetry(() => generateVirtualTryOn(modelBase64, dressBase64, additionalPrompt));
      const extracted = firstInlineImage(response);
      if (!extracted) return NextResponse.json({ error: "No image generated" }, { status: 500 });

      const outBuffer = Buffer.from(extracted.b64, "base64");
      const objectPath = `${user.id}/${jobId}/tryon_${randomUUID()}.png`;

      const upload = await supabase.storage.from("outputs").upload(objectPath, outBuffer, {
        contentType: extracted.mimeType,
        upsert: true,
      });
      if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 500 });

      const signed = await supabase.storage.from("outputs").createSignedUrl(objectPath, 60 * 60);
      if (signed.error) return NextResponse.json({ error: signed.error.message }, { status: 500 });

      // Best-effort job tracking
      await supabase
        .from("jobs")
        .upsert(
          {
            id: jobId as any,
            user_id: user.id,
            type: "tryon_image",
            status: "done",
            input_json: { additionalPrompt },
          },
          { onConflict: "id" }
        );

      const { data: jobOut, error: jobOutErr } = await supabase
        .from("job_outputs")
        .insert({
        job_id: jobId as any,
        kind: "image",
        mime_type: extracted.mimeType,
        storage_path: objectPath,
        })
        .select("id")
        .single();
      if (jobOutErr) return NextResponse.json({ error: jobOutErr.message }, { status: 500 });

            return NextResponse.json({
        jobId,
        outputId: jobOut?.id || null,
        storagePath: objectPath,
        signedUrl: signed.data.signedUrl,
        image: extracted.b64, // backward-compatible
        mimeType: extracted.mimeType,
        text: response.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text,
            });
        }

    if (type === "pack") {
      const angle = String(getField("angle") || "");
      const productId = String(getField("productId") || "");
      const productTitle = String(getField("productTitle") || "");
      const useCutout = String(getField("useCutout") || "").toLowerCase() === "true";
      const skinTone = String(getField("skinTone") || "");
      const region = String(getField("region") || "");
      const background = String(getField("background") || "");
      const gender = String(getField("gender") || "Female");
      const aspectRatio = String(getField("aspectRatio") || "1:1 (Square)");
      const additionalPrompt = String(getField("additionalPrompt") || "");

      const dressRef = (isJson ? (body as any)?.dressRef : null) as StorageRef | null;
      const referenceRef = (isJson ? (body as any)?.referenceRef : null) as StorageRef | null;
      const dressImage = isJson ? null : ((formData as any).get("dressImage") as File | null);
      const referenceImage = isJson ? null : ((formData as any).get("referenceImage") as File | null);

      if (!dressImage && !dressRef) return NextResponse.json({ error: "Missing dress image" }, { status: 400 });

      let referenceBase64: string | undefined;
      let referenceNorm: Awaited<ReturnType<typeof normalizeToJpeg>> | null = null;
      try {
        if (referenceImage) {
          referenceNorm = await normalizeToJpeg(referenceImage);
          referenceBase64 = referenceNorm.buffer.toString("base64");
        } else if (referenceRef) {
          const refBuf = await downloadRefToBuffer(supabase, referenceRef);
          const refNorm = await normalizeBufferToJpeg(refBuf);
          referenceBase64 = refNorm.buffer.toString("base64");
        }
      } catch (e: any) {
        const msg = String(e?.message || "");
        if (msg.toLowerCase().includes("unsupported image format")) {
          return NextResponse.json(
            {
              error:
                "Reference image is not a valid image (often caused by an expired profile image link). Please click Refresh and reselect your model profile, then retry.",
            },
            { status: 400 }
          );
        }
        return NextResponse.json({ error: msg || "Unable to process input image" }, { status: 400 });
      }

      const garmentView = angle.toLowerCase().includes("back") ? ("back" as const) : ("front" as const);
      let dressBase64: string;
      let dressMimeType: string;
      let cutoutMeta: { bucket: string; path: string; hash: string } | null = null;

      try {
        const dressBuf = dressImage ? Buffer.from(await dressImage.arrayBuffer()) : await downloadRefToBuffer(supabase, dressRef as any);
        if (useCutout) {
          const cut = await getOrCreateGarmentCutout({ supabase, userId: user.id, kind: garmentView, image: dressBuf });
          dressBase64 = cut.b64;
          dressMimeType = cut.mimeType;
          cutoutMeta = { bucket: cut.bucket, path: cut.path, hash: cut.sourceHash };
        } else {
          const dressNorm = await normalizeBufferToJpeg(dressBuf);
          dressBase64 = dressNorm.buffer.toString("base64");
          dressMimeType = "image/jpeg";
        }
      } catch (e: any) {
        return NextResponse.json({ error: e?.message || "Failed to create garment cutout" }, { status: 400 });
      }

      const response = await withRetry(() =>
        generateModelWithDress(dressBase64, angle, skinTone, region, background, referenceBase64, additionalPrompt, gender, aspectRatio, {
          garmentMimeType: dressMimeType,
          referenceMimeType: "image/jpeg",
          garmentView,
        })
      );

      const extracted = firstInlineImage(response);
      if (!extracted) return NextResponse.json({ error: "No image generated" }, { status: 500 });

      const outBuffer = Buffer.from(extracted.b64, "base64");
      const safeAngle = angle.toLowerCase().replaceAll(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      const objectPath = `${user.id}/${jobId}/pack_${safeAngle || "angle"}_${randomUUID()}.png`;

      const upload = await supabase.storage.from("outputs").upload(objectPath, outBuffer, {
        contentType: extracted.mimeType,
        upsert: true,
      });
      if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 500 });

      const signed = await supabase.storage.from("outputs").createSignedUrl(objectPath, 60 * 60);
      if (signed.error) return NextResponse.json({ error: signed.error.message }, { status: 500 });

      const dims = RATIO_MAP[aspectRatio];

      await supabase
        .from("jobs")
        .upsert(
          {
            id: jobId as any,
            user_id: user.id,
            type: "product_pack",
            status: "running",
            input_json: {
              productId,
              productTitle,
                skinTone,
                region,
                background,
              gender,
              aspectRatio,
                additionalPrompt,
              useCutout,
              ...(cutoutMeta ? { [`cutout_${garmentView}`]: cutoutMeta } : {}),
            },
          },
          { onConflict: "id" }
            );

      const { data: jobOut, error: jobOutErr } = await supabase
        .from("job_outputs")
        .insert({
        job_id: jobId as any,
        kind: "image",
        angle,
        mime_type: extracted.mimeType,
        storage_path: objectPath,
        width: dims?.[0],
        height: dims?.[1],
        })
        .select("id")
        .single();
      if (jobOutErr) return NextResponse.json({ error: jobOutErr.message }, { status: 500 });

            return NextResponse.json({
        jobId,
        outputId: jobOut?.id || null,
        storagePath: objectPath,
        signedUrl: signed.data.signedUrl,
        image: extracted.b64, // backward-compatible
        mimeType: extracted.mimeType,
        text: response.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text,
            });
        }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    } catch (error: any) {
    console.error("Generation error:", error);
    let msg = error?.message || "Unknown error";
    try {
      if (typeof msg === "string" && msg.trim().startsWith("{")) {
        const parsed = JSON.parse(msg);
        const inner = parsed?.error?.message;
        if (inner) msg = String(inner);
      }
    } catch {
      // ignore parse failures
    }

    if (msg.includes("Unable to process input image")) {
      msg =
        "Unable to process input image. Please try a smaller JPG/PNG (avoid HEIC) and retry. If this persists, try re-exporting the image as a standard sRGB JPG.";
    }

    const status = msg.includes("Unable to process input image") || msg.includes("INVALID_ARGUMENT") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
    }
}
