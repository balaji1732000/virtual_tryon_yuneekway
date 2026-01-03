import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAuthedClient } from "@/lib/supabase/auth";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, supabase } = await getSupabaseAuthedClient(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  const { data: thread, error: threadError } = await supabase
    .from("canvas_threads")
    .select("id,title,base_storage_bucket,base_storage_path,created_at,updated_at")
    .eq("id", id)
    .single();

  if (threadError) return NextResponse.json({ error: threadError.message }, { status: 500 });

  const { data: messages, error: msgError } = await supabase
    .from("canvas_messages")
    .select("id,role,text,mask_storage_bucket,mask_storage_path,output_storage_bucket,output_storage_path,created_at")
    .eq("thread_id", id)
    .order("created_at", { ascending: true });

  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 });

  // Signed URLs (best-effort)
  const baseSigned = await supabase.storage
    .from(thread.base_storage_bucket)
    .createSignedUrl(thread.base_storage_path, 60 * 60 * 24);

  const signedMessages = await Promise.all(
    (messages || []).map(async (m: any) => {
      const maskUrl =
        m.mask_storage_bucket && m.mask_storage_path
          ? (await supabase.storage.from(m.mask_storage_bucket).createSignedUrl(m.mask_storage_path, 60 * 60 * 24)).data
              ?.signedUrl || null
          : null;
      const outputUrl =
        m.output_storage_bucket && m.output_storage_path
          ? (await supabase.storage.from(m.output_storage_bucket).createSignedUrl(m.output_storage_path, 60 * 60 * 24)).data
              ?.signedUrl || null
          : null;
      return { ...m, maskUrl, outputUrl };
    })
  );

  return NextResponse.json({
    thread: { ...thread, baseUrl: baseSigned.data?.signedUrl || null },
    messages: signedMessages,
  });
}



