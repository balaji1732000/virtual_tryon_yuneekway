import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateModelWithDress, generateVirtualTryOn, RATIO_MAP } from "@/lib/gemini";

function firstInlineImage(response: any): { b64: string; mimeType: string } | null {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p: any) => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) return null;
  return { b64: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType || "image/png" };
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

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

      const modelBase64 = Buffer.from(await modelImage.arrayBuffer()).toString("base64");
      const dressBase64 = Buffer.from(await dressImage.arrayBuffer()).toString("base64");

      const response = await generateVirtualTryOn(modelBase64, dressBase64, additionalPrompt);
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

      await supabase.from("job_outputs").insert({
        job_id: jobId as any,
        kind: "image",
        mime_type: extracted.mimeType,
        storage_path: objectPath,
      });

      return NextResponse.json({
        jobId,
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
      const skinTone = (formData.get("skinTone") as string) || "";
      const region = (formData.get("region") as string) || "";
      const background = (formData.get("background") as string) || "";
      const gender = (formData.get("gender") as string) || "Female";
      const aspectRatio = (formData.get("aspectRatio") as string) || "1:1 (Square)";
      const additionalPrompt = (formData.get("additionalPrompt") as string) || "";

      if (!dressImage) return NextResponse.json({ error: "Missing dress image" }, { status: 400 });

      const dressBase64 = Buffer.from(await dressImage.arrayBuffer()).toString("base64");
      const referenceBase64 = referenceImage ? Buffer.from(await referenceImage.arrayBuffer()).toString("base64") : undefined;

      const response = await generateModelWithDress(
        dressBase64,
        angle,
        skinTone,
        region,
        background,
        referenceBase64,
        additionalPrompt,
        gender,
        aspectRatio
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
            input_json: { skinTone, region, background, gender, aspectRatio, additionalPrompt },
          },
          { onConflict: "id" }
        );

      await supabase.from("job_outputs").insert({
        job_id: jobId as any,
        kind: "image",
        angle,
        mime_type: extracted.mimeType,
        storage_path: objectPath,
        width: dims?.[0],
        height: dims?.[1],
      });

      return NextResponse.json({
        jobId,
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
