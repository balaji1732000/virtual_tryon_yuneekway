import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabaseAuthedClient } from "@/lib/supabase/auth";

// GET: list recent threads
export async function GET(req: NextRequest) {
  const { user, supabase } = await getSupabaseAuthedClient(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("canvas_threads")
    .select("id,title,base_storage_bucket,base_storage_path,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(25);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ threads: data || [] });
}

// POST: create thread from uploaded image (MVP) OR from existing storage path (optional)
export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseAuthedClient(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const title = String(formData.get("title") || "Untitled").trim() || "Untitled";

  const fromBucket = formData.get("fromBucket") as string | null;
  const fromPath = formData.get("fromPath") as string | null;

  const upload = formData.get("image") as File | null;

  let baseBucket = "outputs";
  let basePath = "";
  const threadId = randomUUID();

  if (upload) {
    const buf = Buffer.from(await upload.arrayBuffer());
    const ext = upload.type.includes("png") ? "png" : "jpg";
    basePath = `${user.id}/canvas/${threadId}/base.${ext}`;
    const up = await supabase.storage.from(baseBucket).upload(basePath, buf, {
      contentType: upload.type || "image/jpeg",
      upsert: true,
    });
    if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });
  } else if (fromBucket && fromPath) {
    baseBucket = fromBucket;
    basePath = fromPath;
  } else {
    return NextResponse.json({ error: "Provide image upload or fromBucket/fromPath" }, { status: 400 });
  }

  const { data: thread, error } = await supabase
    .from("canvas_threads")
    .insert({
      id: threadId as any,
      user_id: user.id,
      title,
      base_storage_bucket: baseBucket,
      base_storage_path: basePath,
    })
    .select("id,title,base_storage_bucket,base_storage_path,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ thread });
}



