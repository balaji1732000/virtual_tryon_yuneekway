"use client";

import { useState, useEffect } from "react";
import { Video, Download, AlertCircle, Image as ImageIcon, Loader2 } from "lucide-react";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";

export default function GenerateVideo() {
    const [dressImage, setDressImage] = useState<File | null>(null);
    const [dressPreview, setDressPreview] = useState<string | null>(null);
    const [prompt, setPrompt] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [operationId, setOperationId] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleImageUpload = (file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            setDressPreview(reader.result as string);
            setDressImage(file);
        };
        reader.readAsDataURL(file);
    };

    const handleGenerate = async () => {
        if (!dressImage || !prompt) {
            setError("Please upload a dress image and provide a prompt.");
            return;
        }

        setIsGenerating(true);
        setError(null);
        setVideoUrl(null);
        setOperationId(null);

        try {
            const formData = new FormData();
            formData.append('dressImage', dressImage);
            formData.append('prompt', prompt);

            const response = await fetch('/api/generate-video', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            setOperationId(data.operationId);
        } catch (err: any) {
            setError(err.message);
            setIsGenerating(false);
        }
    };

    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (operationId && isGenerating) {
            interval = setInterval(async () => {
                try {
                    const response = await fetch(`/api/video-status?operationId=${operationId}`);
                    const data = await response.json();

                    if (data.error) {
                        throw new Error(data.error);
                    }

                    if (data.status === 'done') {
                        setVideoUrl(data.videoUri || (data.videoBytes ? `data:video/mp4;base64,${data.videoBytes}` : null));
                        setIsGenerating(false);
                        setOperationId(null);
                        clearInterval(interval);
                    }
                } catch (err: any) {
                    setError(err.message);
                    setIsGenerating(false);
                    setOperationId(null);
                    clearInterval(interval);
                }
            }, 5000);
        }

        return () => clearInterval(interval);
    }, [operationId, isGenerating]);

    return (
        <div className="space-y-6">
            <PageHeader title="Video Generator" subtitle="Generate a short fashion video (async) using your garment image + prompt." />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card>
                    <CardHeader title="Input" subtitle="Garment image" />
                    <CardBody className="space-y-4">
                        <div
                            className="aspect-[3/4] rounded-2xl border border-dashed border-[color:var(--sp-border)] bg-[color:var(--sp-hover)] flex items-center justify-center overflow-hidden cursor-pointer"
                            onClick={() => document.getElementById('dress-upload-video')?.click()}
                        >
                            {dressPreview ? (
                                <img src={dressPreview} alt="Dress" className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-center p-6 text-[color:var(--sp-muted)]">
                                    <ImageIcon size={42} className="mx-auto mb-2 opacity-70" />
                                    <div className="text-sm">Click to upload</div>
                                </div>
                            )}
                            <input
                                id="dress-upload-video"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                            />
                        </div>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader title="Prompt" subtitle="Describe the video" />
                    <CardBody className="space-y-4">
                        <textarea
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            placeholder="e.g. A cinematic runway walk, soft sunlight, 4k…"
                            className="w-full input-field text-sm"
                            rows={8}
                        />

                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !dressImage || !prompt}
                            className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isGenerating ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 size={18} className="animate-spin" />
                                    {operationId ? "Generating…" : "Starting…"}
                                </div>
                            ) : (
                                <>
                                    <Video size={18} /> Generate
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

                <Card>
                    <CardHeader
                        title="Result"
                        subtitle={operationId ? `Operation: ${operationId}` : "Generated video"}
                        right={videoUrl ? (
                            <a className="text-sm text-[color:var(--sp-text)] hover:underline inline-flex items-center gap-1" href={videoUrl} download>
                                <Download size={16} /> Download
                            </a>
                        ) : null}
                    />
                    <CardBody>
                        {videoUrl ? (
                            <div className="aspect-[16/9] rounded-2xl overflow-hidden border border-[color:var(--sp-border)] bg-[color:var(--sp-hover)]">
                                <video src={videoUrl} controls className="w-full h-full object-contain" />
                            </div>
                        ) : (
                            <div className="aspect-[16/9] rounded-2xl border border-[color:var(--sp-border)] bg-[color:var(--sp-hover)] flex items-center justify-center text-[color:var(--sp-muted)]">
                                {isGenerating ? (
                                    <div className="flex items-center gap-2 text-sm">
                                        <Loader2 size={18} className="animate-spin" />
                                        This may take a minute…
                                    </div>
                                ) : (
                                    <div className="text-sm">No output yet</div>
                                )}
                            </div>
                        )}
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}
