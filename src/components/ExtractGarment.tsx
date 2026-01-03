"use client";

import { useState } from "react";
import { Upload, Download, AlertCircle, Image as ImageIcon, Scissors } from "lucide-react";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";

export default function ExtractGarment() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultPath, setResultPath] = useState<string | null>(null);
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
    setResultPath(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/extract-garment", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Extraction failed");
      setResultUrl(data.signedUrl);
      setResultPath(data.storagePath || null);
    } catch (e: any) {
      setError(e?.message || "Extraction failed");
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Extract Garment" subtitle="Create a transparent PNG cutout from a product photo." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader title="Input" subtitle="Upload a garment photo" />
          <CardBody className="space-y-4">
            <div
              className="aspect-[3/4] rounded-2xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden cursor-pointer"
              onClick={() => document.getElementById("extract-upload")?.click()}
            >
              {preview ? (
                <img src={preview} alt="Input preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-6 text-slate-500">
                  <ImageIcon size={42} className="mx-auto mb-2 opacity-70" />
                  <div className="text-sm">Click to upload</div>
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
                  Extracting…
                </>
              ) : (
                <>
                  <Scissors size={18} /> Extract
                </>
              )}
            </button>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle size={14} /> {error}
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Result"
            subtitle="Transparent PNG"
            right={resultUrl ? (
              <div className="flex items-center gap-3">
                {resultPath && (
                  <a
                    className="text-sm text-slate-700 hover:underline"
                    href={`/app/canvas?fromBucket=${encodeURIComponent("extractions")}&fromPath=${encodeURIComponent(resultPath)}&title=${encodeURIComponent("Extract Garment")}`}
                  >
                    Edit in Magic Canvas
                  </a>
                )}
                <a className="text-sm text-slate-700 hover:underline inline-flex items-center gap-1" href={resultUrl} download>
                  <Download size={16} /> Download
                </a>
              </div>
            ) : null}
          />
          <CardBody>
            {resultUrl ? (
              <div className="w-full aspect-[16/9] rounded-2xl overflow-hidden border border-slate-200 bg-[linear-gradient(45deg,rgba(0,0,0,0.06)_25%,transparent_25%,transparent_75%,rgba(0,0,0,0.06)_75%,rgba(0,0,0,0.06)),linear-gradient(45deg,rgba(0,0,0,0.06)_25%,transparent_25%,transparent_75%,rgba(0,0,0,0.06)_75%,rgba(0,0,0,0.06))] bg-[length:24px_24px] bg-[position:0_0,12px_12px]">
                <img src={resultUrl} alt="Extracted garment" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-full aspect-[16/9] rounded-2xl flex items-center justify-center bg-slate-50 border border-slate-200 text-slate-400">
                <div className="text-sm">No output yet</div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}


