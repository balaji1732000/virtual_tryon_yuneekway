import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabaseAuthedClient } from "@/lib/supabase/auth";

function bucketForKind(kind: string) {
  if (kind === "extraction") return "extractions";
  if (kind === "video") return "videos";
  if (kind === "zip") return "zips";
  return "outputs";
}

function niceType(t?: string | null) {
  const type = (t || "").replaceAll("_", " ").trim();
  return type ? type.replace(/\b\w/g, (m) => m.toUpperCase()) : "Job";
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseAuthedClient(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const jobId = String(body?.jobId || "").trim();
  const outputId = String(body?.outputId || "").trim();

  if (!jobId || !outputId) {
    return NextResponse.json({ error: "Missing jobId/outputId" }, { status: 400 });
  }

  // Validate ownership via jobs table (job_outputs has no user_id)
  const { data: job, error: jobErr } = await supabase.from("jobs").select("id,user_id,type").eq("id", jobId).single();
  if (jobErr || !job || job.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: output, error: outErr } = await supabase
    .from("job_outputs")
    .select("id,job_id,kind,angle,mime_type,storage_path,created_at")
    .eq("id", outputId)
    .single();
  if (outErr || !output || output.job_id !== jobId) {
    return NextResponse.json({ error: "Output not found" }, { status: 404 });
  }

  if (!String(output.mime_type || "").startsWith("image/")) {
    return NextResponse.json({ error: "Only image outputs can be edited in canvas" }, { status: 400 });
  }

  const baseBucket = bucketForKind(output.kind);
  const basePath = output.storage_path as string;

  // Find or create one thread per job
  let threadId: string | null = null;
  const existingThread = await supabase
    .from("canvas_threads")
    .select("id")
    .eq("source_job_id", jobId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingThread.data?.id) {
    threadId = existingThread.data.id;
  } else {
    const newThreadId = randomUUID();
    const title = niceType(job.type);
    const ins = await supabase
      .from("canvas_threads")
      .insert({
        id: newThreadId as any,
        user_id: user.id,
        title,
        source_job_id: jobId as any,
        base_storage_bucket: baseBucket,
        base_storage_path: basePath,
      })
      .select("id")
      .single();
    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
    threadId = ins.data.id;
  }

  // Ensure every image output from this job becomes an asset in this thread (so a creation shows Front/Back/etc).
  const { data: jobOutputs, error: jobOutputsErr } = await supabase
    .from("job_outputs")
    .select("id,kind,angle,mime_type,storage_path,created_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });
  if (jobOutputsErr) return NextResponse.json({ error: jobOutputsErr.message }, { status: 500 });

  const { data: existingAssetsForJob } = await supabase
    .from("canvas_assets")
    .select("source_output_id")
    .eq("thread_id", threadId);
  const existingOutputIds = new Set((existingAssetsForJob || []).map((a: any) => a.source_output_id).filter(Boolean));

  for (const o of jobOutputs || []) {
    const mime = String(o.mime_type || "");
    if (!mime.startsWith("image/")) continue;
    if (existingOutputIds.has(o.id)) continue;

    const label = String(o.angle || o.kind || "image");
    const bkt = bucketForKind(String(o.kind || "image"));
    await supabase.from("canvas_assets").insert({
      thread_id: threadId as any,
      user_id: user.id,
      label,
      source_job_id: jobId as any,
      source_output_id: o.id as any,
      base_storage_bucket: bkt,
      base_storage_path: o.storage_path,
      current_storage_bucket: bkt,
      current_storage_path: o.storage_path,
    });
  }

  // Find or create asset for this output
  const existingAsset = await supabase
    .from("canvas_assets")
    .select("id")
    .eq("source_output_id", outputId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let assetId: string;
  if (existingAsset.data?.id) {
    assetId = existingAsset.data.id;
  } else {
    const label = String(output.angle || output.kind || "image");
    const ins = await supabase
      .from("canvas_assets")
      .insert({
        thread_id: threadId as any,
        user_id: user.id,
        label,
        source_job_id: jobId as any,
        source_output_id: outputId as any,
        base_storage_bucket: baseBucket,
        base_storage_path: basePath,
        current_storage_bucket: baseBucket,
        current_storage_path: basePath,
      })
      .select("id")
      .single();
    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
    assetId = ins.data.id;
  }

  // Pick latest conversation, else create first
  let conversationId: string;
  const conv = await supabase
    .from("canvas_conversations")
    .select("id")
    .eq("thread_id", threadId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (conv.data?.id) {
    conversationId = conv.data.id;
  } else {
    const ins = await supabase
      .from("canvas_conversations")
      .insert({ thread_id: threadId as any, user_id: user.id, title: "Chat 1" })
      .select("id")
      .single();
    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
    conversationId = ins.data.id;
  }

  return NextResponse.json({ threadId, assetId, conversationId });
}


