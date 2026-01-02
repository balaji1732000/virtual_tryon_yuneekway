"use client";

import { useState, useEffect } from "react";
import { Video, Play, Download, AlertCircle, Image as ImageIcon, Loader2 } from "lucide-react";

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
        <div className="p-6 md:p-8 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div className="space-y-4">
                        <label className="text-sm font-medium opacity-70 flex items-center gap-2">
                            <ImageIcon size={16} /> Upload Garment Image
                        </label>
                        <div
                            className="aspect-[3/4] glass-panel border-2 border-dashed border-primary/30 flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer max-w-xs mx-auto"
                            onClick={() => document.getElementById('dress-upload-video')?.click()}
                        >
                            {dressPreview ? (
                                <img src={dressPreview} alt="Dress" className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-center p-4">
                                    <ImageIcon size={48} className="mx-auto mb-2 opacity-30 group-hover:opacity-100 transition-opacity" />
                                    <p className="text-sm opacity-50">Upload dress photo</p>
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
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium opacity-70">Video Prompt</label>
                        <textarea
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            placeholder="e.g. A cinematic fashion video of a model walking in a garden wearing this dress, soft sunlight, 4k..."
                            className="w-full input-field min-h-[120px] resize-none"
                        />
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !dressImage || !prompt}
                        className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isGenerating ? (
                            <div className="flex items-center gap-2">
                                <Loader2 size={20} className="animate-spin" />
                                {operationId ? "Generating Video..." : "Starting Generation..."}
                            </div>
                        ) : (
                            <>
                                <Video size={20} /> Generate Fashion Video
                            </>
                        )}
                    </button>

                    {error && (
                        <div className="p-3 bg-secondary/10 border border-secondary/20 rounded-xl text-secondary text-xs flex items-center gap-2">
                            <AlertCircle size={14} /> {error}
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Video size={18} className="text-primary" /> Generated Video
                    </h3>
                    <div className="glass-panel aspect-[16/9] p-2 relative group flex items-center justify-center overflow-hidden">
                        {videoUrl ? (
                            <video
                                src={videoUrl}
                                controls
                                className="w-full h-full object-contain rounded-xl"
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center opacity-20">
                                {isGenerating ? (
                                    <div className="flex flex-col items-center gap-4">
                                        <Loader2 size={48} className="animate-spin text-primary" />
                                        <p className="text-sm animate-pulse">This may take a minute or two...</p>
                                    </div>
                                ) : (
                                    <>
                                        <Video size={64} className="mb-4" />
                                        <p>Generated video will appear here</p>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                    {videoUrl && (
                        <button className="w-full btn-secondary flex items-center justify-center gap-2">
                            <Download size={18} /> Download Video
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
