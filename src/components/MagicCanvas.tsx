"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MaskCanvas } from "@/components/MaskCanvas";
import { Card, CardBody, CardHeader } from "@/components/ui";

type Thread = {
  id: string;
  title: string;
  base_storage_bucket: string;
  base_storage_path: string;
  created_at: string;
  updated_at: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string | null;
  maskUrl?: string | null;
  outputUrl?: string | null;
  created_at: string;
};

export default function MagicCanvas() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadId, setThreadId] = useState<string>("");
  const [threadTitle, setThreadTitle] = useState<string>("Untitled");
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);

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

  const loadThread = async (id: string) => {
    setError(null);
    const res = await fetch(`/api/canvas/threads/${id}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error || "Failed to load thread");
      return;
    }
    setThreadId(json.thread.id);
    setThreadTitle(json.thread.title);
    setBaseUrl(json.thread.baseUrl);
    setMessages(json.messages || []);

    // current image = last assistant output else base
    const lastOut = (json.messages || []).slice().reverse().find((m: any) => m.outputUrl)?.outputUrl || null;
    setCurrentImageUrl(lastOut || json.thread.baseUrl || null);
  };

  useEffect(() => {
    loadThreads();
  }, []);

  // Deep-link support:
  // - /app/canvas?threadId=... loads existing thread
  // - /app/canvas?fromBucket=...&fromPath=...&title=... creates a new thread from an existing stored output
  useEffect(() => {
    const run = async () => {
      const sp = new URLSearchParams(window.location.search);
      const tid = sp.get("threadId");
      const fromBucket = sp.get("fromBucket");
      const fromPath = sp.get("fromPath");
      const title = sp.get("title");

      if (tid) {
        await loadThread(tid);
        return;
      }

      if (fromBucket && fromPath) {
        setIsBusy(true);
        setError(null);
        try {
          const fd = new FormData();
          fd.append("title", title || "Canvas edit");
          fd.append("fromBucket", fromBucket);
          fd.append("fromPath", fromPath);
          const res = await fetch("/api/canvas/threads", { method: "POST", body: fd });
          const json = await res.json();
          if (!res.ok) throw new Error(json?.error || "Failed to create thread");
          await loadThreads();
          await loadThread(json.thread.id);

          // replace URL to keep it clean
          const url = new URL(window.location.href);
          url.searchParams.delete("fromBucket");
          url.searchParams.delete("fromPath");
          url.searchParams.delete("title");
          url.searchParams.set("threadId", json.thread.id);
          window.history.replaceState({}, "", url.toString());
        } catch (e: any) {
          setError(e?.message || "Failed to create thread");
        } finally {
          setIsBusy(false);
        }
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
      await loadThread(json.thread.id);
    } catch (e: any) {
      setError(e?.message || "Failed to create thread");
    } finally {
      setIsBusy(false);
    }
  };

  const sendMessage = async () => {
    if (!threadId) {
      setError("Create/select a thread first.");
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
      if (maskBlob) fd.append("mask", maskBlob, "mask.png");

      const res = await fetch(`/api/canvas/threads/${threadId}/messages`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Edit failed");

      setPrompt("");
      await loadThread(threadId);
      await loadThreads();
    } catch (e: any) {
      setError(e?.message || "Edit failed");
    } finally {
      setIsBusy(false);
    }
  };

  const canvasWidth = 1024;
  const canvasHeight = 768;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
      <div className="space-y-6">
        <Card>
          <CardHeader title="Magic Canvas" subtitle="Upload an image, paint where to edit, and refine using chat." />
          <CardBody className="space-y-4">
            {error && (
              <div className="alert-error text-xs">{error}</div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium opacity-70">Thread</label>
                <select
                  value={threadId}
                  onChange={(e) => (e.target.value ? loadThread(e.target.value) : null)}
                  className="w-full input-field text-sm"
                >
                  <option value="">-- New thread --</option>
                  {threads.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
                <div className="text-xs opacity-60">{threads.length} thread(s)</div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium opacity-70">Title</label>
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
          </CardBody>
        </Card>
      </div>

      <Card className="h-[calc(100vh-220px)] flex flex-col">
        <CardHeader title="Chat" subtitle="Describe what you want to change. The latest image is used as context." />
        <CardBody className="flex-1 flex flex-col gap-3">
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-2">
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
                        <img src={m.outputUrl} alt="output" className="w-full rounded-xl border border-[color:var(--sp-border)]" />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="space-y-2">
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
              disabled={isBusy || !threadId || !prompt.trim()}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBusy ? "Processing..." : "Send edit"}
            </button>
            <div className="text-xs opacity-60">
              Mask: {maskMeta.invert ? "invert" : "inside-only"} • Feather: {Math.round(maskMeta.feather)}px
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}


