"use client";

import { useState } from "react";
import { UserPlus, Play, Download, AlertCircle, Image as ImageIcon, Upload } from "lucide-react";

const REGIONS = [
    "South Asia", "East Asia", "Europe", "Middle East & North Africa",
    "Sub-Saharan Africa", "Latin America", "North America",
    "Southeast Asia", "Oceania"
];
const SKIN_TONES = ["Light", "Fair", "Medium", "Olive", "Tan", "Brown", "Dark"];
const GENDERS = ["Female", "Male"];
const ANGLES = ["Front", "Back", "Left-Side", "Right-Side", "Three-quarter", "Full body"];

export default function GenerateModel() {
    const [dressImage, setDressImage] = useState<File | null>(null);
    const [dressPreview, setDressPreview] = useState<string | null>(null);
    const [gender, setGender] = useState("Female");
    const [skinTone, setSkinTone] = useState("Medium");
    const [region, setRegion] = useState("Europe");
    const [angle, setAngle] = useState("Front");
    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState<string | null>(null);
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
        if (!dressImage) {
            setError("Please upload a dress image.");
            return;
        }

        setIsGenerating(true);
        setError(null);
        setResult(null);

        try {
            const formData = new FormData();
            formData.append('type', 'pack'); // Use 'pack' type but without reference image
            formData.append('dressImage', dressImage);
            formData.append('gender', gender);
            formData.append('skinTone', skinTone);
            formData.append('region', region);
            formData.append('angle', angle);
            formData.append('background', 'Studio Grey');
            formData.append('aspectRatio', '1:1 (Square)');

            const response = await fetch('/api/generate-image', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            setResult(`data:${data.mimeType};base64,${data.image}`);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="p-6 md:p-8 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div className="space-y-4">
                        <label className="text-sm font-medium opacity-70 flex items-center gap-2">
                            <Upload size={16} /> Upload Garment Image
                        </label>
                        <div
                            className="aspect-[3/4] glass-panel border-2 border-dashed border-primary/30 flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer max-w-xs mx-auto"
                            onClick={() => document.getElementById('dress-upload-model')?.click()}
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
                                id="dress-upload-model"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium opacity-70">Gender</label>
                            <select value={gender} onChange={e => setGender(e.target.value)} className="w-full input-field">
                                {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium opacity-70">Skin Tone</label>
                            <select value={skinTone} onChange={e => setSkinTone(e.target.value)} className="w-full input-field">
                                {SKIN_TONES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium opacity-70">Region</label>
                            <select value={region} onChange={e => setRegion(e.target.value)} className="w-full input-field">
                                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium opacity-70">Angle</label>
                            <select value={angle} onChange={e => setAngle(e.target.value)} className="w-full input-field">
                                {ANGLES.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !dressImage}
                        className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isGenerating ? (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Generating Model...
                            </div>
                        ) : (
                            <>
                                <UserPlus size={20} /> Generate Model
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
                        <ImageIcon size={18} className="text-primary" /> Generated Result
                    </h3>
                    <div className="glass-panel aspect-[3/4] p-2 relative group">
                        {result ? (
                            <>
                                <img src={result} alt="Result" className="w-full h-full object-cover rounded-xl" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button className="p-3 bg-white rounded-full text-primary shadow-xl">
                                        <Download size={24} />
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center opacity-20">
                                {isGenerating ? (
                                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <ImageIcon size={64} className="mb-4" />
                                        <p>Generated model will appear here</p>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
