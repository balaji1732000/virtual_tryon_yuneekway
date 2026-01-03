import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAuthedClient } from "@/lib/supabase/auth";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, supabase } = await getSupabaseAuthedClient(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const url = new URL(req.url);
  const conversationId = url.searchParams.get("conversationId");

  const { data: thread, error: threadError } = await supabase
    .from("canvas_threads")
    .select("id,title,base_storage_bucket,base_storage_path,created_at,updated_at,source_job_id")
    .eq("id", id)
    .single();

  if (threadError) return NextResponse.json({ error: threadError.message }, { status: 500 });

  const { data: assets, error: assetsErr } = await supabase
    .from("canvas_assets")
    .select("id,label,source_job_id,source_output_id,base_storage_bucket,base_storage_path,current_storage_bucket,current_storage_path,created_at,updated_at")
    .eq("thread_id", id)
    .order("created_at", { ascending: true });
  if (assetsErr) return NextResponse.json({ error: assetsErr.message }, { status: 500 });

  const { data: conversations, error: convErr } = await supabase
    .from("canvas_conversations")
    .select("id,title,created_at,updated_at")
    .eq("thread_id", id)
    .order("updated_at", { ascending: false });
  if (convErr) return NextResponse.json({ error: convErr.message }, { status: 500 });

  const activeConversationId = conversationId || conversations?.[0]?.id || null;

  const { data: messages, error: msgError } = await supabase
    .from("canvas_messages")
    .select("id,role,text,mask_storage_bucket,mask_storage_path,output_storage_bucket,output_storage_path,created_at,conversation_id,asset_id")
    .eq("thread_id", id)
    .eq(activeConversationId ? "conversation_id" : "thread_id", activeConversationId ? activeConversationId : id)
    .order("created_at", { ascending: true });

  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 });

  // Signed URLs (best-effort)
  const baseSigned = await supabase.storage
    .from(thread.base_storage_bucket)
    .createSignedUrl(thread.base_storage_path, 60 * 60 * 24);

  const signedAssets = await Promise.all(
    (assets || []).map(async (a: any) => {
      const baseUrl = (await supabase.storage.from(a.base_storage_bucket).createSignedUrl(a.base_storage_path, 60 * 60 * 24)).data
        ?.signedUrl || null;
      const currentUrl = (await supabase.storage.from(a.current_storage_bucket).createSignedUrl(a.current_storage_path, 60 * 60 * 24)).data
        ?.signedUrl || null;
      return { ...a, baseUrl, currentUrl };
    })
  );

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
    assets: signedAssets,
    conversations: conversations || [],
    activeConversationId,
    messages: signedMessages,
  });
}



