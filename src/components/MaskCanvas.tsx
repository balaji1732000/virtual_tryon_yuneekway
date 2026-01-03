"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Tool = "brush" | "erase";

export function MaskCanvas(props: {
  imageUrl: string | null;
  width: number;
  height: number;
  onMaskChange: (mask: Blob | null, meta: { invert: boolean; feather: number }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null); // stores raw mask (no feather/invert)
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  const [tool, setTool] = useState<Tool>("brush");
  const [brush, setBrush] = useState(28);
  const [feather, setFeather] = useState(8);
  const [invert, setInvert] = useState(false);

  // initialize mask canvas (black = protected)
  useEffect(() => {
    baseRef.current = document.createElement("canvas");
    baseRef.current.width = props.width;
    baseRef.current.height = props.height;
    const bctx = baseRef.current.getContext("2d")!;
    bctx.fillStyle = "black";
    bctx.fillRect(0, 0, props.width, props.height);
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.width, props.height]);

  // redraw visible overlay
  const redraw = () => {
    const canvas = canvasRef.current;
    const base = baseRef.current;
    if (!canvas || !base) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // show mask as translucent purple where editable (white)
    ctx.drawImage(base, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = d[i]; // 0..255 (white=editable)
      // Overlay tint
      d[i] = 168; // R
      d[i + 1] = 85; // G
      d[i + 2] = 247; // B
      d[i + 3] = Math.round((v / 255) * 120); // alpha
    }
    ctx.putImageData(imgData, 0, 0);
  };

  const toMaskBlob = async () => {
    const base = baseRef.current;
    if (!base) return null;

    // Create export canvas applying feather + invert if requested
    const out = document.createElement("canvas");
    out.width = base.width;
    out.height = base.height;
    const octx = out.getContext("2d")!;

    // feather: blur mask edges
    if (feather > 0) {
      octx.filter = `blur(${Math.round(feather)}px)`;
    }
    octx.drawImage(base, 0, 0);
    octx.filter = "none";

    if (invert) {
      const id = octx.getImageData(0, 0, out.width, out.height);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = d[i];
        const inv = 255 - v;
        d[i] = inv;
        d[i + 1] = inv;
        d[i + 2] = inv;
        d[i + 3] = 255;
      }
      octx.putImageData(id, 0, 0);
    } else {
      // ensure alpha is opaque
      const id = octx.getImageData(0, 0, out.width, out.height);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) d[i + 3] = 255;
      octx.putImageData(id, 0, 0);
    }

    return await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png"));
  };

  const emitMask = async () => {
    const blob = await toMaskBlob();
    props.onMaskChange(blob, { invert, feather });
  };

  useEffect(() => {
    emitMask();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invert, feather, props.imageUrl]);

  const getPos = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * canvas.width;
    const y = ((e.clientY - r.top) / r.height) * canvas.height;
    return { x, y };
  };

  const stroke = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const base = baseRef.current;
    if (!base) return;
    const bctx = base.getContext("2d")!;
    bctx.lineCap = "round";
    bctx.lineJoin = "round";
    bctx.lineWidth = brush;
    bctx.strokeStyle = tool === "brush" ? "white" : "black";
    bctx.beginPath();
    bctx.moveTo(from.x, from.y);
    bctx.lineTo(to.x, to.y);
    bctx.stroke();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onDown = (e: PointerEvent) => {
      drawing.current = true;
      last.current = getPos(e);
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!drawing.current || !last.current) return;
      const p = getPos(e);
      stroke(last.current, p);
      last.current = p;
      redraw();
    };
    const onUp = async () => {
      drawing.current = false;
      last.current = null;
      redraw();
      await emitMask();
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, brush, feather, invert]);

  const clearMask = async () => {
    const base = baseRef.current;
    if (!base) return;
    const bctx = base.getContext("2d")!;
    bctx.fillStyle = "black";
    bctx.fillRect(0, 0, base.width, base.height);
    redraw();
    await emitMask();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTool("brush")}
          className={`px-3 py-1.5 rounded-full text-sm border ${tool === "brush" ? "bg-black text-white border-black" : "bg-white border-black/10"}`}
        >
          Brush
        </button>
        <button
          type="button"
          onClick={() => setTool("erase")}
          className={`px-3 py-1.5 rounded-full text-sm border ${tool === "erase" ? "bg-black text-white border-black" : "bg-white border-black/10"}`}
        >
          Erase
        </button>
        <button type="button" onClick={clearMask} className="px-3 py-1.5 rounded-full text-sm border bg-white border-black/10">
          Clear
        </button>
        <label className="ml-2 flex items-center gap-2 text-sm">
          <span className="opacity-70">Invert</span>
          <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-sm">
          <div className="opacity-70 mb-1">Brush size: {brush}px</div>
          <input type="range" min={6} max={90} value={brush} onChange={(e) => setBrush(Number(e.target.value))} className="w-full" />
        </label>
        <label className="text-sm">
          <div className="opacity-70 mb-1">Feather: {Math.round(feather)}px</div>
          <input type="range" min={0} max={40} value={feather} onChange={(e) => setFeather(Number(e.target.value))} className="w-full" />
        </label>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white overflow-hidden">
        <div className="relative">
          {props.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.imageUrl} alt="Base" className="block w-full h-auto" style={{ aspectRatio: `${props.width}/${props.height}` }} />
          ) : (
            <div className="aspect-[3/2] flex items-center justify-center text-sm opacity-60">Upload or pick an image</div>
          )}
          <canvas
            ref={canvasRef}
            width={props.width}
            height={props.height}
            className="absolute inset-0 w-full h-full touch-none"
          />
        </div>
      </div>

      <div className="text-xs opacity-60">
        Paint where the AI is allowed to change. White = editable, black = protected. Feather softens edges.
      </div>
    </div>
  );
}


