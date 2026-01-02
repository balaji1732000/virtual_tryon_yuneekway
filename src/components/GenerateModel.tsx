"use client";

import { useState } from "react";
import { UserPlus, Download, AlertCircle, Image as ImageIcon, Upload } from "lucide-react";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";

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

            setResult(data.signedUrl || `data:${data.mimeType};base64,${data.image}`);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader title="Model Generator" subtitle="Generate a model wearing your garment (no reference identity)." />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card>
                    <CardHeader title="Garment image" subtitle="Upload the product photo" />
                    <CardBody className="space-y-4">
                        <div
                            className="aspect-[3/4] rounded-2xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden cursor-pointer"
                            onClick={() => document.getElementById('dress-upload-model')?.click()}
                        >
                            {dressPreview ? (
                                <img src={dressPreview} alt="Dress" className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-center p-6 text-slate-500">
                                    <ImageIcon size={42} className="mx-auto mb-2 opacity-70" />
                                    <div className="text-sm">Click to upload</div>
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
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader title="Settings" subtitle="Gender / tone / region / angle" />
                    <CardBody className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">Gender</label>
                                <select value={gender} onChange={e => setGender(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-4 focus:ring-black/10">
                                    {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">Skin tone</label>
                                <select value={skinTone} onChange={e => setSkinTone(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-4 focus:ring-black/10">
                                    {SKIN_TONES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">Region</label>
                                <select value={region} onChange={e => setRegion(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-4 focus:ring-black/10">
                                    {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">Angle</label>
                                <select value={angle} onChange={e => setAngle(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-4 focus:ring-black/10">
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
                                    Generating…
                                </div>
                            ) : (
                                <>
                                    <UserPlus size={18} /> Generate
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

                <Card>
                    <CardHeader
                        title="Result"
                        subtitle="Generated model image"
                        right={result ? (
                            <a className="text-sm text-slate-700 hover:underline inline-flex items-center gap-1" href={result} download>
                                <Download size={16} /> Download
                            </a>
                        ) : null}
                    />
                    <CardBody>
                        {result ? (
                            <div className="aspect-[3/4] rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
                                <img src={result} alt="Result" className="w-full h-full object-cover" />
                            </div>
                        ) : (
                            <div className="aspect-[3/4] rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400">
                                <div className="text-sm">No output yet</div>
                            </div>
                        )}
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}
