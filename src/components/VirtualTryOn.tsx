"use client";

import { useState } from "react";
import { Upload, RefreshCw, Play, Download, AlertCircle, Image as ImageIcon } from "lucide-react";

export default function VirtualTryOn() {
    const [modelImage, setModelImage] = useState<File | null>(null);
    const [dressImage, setDressImage] = useState<File | null>(null);
    const [modelPreview, setModelPreview] = useState<string | null>(null);
    const [dressPreview, setDressPreview] = useState<string | null>(null);
    const [additionalPrompt, setAdditionalPrompt] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState<string | null>(null);
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
            if (data.error) throw new Error(data.error);

            setResult(data.signedUrl || `data:${data.mimeType};base64,${data.image}`);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="p-6 md:p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {/* Model Upload */}
                <div className="space-y-4">
                    <label className="text-sm font-medium opacity-70 flex items-center gap-2">
                        <Upload size={16} /> 1. Upload Model Image
                    </label>
                    <div
                        className="aspect-[3/4] glass-panel border-2 border-dashed border-primary/30 flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer"
                        onClick={() => document.getElementById('model-upload')?.click()}
                    >
                        {modelPreview ? (
                            <img src={modelPreview} alt="Model" className="w-full h-full object-cover" />
                        ) : (
                            <div className="text-center p-4">
                                <ImageIcon size={48} className="mx-auto mb-2 opacity-30 group-hover:opacity-100 transition-opacity" />
                                <p className="text-sm opacity-50">Upload model photo</p>
                            </div>
                        )}
                        <input
                            id="model-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'model')}
                        />
                    </div>
                </div>

                {/* Dress Upload */}
                <div className="space-y-4">
                    <label className="text-sm font-medium opacity-70 flex items-center gap-2">
                        <Upload size={16} /> 2. Upload Dress Image
                    </label>
                    <div
                        className="aspect-[3/4] glass-panel border-2 border-dashed border-primary/30 flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer"
                        onClick={() => document.getElementById('dress-upload')?.click()}
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
                            id="dress-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'dress')}
                        />
                    </div>
                </div>

                {/* Controls & Result */}
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium opacity-70">Additional Instructions</label>
                        <textarea
                            value={additionalPrompt}
                            onChange={e => setAdditionalPrompt(e.target.value)}
                            placeholder="e.g. Make the dress fit tighter, change background to beach..."
                            className="w-full input-field min-h-[100px] resize-none"
                        />
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !modelImage || !dressImage}
                        className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isGenerating ? (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Processing...
                            </div>
                        ) : (
                            <>
                                <RefreshCw size={20} /> Generate Try-On
                            </>
                        )}
                    </button>

                    {error && (
                        <div className="p-3 bg-secondary/10 border border-secondary/20 rounded-xl text-secondary text-xs flex items-center gap-2">
                            <AlertCircle size={14} /> {error}
                        </div>
                    )}

                    {result && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="aspect-[3/4] glass-panel p-2">
                                <img src={result} alt="Result" className="w-full h-full object-cover rounded-xl" />
                            </div>
                            <button className="w-full btn-secondary flex items-center justify-center gap-2">
                                <Download size={18} /> Download Result
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
