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

  if (!text) return NextResponse.json({ error: "Missing text" }, { status: 400 });

  // Determine latest image to use as context: last assistant output, else thread base
  const { data: lastMsg } = await supabase
    .from("canvas_messages")
    .select("output_storage_bucket,output_storage_path")
    .eq("thread_id", threadId)
    .eq("role", "assistant")
    .not("output_storage_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestBucket = lastMsg?.output_storage_bucket || thread.base_storage_bucket;
  const latestPath = lastMsg?.output_storage_path || thread.base_storage_path;

  const { data: latestDownload, error: dlErr } = await supabase.storage.from(latestBucket).download(latestPath);
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
    })
    .select("id")
    .single();

  if (userMsgErr) return NextResponse.json({ error: userMsgErr.message }, { status: 500 });

  let maskBucket: string | null = null;
  let maskPath: string | null = null;
  let maskB64: string | null = null;

  if (mask) {
    maskBucket = "outputs";
    maskPath = `${user.id}/canvas/${threadId}/masks/${userMsg.id}.png`;
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
  const outPath = `${user.id}/canvas/${threadId}/versions/${userMsg.id}.png`;

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
      input_json: { threadId, prompt: text, invert, feather, hasMask: !!maskB64, source: { bucket: latestBucket, path: latestPath } },
    })
    .select("id")
    .single();

  await supabase.from("job_outputs").insert({
    job_id: jobId as any,
    kind: "image",
    mime_type: extracted.mimeType,
    storage_path: outPath,
  });

  // Insert assistant message pointing to output
  await supabase.from("canvas_messages").insert({
    thread_id: threadId,
    user_id: user.id,
    role: "assistant",
    text: "Done.",
    output_job_id: jobId as any,
    output_storage_bucket: outBucket,
    output_storage_path: outPath,
  });

  // Touch thread updated_at
  await supabase.from("canvas_threads").update({ title: thread.title || "Untitled" }).eq("id", threadId);

  const signed = await supabase.storage.from(outBucket).createSignedUrl(outPath, 60 * 60 * 24);
  return NextResponse.json({
    jobId,
    output: { bucket: outBucket, path: outPath, signedUrl: signed.data?.signedUrl || null },
    mask: maskPath ? { bucket: maskBucket, path: maskPath } : null,
  });
}


