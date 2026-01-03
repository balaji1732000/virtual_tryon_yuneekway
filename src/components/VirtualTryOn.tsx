"use client";

import { useState } from "react";
import { Upload, RefreshCw, Play, Download, AlertCircle, Image as ImageIcon } from "lucide-react";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";

export default function VirtualTryOn() {
    const [modelImage, setModelImage] = useState<File | null>(null);
    const [dressImage, setDressImage] = useState<File | null>(null);
    const [modelPreview, setModelPreview] = useState<string | null>(null);
    const [dressPreview, setDressPreview] = useState<string | null>(null);
    const [additionalPrompt, setAdditionalPrompt] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [resultPath, setResultPath] = useState<string | null>(null);
    const [resultOutputId, setResultOutputId] = useState<string | null>(null);
    const [resultJobId, setResultJobId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleImageUpload = (file: File, type: 'model' | 'dress') => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (type === 'model') {
                setModelPreview(reader.result as string);
                setModelImage(file);
            } else {
                setDressPreview(reader.result as string);
                setDressImage(file);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleGenerate = async () => {
        if (!modelImage || !dressImage) {
            setError("Please upload both a model image and a dress image.");
            return;
        }

        setIsGenerating(true);
        setError(null);
        setResult(null);
        setResultPath(null);
        setResultOutputId(null);
        setResultJobId(null);

        try {
            const formData = new FormData();
            formData.append('type', 'tryon');
            formData.append('modelImage', modelImage);
            formData.append('dressImage', dressImage);
            formData.append('additionalPrompt', additionalPrompt);

            const response = await fetch('/api/generate-image', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data?.error || "Generation failed");

            setResult(data.signedUrl || `data:${data.mimeType};base64,${data.image}`);
            setResultPath(data.storagePath || null);
            setResultOutputId(data.outputId || null);
            setResultJobId(data.jobId || null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader title="Virtual Try-On" subtitle="Upload a model photo and a garment photo, then generate a try-on result." />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card>
                    <CardHeader title="Model image" subtitle="Upload the person/model photo" />
                    <CardBody>
                        <div
                            className="aspect-[3/4] rounded-2xl border border-dashed border-[color:var(--sp-border)] bg-[color:var(--sp-hover)] flex items-center justify-center overflow-hidden cursor-pointer"
                            onClick={() => document.getElementById('model-upload')?.click()}
                        >
                            {modelPreview ? (
                                <img src={modelPreview} alt="Model" className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-center p-6 text-[color:var(--sp-muted)]">
                                    <ImageIcon size={42} className="mx-auto mb-2 opacity-70" />
                                    <div className="text-sm">Click to upload</div>
                                </div>
                            )}
                        </div>
                        <input
                            id="model-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'model')}
                        />
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader title="Garment image" subtitle="Upload the dress/product photo" />
                    <CardBody>
                        <div
                            className="aspect-[3/4] rounded-2xl border border-dashed border-[color:var(--sp-border)] bg-[color:var(--sp-hover)] flex items-center justify-center overflow-hidden cursor-pointer"
                            onClick={() => document.getElementById('dress-upload')?.click()}
                        >
                            {dressPreview ? (
                                <img src={dressPreview} alt="Dress" className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-center p-6 text-[color:var(--sp-muted)]">
                                    <ImageIcon size={42} className="mx-auto mb-2 opacity-70" />
                                    <div className="text-sm">Click to upload</div>
                                </div>
                            )}
                        </div>
                        <input
                            id="dress-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'dress')}
                        />
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader title="Generate" subtitle="Optional guidance + run" />
                    <CardBody className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium opacity-70">Additional instructions</label>
                            <textarea
                                value={additionalPrompt}
                                onChange={e => setAdditionalPrompt(e.target.value)}
                                placeholder="e.g., keep background, tighter fit, studio lighting…"
                                className="w-full input-field text-sm"
                                rows={4}
                            />
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !modelImage || !dressImage}
                            className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isGenerating ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 spinner-primary rounded-full animate-spin" />
                                    Processing...
                                </div>
                            ) : (
                                <>
                                    <RefreshCw size={18} /> Generate
                                </>
                            )}
                        </button>

                        {error && (
                            <div className="alert-error text-xs flex items-center gap-2">
                                <AlertCircle size={14} /> {error}
                            </div>
                        )}
                    </CardBody>
                </Card>
            </div>

            <Card>
                <CardHeader
                    title="Result"
                    subtitle="Generated try-on output"
                    right={result ? (
                        <div className="flex items-center gap-3">
                            {resultJobId && resultOutputId && (
                                <a
                                    className="text-sm text-[color:var(--sp-text)] hover:underline"
                                    href={`/app/canvas?jobId=${encodeURIComponent(resultJobId)}&outputId=${encodeURIComponent(resultOutputId)}`}
                                >
                                    Edit in Magic Canvas
                                </a>
                            )}
                            <a className="text-sm text-[color:var(--sp-text)] hover:underline" href={result} download>
                                <span className="inline-flex items-center gap-1"><Download size={16} /> Download</span>
                            </a>
                        </div>
                    ) : null}
                />
                <CardBody>
                    {result ? (
                        <div className="w-full aspect-[16/9] rounded-2xl overflow-hidden bg-[color:var(--sp-hover)] border border-[color:var(--sp-border)]">
                            <img src={result} alt="Result" className="w-full h-full object-contain" />
                        </div>
                    ) : (
                        <div className="w-full aspect-[16/9] rounded-2xl flex items-center justify-center bg-[color:var(--sp-hover)] border border-[color:var(--sp-border)] text-[color:var(--sp-muted)]">
                            <div className="text-sm">No output yet</div>
                        </div>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
