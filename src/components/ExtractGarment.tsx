"use client";

import { useState } from "react";
import { Upload, Download, AlertCircle, Image as ImageIcon, Scissors } from "lucide-react";

export default function ExtractGarment() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPick = (f: File) => {
    setFile(f);
    setResultUrl(null);
    setError(null);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const onExtract = async () => {
    if (!file) return;
    setIsWorking(true);
    setError(null);
    setResultUrl(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/extract-garment", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Extraction failed");
      setResultUrl(data.signedUrl);
    } catch (e: any) {
      setError(e?.message || "Extraction failed");
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Extract Garment</h1>
          <p className="text-sm opacity-70">Upload a product photo and get a transparent PNG cutout.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          <label className="text-sm font-medium opacity-70 flex items-center gap-2">
            <Upload size={16} /> Upload image
          </label>
          <div
            className="aspect-[3/4] glass-panel border-2 border-dashed border-primary/30 flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer"
            onClick={() => document.getElementById("extract-upload")?.click()}
          >
            {preview ? (
              <img src={preview} alt="Input preview" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center p-4">
                <ImageIcon size={48} className="mx-auto mb-2 opacity-30 group-hover:opacity-100 transition-opacity" />
                <p className="text-sm opacity-50">Click to upload</p>
              </div>
            )}
            <input
              id="extract-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
            />
          </div>

          <button
            onClick={onExtract}
            disabled={!file || isWorking}
            className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isWorking ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                <Scissors size={18} /> Extract Garment
              </>
            )}
          </button>

          {error && (
            <div className="p-3 bg-secondary/10 border border-secondary/20 rounded-xl text-secondary text-xs flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium opacity-70">Result (transparent PNG)</label>
            {resultUrl && (
              <a className="text-xs text-primary hover:underline flex items-center gap-1" href={resultUrl} download>
                <Download size={14} /> Download
              </a>
            )}
          </div>

          <div className="glass-panel p-3 min-h-[420px] flex items-center justify-center">
            {resultUrl ? (
              <div className="w-full">
                <div className="w-full aspect-[3/2] rounded-xl overflow-hidden bg-[linear-gradient(45deg,rgba(0,0,0,0.08)_25%,transparent_25%,transparent_75%,rgba(0,0,0,0.08)_75%,rgba(0,0,0,0.08)),linear-gradient(45deg,rgba(0,0,0,0.08)_25%,transparent_25%,transparent_75%,rgba(0,0,0,0.08)_75%,rgba(0,0,0,0.08))] bg-[length:24px_24px] bg-[position:0_0,12px_12px]">
                  <img src={resultUrl} alt="Extracted garment" className="w-full h-full object-contain" />
                </div>
              </div>
            ) : (
              <div className="text-center opacity-40">
                <ImageIcon size={48} className="mx-auto mb-2" />
                <p className="text-sm">Your cutout will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


