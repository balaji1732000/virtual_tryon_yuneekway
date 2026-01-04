import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabaseAuthedClient } from "@/lib/supabase/auth";
import { generateModelWithDress, generateVirtualTryOn, RATIO_MAP } from "@/lib/gemini";
import { normalizeToJpeg } from "@/lib/image-normalize";
import { getOrCreateGarmentCutout } from "@/lib/garment-cutout";

function firstInlineImage(response: any): { b64: string; mimeType: string } | null {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p: any) => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) return null;
  return { b64: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType || "image/png" };
}

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

export async function POST(req: NextRequest) {
    try {
    const { user, supabase } = await getSupabaseAuthedClient(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const formData = await req.formData();
    const type = (formData.get("type") as string) || ""; // 'pack' | 'tryon'
    const requestedJobId = (formData.get("jobId") as string) || null;
    const jobId = requestedJobId || randomUUID();

    if (type === "tryon") {
      const modelImage = formData.get("modelImage") as File | null;
      const dressImage = formData.get("dressImage") as File | null;
      const additionalPrompt = (formData.get("additionalPrompt") as string) || "";

            if (!modelImage || !dressImage) {
        return NextResponse.json({ error: "Missing images" }, { status: 400 });
            }

      let modelNorm: Awaited<ReturnType<typeof normalizeToJpeg>>;
      let dressNorm: Awaited<ReturnType<typeof normalizeToJpeg>>;
      try {
        modelNorm = await normalizeToJpeg(modelImage);
        dressNorm = await normalizeToJpeg(dressImage);
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
      const dressImage = formData.get("dressImage") as File | null;
      const referenceImage = formData.get("referenceImage") as File | null;
      const angle = (formData.get("angle") as string) || "";
      const productId = (formData.get("productId") as string) || "";
      const productTitle = (formData.get("productTitle") as string) || "";
      const useCutout = String(formData.get("useCutout") || "").toLowerCase() === "true";
      const skinTone = (formData.get("skinTone") as string) || "";
      const region = (formData.get("region") as string) || "";
      const background = (formData.get("background") as string) || "";
      const gender = (formData.get("gender") as string) || "Female";
      const aspectRatio = (formData.get("aspectRatio") as string) || "1:1 (Square)";
      const additionalPrompt = (formData.get("additionalPrompt") as string) || "";

      if (!dressImage) return NextResponse.json({ error: "Missing dress image" }, { status: 400 });

      let referenceBase64: string | undefined;
      let referenceNorm: Awaited<ReturnType<typeof normalizeToJpeg>> | null = null;
      try {
        referenceNorm = referenceImage ? await normalizeToJpeg(referenceImage) : null;
        referenceBase64 = referenceNorm ? referenceNorm.buffer.toString("base64") : undefined;
      } catch (e: any) {
        return NextResponse.json({ error: e?.message || "Unable to process input image" }, { status: 400 });
      }

      const garmentView = angle.toLowerCase().includes("back") ? ("back" as const) : ("front" as const);
      let dressBase64: string;
      let dressMimeType: string;
      let cutoutMeta: { bucket: string; path: string; hash: string } | null = null;

      try {
        if (useCutout) {
          const cut = await getOrCreateGarmentCutout({ supabase, userId: user.id, kind: garmentView, image: dressImage });
          dressBase64 = cut.b64;
          dressMimeType = cut.mimeType;
          cutoutMeta = { bucket: cut.bucket, path: cut.path, hash: cut.sourceHash };
        } else {
          const dressNorm = await normalizeToJpeg(dressImage);
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
