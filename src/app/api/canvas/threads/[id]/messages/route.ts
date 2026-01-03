import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabaseAuthedClient } from "@/lib/supabase/auth";
import { editImageWithMask } from "@/lib/gemini";

function extractInlineImage(response: any): { b64: string; mimeType: string } | null {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p: any) => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) return null;
  return { b64: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType || "image/png" };
}

async function bytesToBase64(file: File) {
  return Buffer.from(await file.arrayBuffer()).toString("base64");
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, supabase } = await getSupabaseAuthedClient(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: threadId } = await ctx.params;

  const { data: thread, error: threadError } = await supabase
    .from("canvas_threads")
    .select("id,title,base_storage_bucket,base_storage_path")
    .eq("id", threadId)
    .single();

  if (threadError) return NextResponse.json({ error: threadError.message }, { status: 500 });

  const formData = await req.formData();
  const text = String(formData.get("text") || "").trim();
  const mask = formData.get("mask") as File | null;
  const invert = String(formData.get("invert") || "false") === "true";
  const feather = Number(formData.get("feather") || 0);
  const conversationId = String(formData.get("conversationId") || "").trim() || null;
  const assetId = String(formData.get("assetId") || "").trim() || null;
  const baseOverrideBucket = String(formData.get("baseOverrideBucket") || "").trim() || null;
  const baseOverridePath = String(formData.get("baseOverridePath") || "").trim() || null;

  if (!text) return NextResponse.json({ error: "Missing text" }, { status: 400 });
  if (!conversationId || !assetId) return NextResponse.json({ error: "Missing conversationId/assetId" }, { status: 400 });

  // Validate conversation + asset belong to thread
  const { data: conv, error: convErr } = await supabase
    .from("canvas_conversations")
    .select("id,thread_id")
    .eq("id", conversationId)
    .single();
  if (convErr || !conv || conv.thread_id !== threadId) return NextResponse.json({ error: "Invalid conversation" }, { status: 400 });

  const { data: asset, error: assetErr } = await supabase
    .from("canvas_assets")
    .select("id,thread_id,current_storage_bucket,current_storage_path,base_storage_bucket,base_storage_path")
    .eq("id", assetId)
    .single();
  if (assetErr || !asset || asset.thread_id !== threadId) return NextResponse.json({ error: "Invalid asset" }, { status: 400 });

  // Optional override: allow editing a previous version (must belong to this asset)
  let overrideBucket: string | null = null;
  let overridePath: string | null = null;
  if (baseOverrideBucket && baseOverridePath) {
    const okDirect =
      (baseOverrideBucket === asset.current_storage_bucket && baseOverridePath === asset.current_storage_path) ||
      (baseOverrideBucket === asset.base_storage_bucket && baseOverridePath === asset.base_storage_path);
    if (okDirect) {
      overrideBucket = baseOverrideBucket;
      overridePath = baseOverridePath;
    } else {
      const { data: existing } = await supabase
        .from("canvas_messages")
        .select("id")
        .eq("thread_id", threadId)
        .eq("asset_id", assetId)
        .eq("output_storage_bucket", baseOverrideBucket)
        .eq("output_storage_path", baseOverridePath)
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        overrideBucket = baseOverrideBucket;
        overridePath = baseOverridePath;
      }
    }
  }

  // Determine latest image to use as context:
  // - base override (if provided & valid)
  // - last assistant output for this asset+conversation
  // - else asset current, else thread base
  const { data: lastMsg } = await supabase
    .from("canvas_messages")
    .select("output_storage_bucket,output_storage_path")
    .eq("thread_id", threadId)
    .eq("role", "assistant")
    .eq("conversation_id", conversationId)
    .eq("asset_id", assetId)
    .not("output_storage_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestBucket =
    overrideBucket || lastMsg?.output_storage_bucket || asset.current_storage_bucket || asset.base_storage_bucket || thread.base_storage_bucket;
  const latestPath = lastMsg?.output_storage_path || asset.current_storage_path || asset.base_storage_path || thread.base_storage_path;
  const latestPathFinal = overridePath || latestPath;

  const { data: latestDownload, error: dlErr } = await supabase.storage.from(latestBucket).download(latestPathFinal);
  if (dlErr || !latestDownload) return NextResponse.json({ error: dlErr?.message || "Failed to read base image" }, { status: 500 });
  const latestBuf = Buffer.from(await latestDownload.arrayBuffer());
  const latestB64 = latestBuf.toString("base64");

  // Insert user message first (we'll update with mask path if present)
  const { data: userMsg, error: userMsgErr } = await supabase
    .from("canvas_messages")
    .insert({
      thread_id: threadId,
      user_id: user.id,
      role: "user",
      text,
      conversation_id: conversationId as any,
      asset_id: assetId as any,
    })
    .select("id")
    .single();

  if (userMsgErr) return NextResponse.json({ error: userMsgErr.message }, { status: 500 });

  let maskBucket: string | null = null;
  let maskPath: string | null = null;
  let maskB64: string | null = null;

  if (mask) {
    maskBucket = "outputs";
    maskPath = `${user.id}/canvas/${threadId}/assets/${assetId}/masks/${userMsg.id}.png`;
    const maskBuf = Buffer.from(await mask.arrayBuffer());
    const upMask = await supabase.storage.from(maskBucket).upload(maskPath, maskBuf, {
      contentType: "image/png",
      upsert: true,
    });
    if (upMask.error) return NextResponse.json({ error: upMask.error.message }, { status: 500 });

    maskB64 = maskBuf.toString("base64");
    await supabase.from("canvas_messages").update({ mask_storage_bucket: maskBucket, mask_storage_path: maskPath }).eq("id", userMsg.id);
  }

  // Run provider edit (mask is optional)
  const response = await editImageWithMask({
    baseImageB64: latestB64,
    baseMimeType: "image/png", // we treat it as png for preview model
    prompt: text,
    maskImageB64: maskB64,
    maskMimeType: maskB64 ? "image/png" : undefined,
    invert,
    feather,
  });

  const extracted = extractInlineImage(response);
  if (!extracted) return NextResponse.json({ error: "No image generated" }, { status: 500 });

  const outBuf = Buffer.from(extracted.b64, "base64");
  const outBucket = "outputs";
  const outPath = `${user.id}/canvas/${threadId}/assets/${assetId}/versions/${userMsg.id}.png`;

  const upOut = await supabase.storage.from(outBucket).upload(outPath, outBuf, {
    contentType: extracted.mimeType,
    upsert: true,
  });
  if (upOut.error) return NextResponse.json({ error: upOut.error.message }, { status: 500 });

  // Write job + output (for /app/history)
  const jobId = randomUUID();
  await supabase
    .from("jobs")
    .insert({
      id: jobId as any,
      user_id: user.id,
      type: "canvas_edit",
      status: "done",
      input_json: { threadId, prompt: text, invert, feather, hasMask: !!maskB64, source: { bucket: latestBucket, path: latestPathFinal } },
    })
    .select("id")
    .single();

  await supabase.from("job_outputs").insert({
    job_id: jobId as any,
    kind: "image",
    mime_type: extracted.mimeType,
    storage_path: outPath,
  });

  // Update asset current pointer
  await supabase
    .from("canvas_assets")
    .update({ current_storage_bucket: outBucket, current_storage_path: outPath })
    .eq("id", assetId);

  // Insert assistant message pointing to output
  await supabase.from("canvas_messages").insert({
    thread_id: threadId,
    user_id: user.id,
    role: "assistant",
    text: "Done.",
    output_job_id: jobId as any,
    output_storage_bucket: outBucket,
    output_storage_path: outPath,
    conversation_id: conversationId as any,
    asset_id: assetId as any,
  });

  // Touch thread updated_at
  await supabase.from("canvas_threads").update({ title: thread.title || "Untitled" }).eq("id", threadId);

  const signed = await supabase.storage.from(outBucket).createSignedUrl(outPath, 60 * 60 * 24);
  return NextResponse.json({
    jobId,
    conversationId,
    assetId,
    output: { bucket: outBucket, path: outPath, signedUrl: signed.data?.signedUrl || null },
    mask: maskPath ? { bucket: maskBucket, path: maskPath } : null,
  });
}


