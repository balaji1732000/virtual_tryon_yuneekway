"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MaskCanvas } from "@/components/MaskCanvas";
import { Card, CardBody, CardHeader } from "@/components/ui";

type Thread = {
  id: string;
  title: string;
  base_storage_bucket: string;
  base_storage_path: string;
  source_job_id?: string | null;
  created_at: string;
  updated_at: string;
};

type Asset = {
  id: string;
  label: string | null;
  base_storage_bucket: string;
  base_storage_path: string;
  current_storage_bucket: string;
  current_storage_path: string;
  baseUrl?: string | null;
  currentUrl?: string | null;
};

type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string | null;
  conversation_id?: string | null;
  asset_id?: string | null;
  output_storage_bucket?: string | null;
  output_storage_path?: string | null;
  maskUrl?: string | null;
  outputUrl?: string | null;
  created_at: string;
};

export default function MagicCanvas() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadId, setThreadId] = useState<string>("");
  const [loadedThreadTitle, setLoadedThreadTitle] = useState<string>("");
  const [threadTitle, setThreadTitle] = useState<string>("Untitled");
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>("");
  const [activeAssetId, setActiveAssetId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [baseOverride, setBaseOverride] = useState<{ bucket: string; path: string; signedUrl: string } | null>(null);

  const [upload, setUpload] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [maskBlob, setMaskBlob] = useState<Blob | null>(null);
  const [maskMeta, setMaskMeta] = useState<{ invert: boolean; feather: number }>({ invert: false, feather: 8 });

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const loadThreads = async () => {
    const res = await fetch("/api/canvas/threads");
    const json = await res.json();
    if (res.ok) setThreads(json.threads || []);
  };

  const loadThread = async (id: string, opts?: { conversationId?: string; preferredAssetId?: string }) => {
    setError(null);
    const qs = new URLSearchParams();
    if (opts?.conversationId) qs.set("conversationId", opts.conversationId);
    const res = await fetch(`/api/canvas/threads/${id}${qs.toString() ? `?${qs.toString()}` : ""}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error || "Failed to load thread");
      return;
    }
    setThreadId(json.thread.id);
    setThreadTitle(json.thread.title);
    setLoadedThreadTitle(json.thread.title);
    setBaseUrl(json.thread.baseUrl);
    setAssets(json.assets || []);
    setConversations(json.conversations || []);
    setActiveConversationId(json.activeConversationId || "");
    setMessages(json.messages || []);

    const preferredAssetId = opts?.preferredAssetId || "";
    const firstAssetId = (json.assets?.[0]?.id as string | undefined) || "";
    const nextAssetId =
      (preferredAssetId && json.assets?.some((a: any) => a.id === preferredAssetId) ? preferredAssetId : "") || activeAssetId || firstAssetId;
    setActiveAssetId(nextAssetId);

    const asset = (json.assets || []).find((a: any) => a.id === nextAssetId) || null;
    setCurrentImageUrl(asset?.currentUrl || asset?.baseUrl || json.thread.baseUrl || null);
    setBaseOverride(null);
  };

  useEffect(() => {
    loadThreads();
  }, []);

  // Deep-link support:
  // - /app/canvas?jobId=...&outputId=... resolves to a single creation thread + asset + conversation
  // - /app/canvas?threadId=...&assetId=...&conversationId=... opens directly
  useEffect(() => {
    const run = async () => {
      const sp = new URLSearchParams(window.location.search);
      const jobId = sp.get("jobId");
      const outputId = sp.get("outputId");
      const tid = sp.get("threadId");
      const preferredAssetId = sp.get("assetId");
      const preferredConversationId = sp.get("conversationId");

      if (jobId && outputId) {
        setIsBusy(true);
        setError(null);
        try {
          const res = await fetch("/api/canvas/resolve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId, outputId }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json?.error || "Resolve failed");

          const url = new URL(window.location.href);
          url.searchParams.delete("jobId");
          url.searchParams.delete("outputId");
          url.searchParams.set("threadId", json.threadId);
          url.searchParams.set("assetId", json.assetId);
          url.searchParams.set("conversationId", json.conversationId);
          window.history.replaceState({}, "", url.toString());

          await loadThreads();
          await loadThread(json.threadId, { conversationId: json.conversationId, preferredAssetId: json.assetId });
        } catch (e: any) {
          setError(e?.message || "Failed to create thread");
        } finally {
          setIsBusy(false);
        }
        return;
      }

      if (tid) {
        await loadThread(tid, { conversationId: preferredConversationId || undefined, preferredAssetId: preferredAssetId || undefined });
        return;
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const createThread = async () => {
    if (!upload) {
      setError("Upload an image to start.");
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("title", threadTitle || "Untitled");
      fd.append("image", upload);
      const res = await fetch("/api/canvas/threads", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create thread");
      await loadThreads();
      await loadThread(json.thread.id, { conversationId: json.conversationId, preferredAssetId: json.assetId });

      const url = new URL(window.location.href);
      url.searchParams.set("threadId", json.thread.id);
      if (json.assetId) url.searchParams.set("assetId", json.assetId);
      if (json.conversationId) url.searchParams.set("conversationId", json.conversationId);
      window.history.replaceState({}, "", url.toString());
    } catch (e: any) {
      setError(e?.message || "Failed to create thread");
    } finally {
      setIsBusy(false);
    }
  };

  const renameThread = async () => {
    if (!threadId) return;
    const next = threadTitle.trim();
    if (!next) return;
    setIsBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/canvas/threads/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Rename failed");
      setLoadedThreadTitle(json.thread.title);
      await loadThreads();
    } catch (e: any) {
      setError(e?.message || "Rename failed");
    } finally {
      setIsBusy(false);
    }
  };

  const formatThreadOption = (t: Thread) => {
    const dt = t.updated_at ? new Date(t.updated_at) : new Date();
    const when = dt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).replace(",", "");
    return `${t.title} • ${when}`;
  };

  const selectAsset = (id: string) => {
    setActiveAssetId(id);
    const a = assets.find((x) => x.id === id);
    setCurrentImageUrl(a?.currentUrl || a?.baseUrl || baseUrl);
    setBaseOverride(null);
  };

  const versionsForActiveAsset = useMemo(() => {
    const out = (messages || [])
      .filter((m) => m.role === "assistant" && m.asset_id === activeAssetId && m.outputUrl && m.output_storage_bucket && m.output_storage_path)
      .map((m) => ({
        id: m.id,
        signedUrl: m.outputUrl as string,
        bucket: m.output_storage_bucket as string,
        path: m.output_storage_path as string,
        created_at: m.created_at,
      }));
    // latest first
    return out.slice().reverse();
  }, [messages, activeAssetId]);

  const sendMessage = async () => {
    if (!threadId) {
      setError("Create/select a thread first.");
      return;
    }
    if (!activeConversationId || !activeAssetId) {
      setError("Select an image (asset) first.");
      return;
    }
    if (!prompt.trim()) return;
    setIsBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("text", prompt.trim());
      fd.append("invert", String(maskMeta.invert));
      fd.append("feather", String(maskMeta.feather));
      fd.append("conversationId", activeConversationId);
      fd.append("assetId", activeAssetId);
      if (baseOverride) {
        fd.append("baseOverrideBucket", baseOverride.bucket);
        fd.append("baseOverridePath", baseOverride.path);
      }
      if (maskBlob) fd.append("mask", maskBlob, "mask.png");

      const res = await fetch(`/api/canvas/threads/${threadId}/messages`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Edit failed");

      setPrompt("");
      await loadThread(threadId, { conversationId: activeConversationId, preferredAssetId: activeAssetId });
      await loadThreads();
      setBaseOverride(null);
    } catch (e: any) {
      setError(e?.message || "Edit failed");
    } finally {
      setIsBusy(false);
    }
  };

  const createNewChat = async () => {
    if (!threadId) return;
    setIsBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/canvas/threads/${threadId}/conversations`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create chat");

      const cid = json.conversation?.id as string;
      setActiveConversationId(cid);
      await loadThread(threadId, { conversationId: cid, preferredAssetId: activeAssetId });

      const url = new URL(window.location.href);
      url.searchParams.set("conversationId", cid);
      window.history.replaceState({}, "", url.toString());
    } catch (e: any) {
      setError(e?.message || "Failed to create chat");
    } finally {
      setIsBusy(false);
    }
  };

  const canvasWidth = 1024;
  const canvasHeight = 768;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6 items-stretch">
      <div className="space-y-6">
        <Card>
          <CardHeader title="Magic Canvas" subtitle="Upload an image, paint where to edit, and refine using chat." />
          <CardBody className="space-y-4">
            {error && (
              <div className="alert-error text-xs">{error}</div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium opacity-70">Creation</label>
                <select
                  value={threadId}
                  onChange={(e) => (e.target.value ? loadThread(e.target.value) : null)}
                  className="w-full input-field text-sm"
                >
                  <option value="">-- New thread --</option>
                  {threads.map((t) => (
                    <option key={t.id} value={t.id}>
                      {formatThreadOption(t)}
                    </option>
                  ))}
                </select>
                <div className="text-xs opacity-60">{threads.length} thread(s)</div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium opacity-70">Name</label>
                  {threadId && threadTitle.trim() && threadTitle.trim() !== loadedThreadTitle && (
                    <button type="button" className="text-xs hover:underline disabled:opacity-50" onClick={renameThread} disabled={isBusy}>
                      Save
                    </button>
                  )}
                </div>
                <input
                  value={threadTitle}
                  onChange={(e) => setThreadTitle(e.target.value)}
                  className="w-full input-field text-sm"
                  placeholder="e.g. Banner retouch"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium opacity-70">Upload base image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setUpload(e.target.files?.[0] || null)}
                  className="w-full input-field text-sm p-2"
                />
                <button
                  type="button"
                  onClick={createThread}
                  disabled={isBusy || !upload}
                  className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create thread
                </button>
              </div>
            </div>

            {threadId && assets.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs opacity-70">Images in this creation</div>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {assets.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => selectAsset(a.id)}
                      className={`flex-shrink-0 w-[120px] rounded-xl border overflow-hidden text-left ${
                        a.id === activeAssetId ? "border-[color:var(--sp-primary)]" : "border-[color:var(--sp-border)]"
                      }`}
                      title={a.label || "image"}
                    >
                      <div className="aspect-[3/2] bg-[color:var(--sp-hover)] flex items-center justify-center overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {a.currentUrl ? <img src={a.currentUrl} alt={a.label || "image"} className="w-full h-full object-cover" /> : null}
                      </div>
                      <div className="px-2 py-1 text-[11px] truncate text-[color:var(--sp-muted)]">{a.label || "Image"}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Mask + preview" subtitle="Paint where the AI can edit. Then prompt on the right." />
          <CardBody>
            <MaskCanvas
              imageUrl={currentImageUrl || baseUrl}
              width={canvasWidth}
              height={canvasHeight}
              onMaskChange={(blob, meta) => {
                setMaskBlob(blob);
                setMaskMeta(meta);
              }}
            />

            {threadId && activeAssetId && versionsForActiveAsset.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-xs opacity-70">Versions (tap to edit a previous version)</div>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {versionsForActiveAsset.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setCurrentImageUrl(v.signedUrl);
                        setBaseOverride({ bucket: v.bucket, path: v.path, signedUrl: v.signedUrl });
                      }}
                      className={`flex-shrink-0 w-[140px] rounded-xl border overflow-hidden text-left ${
                        baseOverride?.path === v.path ? "border-[color:var(--sp-primary)]" : "border-[color:var(--sp-border)]"
                      }`}
                      title={new Date(v.created_at).toLocaleString()}
                    >
                      <div className="aspect-[3/2] bg-[color:var(--sp-hover)] overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={v.signedUrl} alt="version" className="w-full h-full object-cover" />
                      </div>
                      <div className="px-2 py-1 text-[11px] truncate text-[color:var(--sp-muted)]">
                        {new Date(v.created_at).toLocaleTimeString()}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Chat should stretch and only the message list should scroll (avoid clipped composer). */}
      <Card className="min-h-[520px] lg:min-h-[calc(100vh-300px)] flex flex-col">
        <CardHeader
          title="Chat"
          subtitle="Describe what you want to change. The selected image is used as context."
          right={
            threadId ? (
              <button type="button" className="text-sm hover:underline disabled:opacity-50" onClick={createNewChat} disabled={isBusy}>
                New chat
              </button>
            ) : null
          }
        />
        <CardBody className="flex-1 min-h-0 flex flex-col gap-3">
          {threadId && conversations.length > 0 && (
            <div className="flex items-center justify-between gap-3 shrink-0">
              <select
                value={activeConversationId}
                onChange={(e) => {
                  const cid = e.target.value;
                  setActiveConversationId(cid);
                  loadThread(threadId, { conversationId: cid, preferredAssetId: activeAssetId });

                  const url = new URL(window.location.href);
                  url.searchParams.set("conversationId", cid);
                  window.history.replaceState({}, "", url.toString());
                }}
                className="input-field text-sm"
              >
                {conversations.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              <div className="text-xs opacity-60">Shared chat for this creation</div>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-2">
            {messages.length === 0 ? (
              <div className="text-sm opacity-60">No messages yet. Create a thread and send your first edit request.</div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                    className={`rounded-2xl border border-[color:var(--sp-border)] p-3 ${
                      m.role === "user" ? "bg-[color:var(--sp-panel)]" : "bg-[color:var(--sp-hover)]"
                    }`}
                >
                  <div className="text-xs opacity-60 mb-1">{m.role === "user" ? "You" : "Assistant"}</div>
                  {m.text && <div className="text-sm whitespace-pre-wrap">{m.text}</div>}
                  {m.outputUrl && (
                    <div className="mt-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={m.outputUrl}
                          alt="output"
                          className="w-full rounded-xl border border-[color:var(--sp-border)] cursor-pointer"
                          onClick={() => {
                            if (m.asset_id) selectAsset(m.asset_id);
                            if (m.output_storage_bucket && m.output_storage_path) {
                              setCurrentImageUrl(m.outputUrl || null);
                              setBaseOverride({
                                bucket: m.output_storage_bucket,
                                path: m.output_storage_path,
                                signedUrl: m.outputUrl || "",
                              });
                            }
                          }}
                        />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="space-y-2 shrink-0">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="w-full input-field text-sm"
              placeholder="e.g. Change the dress color to black, keep face/hair/background unchanged."
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={isBusy || !threadId || !activeConversationId || !activeAssetId || !prompt.trim()}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBusy ? "Processing..." : "Send edit"}
            </button>
            <div className="text-xs opacity-60">
              Mask: {maskMeta.invert ? "invert" : "inside-only"} • Feather: {Math.round(maskMeta.feather)}px
              {baseOverride ? " • Base: selected version" : ""}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}


