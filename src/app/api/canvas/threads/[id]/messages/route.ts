import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabaseAuthedClient } from "@/lib/supabase/auth";
import { editImageWithMask } from "@/lib/gemini";
import sharp from "sharp";

async function createAlphaPngFromMask(maskBuf: Buffer, width: number, height: number) {
  // Convert mask luminance into an alpha channel PNG where alpha=maskValue.
  // Assumes mask is "white=editable, black=protected".
  const alpha = await sharp(maskBuf).resize(width, height, { fit: "fill" }).removeAlpha().greyscale().raw().toBuffer();
  // Build an RGB image and append the mask as the 4th (alpha) channel.
  // NOTE: Do NOT start with RGBA, otherwise joinChannel would create a 5th channel.
  const alphaPng = await sharp({
    create: { width, height, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .joinChannel(alpha, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
  return alphaPng;
}

async function computeMaskBoundingBox(maskBuf: Buffer, width: number, height: number) {
  // Returns bounding box of the LARGEST connected painted region.
  // This avoids multiple-stroke masks confusing the model ("center of mask" drifting).
  const maxSide = 256;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const w2 = Math.max(1, Math.round(width * scale));
  const h2 = Math.max(1, Math.round(height * scale));

  const raw = await sharp(maskBuf).resize(w2, h2, { fit: "fill" }).removeAlpha().greyscale().raw().toBuffer();
  const visited = new Uint8Array(w2 * h2);

  const idx = (x: number, y: number) => y * w2 + x;
  const isOn = (i: number) => raw[i] > 8;

  let bestArea = 0;
  let best = { minX: w2, minY: h2, maxX: -1, maxY: -1 };

  const qx: number[] = [];
  const qy: number[] = [];

  for (let y = 0; y < h2; y++) {
    for (let x = 0; x < w2; x++) {
      const i = idx(x, y);
      if (visited[i] || !isOn(i)) continue;

      // BFS (4-neighborhood)
      visited[i] = 1;
      qx.length = 0;
      qy.length = 0;
      qx.push(x);
      qy.push(y);

      let area = 0;
      let minX = x, minY = y, maxX = x, maxY = y;

      while (qx.length) {
        const cx = qx.pop() as number;
        const cy = qy.pop() as number;
        area++;
        if (cx < minX) minX = cx;
        if (cy < minY) minY = cy;
        if (cx > maxX) maxX = cx;
        if (cy > maxY) maxY = cy;

        // neighbors
        if (cx > 0) {
          const ni = idx(cx - 1, cy);
          if (!visited[ni] && isOn(ni)) {
            visited[ni] = 1;
            qx.push(cx - 1);
            qy.push(cy);
          }
        }
        if (cx + 1 < w2) {
          const ni = idx(cx + 1, cy);
          if (!visited[ni] && isOn(ni)) {
            visited[ni] = 1;
            qx.push(cx + 1);
            qy.push(cy);
          }
        }
        if (cy > 0) {
          const ni = idx(cx, cy - 1);
          if (!visited[ni] && isOn(ni)) {
            visited[ni] = 1;
            qx.push(cx);
            qy.push(cy - 1);
          }
        }
        if (cy + 1 < h2) {
          const ni = idx(cx, cy + 1);
          if (!visited[ni] && isOn(ni)) {
            visited[ni] = 1;
            qx.push(cx);
            qy.push(cy + 1);
          }
        }
      }

      if (area > bestArea) {
        bestArea = area;
        best = { minX, minY, maxX, maxY };
      }
    }
  }

  if (bestArea <= 0 || best.maxX < 0 || best.maxY < 0) return null;

  // Map bbox back to base coordinates.
  const sx = width / w2;
  const sy = height / h2;
  const minX = Math.max(0, Math.floor(best.minX * sx));
  const minY = Math.max(0, Math.floor(best.minY * sy));
  const maxX = Math.min(width - 1, Math.ceil((best.maxX + 1) * sx) - 1);
  const maxY = Math.min(height - 1, Math.ceil((best.maxY + 1) * sy) - 1);
  return { minX, minY, maxX, maxY, debug: { downsampled: { w: w2, h: h2 }, bestArea } };
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
  const baseMimeType = (latestDownload as any)?.type || "image/png";

  const baseMeta = await sharp(latestBuf).metadata().catch(() => null);
  const baseW = Number(baseMeta?.width || 0);
  const baseH = Number(baseMeta?.height || 0);
  if (!baseW || !baseH) return NextResponse.json({ error: "Failed to read base image metadata" }, { status: 500 });

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
  let effectiveMaskBuf: Buffer | null = null;

  if (mask) {
    maskBucket = "outputs";
    maskPath = `${user.id}/canvas/${threadId}/assets/${assetId}/masks/${userMsg.id}.png`;
    const maskBuf = Buffer.from(await mask.arrayBuffer());
    const upMask = await supabase.storage.from(maskBucket).upload(maskPath, maskBuf, {
      contentType: "image/png",
      upsert: true,
    });
    if (upMask.error) return NextResponse.json({ error: upMask.error.message }, { status: 500 });

    // IMPORTANT: client always exports "white=editable". If invert=true, we invert server-side.
    effectiveMaskBuf = invert ? await sharp(maskBuf).negate().png().toBuffer() : maskBuf;
    maskB64 = effectiveMaskBuf.toString("base64");
    await supabase.from("canvas_messages").update({ mask_storage_bucket: maskBucket, mask_storage_path: maskPath }).eq("id", userMsg.id);
  }

  // Run provider edit (mask is optional).
  // If mask exists, crop to the mask region (plus margin) before calling the model.
  // This makes it much harder for the model to place the edit elsewhere (e.g. wrong cheek).
  let outBufRaw: Buffer;
  let cropRect: { left: number; top: number; width: number; height: number } | null = null;

  if (effectiveMaskBuf) {
    const bbox = await computeMaskBoundingBox(effectiveMaskBuf, baseW, baseH);
    if (!bbox) return NextResponse.json({ error: "Mask is empty. Brush a region to edit." }, { status: 400 });

    const margin = Math.max(24, Math.round(Math.max(baseW, baseH) * 0.03)); // ~3% of max side
    const left = Math.max(0, bbox.minX - margin);
    const top = Math.max(0, bbox.minY - margin);
    const right = Math.min(baseW - 1, bbox.maxX + margin);
    const bottom = Math.min(baseH - 1, bbox.maxY + margin);
    cropRect = { left, top, width: right - left + 1, height: bottom - top + 1 };
    console.info("[canvas_edit] mask_bbox", { baseW, baseH, bbox, cropRect });

    const baseCropPng = await sharp(latestBuf).extract(cropRect).png().toBuffer();
    const maskCropPng = await sharp(effectiveMaskBuf).resize(baseW, baseH, { fit: "fill" }).extract(cropRect).png().toBuffer();

    const edited = await editImageWithMask({
      baseImageB64: baseCropPng.toString("base64"),
      baseMimeType: "image/png",
      prompt: text,
      maskImageB64: maskCropPng.toString("base64"),
      maskMimeType: "image/png",
      invert: false,
      feather,
    });
    outBufRaw = Buffer.from(edited.b64, "base64");
  } else {
    const edited = await editImageWithMask({
      baseImageB64: latestB64,
      baseMimeType,
      prompt: text,
      maskImageB64: null,
      maskMimeType: undefined,
      invert: false,
      feather,
    });
    outBufRaw = Buffer.from(edited.b64, "base64");
  }

  // Enforce: same output dimensions + edit strictly limited to mask region.
  // This prevents size drift and protects unmasked pixels even if the model over-edits.
  const basePng = await sharp(latestBuf).ensureAlpha().png().toBuffer();
  const outResized = cropRect
    ? await sharp(outBufRaw).resize(cropRect.width, cropRect.height, { fit: "fill" }).ensureAlpha().png().toBuffer()
    : await sharp(outBufRaw).resize(baseW, baseH, { fit: "fill" }).ensureAlpha().png().toBuffer();
  const outBuf =
    effectiveMaskBuf
      ? await (async () => {
          const alphaFull = await createAlphaPngFromMask(effectiveMaskBuf as Buffer, baseW, baseH);
          if (!cropRect) {
            const editedRegion = await sharp(outResized).ensureAlpha().composite([{ input: alphaFull, blend: "dest-in" }]).png().toBuffer();
            return await sharp(basePng).ensureAlpha().composite([{ input: editedRegion, blend: "over" }]).png().toBuffer();
          }

          // Crop-aware: paste edited crop back into full frame, then apply full alpha mask.
          const blank = await sharp({
            create: { width: baseW, height: baseH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
          })
            .png()
            .toBuffer();
          const pasted = await sharp(blank)
            .composite([{ input: outResized, left: cropRect.left, top: cropRect.top }])
            .png()
            .toBuffer();
          const editedRegionFull = await sharp(pasted).ensureAlpha().composite([{ input: alphaFull, blend: "dest-in" }]).png().toBuffer();
          return await sharp(basePng).ensureAlpha().composite([{ input: editedRegionFull, blend: "over" }]).png().toBuffer();
        })()
      : outResized;

  const outBucket = "outputs";
  const outPath = `${user.id}/canvas/${threadId}/assets/${assetId}/versions/${userMsg.id}.png`;

  const upOut = await supabase.storage.from(outBucket).upload(outPath, outBuf, {
    contentType: "image/png",
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
    mime_type: "image/png",
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


