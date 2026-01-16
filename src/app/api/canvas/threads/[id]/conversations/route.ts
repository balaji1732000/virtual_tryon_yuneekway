import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAuthedClient } from "@/lib/supabase/auth";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, supabase } = await getSupabaseAuthedClient(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: threadId } = await ctx.params;

  const { data: thread, error: threadErr } = await supabase.from("canvas_threads").select("id,user_id").eq("id", threadId).single();
  if (threadErr || !thread) return NextResponse.json({ error: threadErr?.message || "Thread not found" }, { status: 404 });
  if (thread.user_id !== user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: existing } = await supabase.from("canvas_conversations").select("id").eq("thread_id", threadId);
  const title = `Chat ${(existing?.length || 0) + 1}`;

  const { data: conv, error } = await supabase
    .from("canvas_conversations")
    .insert({ thread_id: threadId as any, user_id: user.id, title })
    .select("id,title,created_at,updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ conversation: conv });
}





