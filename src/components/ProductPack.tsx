"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { Upload, Package, Layers, Play, Download, CheckCircle, AlertCircle, Image as ImageIcon } from "lucide-react";

const ANGLES = ["Front", "Back", "Left-Side", "Right-Side", "Three-quarter", "Full body"];
const RATIOS = ["1:1 (Square)", "2:3 (Portrait)", "3:2 (Landscape)", "4:5 (Portrait)", "9:16 (Vertical)"];

export default function ProductPack() {
    const { activeProfile } = useAppStore();
    const [productId, setProductId] = useState("");
    const [title, setTitle] = useState("");
    const [frontImage, setFrontImage] = useState<File | null>(null);
    const [backImage, setBackImage] = useState<File | null>(null);
    const [selectedAngles, setSelectedAngles] = useState<string[]>(["Front", "Back"]);
    const [ratio, setRatio] = useState("1:1 (Square)");
    const [isGenerating, setIsGenerating] = useState(false);
    const [results, setResults] = useState<{ angle: string; image: string }[]>([]);
    const [error, setError] = useState<string | null>(null);

    const handleToggleAngle = (angle: string) => {
        setSelectedAngles(prev =>
            prev.includes(angle) ? prev.filter(a => a !== angle) : [...prev, angle]
        );
    };

    const handleGenerate = async () => {
        if (!activeProfile) {
            setError("Please create and save a model profile first.");
            return;
        }
        if (!productId || !frontImage) {
            setError("Please provide a Product ID and at least a front garment image.");
            return;
        }

        setIsGenerating(true);
        setError(null);
        setResults([]);

        try {
            for (const angle of selectedAngles) {
                const formData = new FormData();
                formData.append('type', 'pack');
                formData.append('angle', angle);
                formData.append('skinTone', activeProfile.skinTone);
                formData.append('region', activeProfile.region);
                formData.append('background', activeProfile.background);
                formData.append('gender', activeProfile.gender);
                formData.append('aspectRatio', ratio);

                // Use back image for back angle if available, otherwise front
                const garmentToUse = (angle.toLowerCase().includes('back') && backImage) ? backImage : frontImage;
                formData.append('dressImage', garmentToUse);

                if (activeProfile.referenceImage) {
                    // Convert base64 to blob
                    const res = await fetch(activeProfile.referenceImage);
                    const blob = await res.blob();
                    formData.append('referenceImage', blob, 'reference.jpg');
                }

                const response = await fetch('/api/generate-image', {
                    method: 'POST',
                    body: formData,
                });

                const data = await response.json();
                if (data.error) throw new Error(data.error);

                setResults(prev => [...prev, { angle, image: `data:${data.mimeType};base64,${data.image}` }]);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="p-6 md:p-8 space-y-8">
            {!activeProfile && (
                <div className="p-4 bg-secondary/10 border border-secondary/20 rounded-2xl flex items-center gap-3 text-secondary animate-fade-in">
                    <AlertCircle />
                    <p className="text-sm font-medium">No active profile found. Please set one up in the "Create Model Profile" tab.</p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium opacity-70">Product ID</label>
                            <input
                                type="text"
                                value={productId}
                                onChange={e => setProductId(e.target.value)}
                                placeholder="e.g. SKU123"
                                className="w-full input-field"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium opacity-70">Product Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="e.g. Floral Summer Dress"
                                className="w-full input-field"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium opacity-70">Front View (Required)</label>
                            <input
                                type="file"
                                onChange={e => setFrontImage(e.target.files?.[0] || null)}
                                className="w-full text-xs"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium opacity-70">Back View (Optional)</label>
                            <input
                                type="file"
                                onChange={e => setBackImage(e.target.files?.[0] || null)}
                                className="w-full text-xs"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium opacity-70">Angles to Render</label>
                        <div className="flex flex-wrap gap-2">
                            {ANGLES.map(angle => (
                                <button
                                    key={angle}
                                    onClick={() => handleToggleAngle(angle)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${selectedAngles.includes(angle)
                                        ? "bg-primary text-white"
                                        : "bg-white/10 hover:bg-white/20"
                                        }`}
                                >
                                    {angle}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium opacity-70">Aspect Ratio</label>
                        <select value={ratio} onChange={e => setRatio(e.target.value)} className="w-full input-field">
                            {RATIOS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !activeProfile}
                        className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isGenerating ? (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Generating Set...
                            </div>
                        ) : (
                            <>
                                <Play size={20} /> Generate Product Set
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
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold flex items-center gap-2">
                            <Layers size={18} className="text-primary" /> Generated Renders
                        </h3>
                        {results.length > 0 && (
                            <button className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
                                <Download size={14} /> Download ZIP
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {results.map((res, i) => (
                            <div key={i} className="glass-panel p-2 space-y-2 group">
                                <div className="aspect-[3/4] rounded-lg overflow-hidden relative">
                                    <img src={res.image} alt={res.angle} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button className="p-2 bg-white rounded-full text-primary">
                                            <Download size={16} />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-[10px] font-medium text-center opacity-70">{res.angle}</p>
                            </div>
                        ))}
                        {isGenerating && results.length < selectedAngles.length && (
                            <div className="glass-panel aspect-[3/4] flex items-center justify-center">
                                <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                            </div>
                        )}
                        {results.length === 0 && !isGenerating && (
                            <div className="col-span-2 aspect-[3/2] flex flex-col items-center justify-center opacity-30">
                                <ImageIcon size={48} className="mb-2" />
                                <p className="text-sm">Renders will appear here</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
