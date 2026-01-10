import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabaseAuthedClient } from "@/lib/supabase/auth";

export async function GET(req: NextRequest) {
  const { user, supabase } = await getSupabaseAuthedClient(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("profiles")
    .select("id,name,gender,skin_tone,region,background,reference_image_path,created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const profiles = await Promise.all(
    (data || []).map(async (p: any) => {
      let referenceImageUrl: string | null = null;
      if (p.reference_image_path) {
        // Longer-lived signed URL for display; generation should use the path (not the URL).
        const signed = await supabase.storage.from("profiles").createSignedUrl(p.reference_image_path, 60 * 60 * 24);
        if (!signed.error) referenceImageUrl = signed.data.signedUrl;
      }
      return {
        id: p.id,
        name: p.name,
        gender: p.gender,
        skinTone: p.skin_tone,
        region: p.region,
        background: p.background,
        referenceImageUrl,
        referenceImagePath: p.reference_image_path,
        createdAt: p.created_at,
      };
    })
  );

  return NextResponse.json({ profiles });
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseAuthedClient(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const name = String(formData.get("name") || "").trim();
  const gender = String(formData.get("gender") || "").trim();
  const skinTone = String(formData.get("skinTone") || "").trim();
  const region = String(formData.get("region") || "").trim();
  const background = String(formData.get("background") || "").trim();
  const referenceImage = formData.get("referenceImage") as File | null;

  if (!name || !gender || !skinTone || !region || !background) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (!referenceImage) return NextResponse.json({ error: "Missing referenceImage" }, { status: 400 });

  const bytes = Buffer.from(await referenceImage.arrayBuffer());
  const ext = referenceImage.type.includes("png") ? "png" : "jpg";
  const objectPath = `${user.id}/${randomUUID()}.${ext}`;

  const upload = await supabase.storage.from("profiles").upload(objectPath, bytes, {
    contentType: referenceImage.type || "image/jpeg",
    upsert: true,
  });
  if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 500 });

  const { data: row, error: insertError } = await supabase
    .from("profiles")
    .insert({
      user_id: user.id,
      name,
      gender,
      skin_tone: skinTone,
      region,
      background,
      reference_image_path: objectPath,
    })
    .select("id,name,gender,skin_tone,region,background,reference_image_path,created_at")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const signed = await supabase.storage.from("profiles").createSignedUrl(objectPath, 60 * 60 * 24);

  return NextResponse.json({
    profile: {
      id: row.id,
      name: row.name,
      gender: row.gender,
      skinTone: row.skin_tone,
      region: row.region,
      background: row.background,
      referenceImageUrl: signed.data?.signedUrl || null,
      referenceImagePath: row.reference_image_path,
      createdAt: row.created_at,
    },
  });
}



