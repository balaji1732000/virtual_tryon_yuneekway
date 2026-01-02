import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGeminiClient } from "@/lib/gemini";

function extractInlineImage(response: any): { b64: string; mimeType: string } | null {
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
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const image = formData.get("image") as File | null;
    if (!image) return NextResponse.json({ error: "Missing image" }, { status: 400 });

    const imageB64 = Buffer.from(await image.arrayBuffer()).toString("base64");

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
`;

    const client = getGeminiClient();
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { data: imageB64, mimeType: image.type || "image/jpeg" } },
          ],
        },
      ],
      config: { responseModalities: ["IMAGE", "TEXT"], temperature: 0.1 },
    });

    const extracted = extractInlineImage(response);
    if (!extracted) return NextResponse.json({ error: "No image returned" }, { status: 500 });

    // NOTE: GenAI inlineData.data is base64 (no data: prefix)
    const outBuffer = Buffer.from(extracted.b64, "base64");
    const ext = extracted.mimeType.includes("png") ? "png" : "png";

    const objectPath = `${user.id}/${randomUUID()}.${ext}`;
    const upload = await supabase.storage.from("extractions").upload(objectPath, outBuffer, {
      contentType: extracted.mimeType,
      upsert: true,
    });

    if (upload.error) {
      return NextResponse.json({ error: upload.error.message }, { status: 500 });
    }

    const signed = await supabase.storage.from("extractions").createSignedUrl(objectPath, 60 * 60);
    if (signed.error) {
      return NextResponse.json({ error: signed.error.message }, { status: 500 });
    }

    // Persist job + output metadata (best-effort)
    try {
      const { data: job } = await supabase
        .from("jobs")
        .insert({
          user_id: user.id,
          type: "extract_garment",
          status: "done",
          input_json: { original_mime: image.type, original_name: image.name },
        })
        .select("id")
        .single();

      if (job?.id) {
        await supabase.from("job_outputs").insert({
          job_id: job.id,
          kind: "extraction",
          mime_type: extracted.mimeType,
          storage_path: objectPath,
        });
      }
    } catch {
      // ignore
    }

    return NextResponse.json({
      storagePath: objectPath,
      mimeType: extracted.mimeType,
      signedUrl: signed.data.signedUrl,
    });
  } catch (error: any) {
    console.error("extract-garment error:", error);
    return NextResponse.json({ error: error?.message || "Unknown error" }, { status: 500 });
  }
}


