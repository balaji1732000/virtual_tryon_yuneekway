import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabaseAuthedClient } from "@/lib/supabase/auth";

// GET: list recent threads
export async function GET(req: NextRequest) {
  const { user, supabase } = await getSupabaseAuthedClient(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Pull a larger window and de-dupe by source_job_id so users see one Creation per job.
  const { data, error } = await supabase
    .from("canvas_threads")
    .select("id,title,base_storage_bucket,base_storage_path,created_at,updated_at,source_job_id")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const out: any[] = [];
  const seenJobs = new Set<string>();
  for (const t of data || []) {
    const sj = (t as any).source_job_id as string | null;
    if (sj) {
      if (seenJobs.has(sj)) continue;
      seenJobs.add(sj);
    }
    out.push(t);
    if (out.length >= 25) break;
  }
  return NextResponse.json({ threads: out });
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

  // Create first conversation + first asset so edits work immediately
  const { data: conv, error: convErr } = await supabase
    .from("canvas_conversations")
    .insert({ thread_id: threadId as any, user_id: user.id, title: "Chat 1" })
    .select("id")
    .single();
  if (convErr) return NextResponse.json({ error: convErr.message }, { status: 500 });

  const { data: asset, error: assetErr } = await supabase
    .from("canvas_assets")
    .insert({
      thread_id: threadId as any,
      user_id: user.id,
      label: title,
      base_storage_bucket: baseBucket,
      base_storage_path: basePath,
      current_storage_bucket: baseBucket,
      current_storage_path: basePath,
    })
    .select("id")
    .single();
  if (assetErr) return NextResponse.json({ error: assetErr.message }, { status: 500 });

  return NextResponse.json({ thread, conversationId: conv.id, assetId: asset.id });
}



