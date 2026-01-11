"use client";

import { useState } from "react";
import { UserPlus, Download, AlertCircle, Image as ImageIcon, Upload } from "lucide-react";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const REGIONS = [
    "South Asia", "East Asia", "Europe", "Middle East & North Africa",
    "Sub-Saharan Africa", "Latin America", "North America",
    "Southeast Asia", "Oceania"
];
const SKIN_TONES = ["Light", "Fair", "Medium", "Olive", "Tan", "Brown", "Dark"];
const GENDERS = ["Female", "Male"];
const ANGLES = ["Front", "Back", "Left-Side", "Right-Side", "Full body"];
const GARMENT_TYPES = ["Top", "Bottom", "One-Piece"] as const;

export default function GenerateModel() {
    const [dressImage, setDressImage] = useState<File | null>(null);
    const [dressPreview, setDressPreview] = useState<string | null>(null);
    const [gender, setGender] = useState("Female");
    const [skinTone, setSkinTone] = useState("Medium");
    const [region, setRegion] = useState("Europe");
    const [angle, setAngle] = useState("Front");
    const [garmentType, setGarmentType] = useState<typeof GARMENT_TYPES[number]>("Top");
    const [additionalPrompt, setAdditionalPrompt] = useState("");
    const [imageSize, setImageSize] = useState<"1K" | "2K" | "4K">("1K");
    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [resultPath, setResultPath] = useState<string | null>(null);
    const [resultJobId, setResultJobId] = useState<string | null>(null);
    const [resultOutputId, setResultOutputId] = useState<string | null>(null);
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
        setResultPath(null);
        setResultJobId(null);
        setResultOutputId(null);

        try {
            const supabase = createSupabaseBrowserClient();
            const {
                data: { user },
                error: userErr
            } = await supabase.auth.getUser();
            if (userErr || !user) throw new Error("Not authenticated");

            const ext = (dressImage.type || "").includes("png") ? "png" : "jpg";
            const id =
                (globalThis.crypto && "randomUUID" in globalThis.crypto) ? globalThis.crypto.randomUUID() : Math.random().toString(36).slice(2);
            const objectPath = `${user.id}/${id}_model_generator_garment.${ext}`;
            const up = await supabase.storage.from("uploads").upload(objectPath, dressImage, {
                contentType: dressImage.type || "image/jpeg",
                upsert: true,
            });
            if (up.error) throw new Error(up.error.message);

            const jobId =
                (globalThis.crypto && "randomUUID" in globalThis.crypto) ? globalThis.crypto.randomUUID() : Math.random().toString(36).slice(2);

            const response = await fetch('/api/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'pack',
                    jobId,
                    angle,
                    productId: "",
                    productTitle: "",
                    useCutout: false,
                    additionalPrompt: additionalPrompt.trim(),
                    gender,
                    skinTone,
                    region,
                    background: 'Studio Grey',
                    aspectRatio: '1:1',
                    imageSize,
                    garmentType,
                    dressRef: { bucket: "uploads", path: objectPath },
                }),
            });

            const ct = (response.headers.get("content-type") || "").toLowerCase();
            const data = ct.includes("application/json") ? await response.json() : { error: await response.text() };
            if (!response.ok) throw new Error(data?.error || "Generation failed");

            setResult(data.signedUrl || `data:${data.mimeType};base64,${data.image}`);
            setResultPath(data.storagePath || null);
            setResultJobId(data.jobId || null);
            setResultOutputId(data.outputId || null);
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
                    <CardHeader
                        title="Garment image"
                        subtitle={`Upload the ${garmentType === "Bottom" ? "bottom" : garmentType === "One-Piece" ? "one-piece" : "top"} photo`}
                    />
                    <CardBody className="space-y-4">
                        <div className="space-y-2 mb-4">
                            <label className="text-sm font-medium opacity-70">Garment Type</label>
                            <div className="flex bg-[color:var(--sp-panel)] p-1 rounded-lg border border-[color:var(--sp-border)]">
                                {GARMENT_TYPES.map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setGarmentType(type)}
                                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                                            garmentType === type
                                                ? "bg-[color:var(--sp-surface)] text-[color:var(--sp-text)] shadow-sm"
                                                : "text-[color:var(--sp-muted)] hover:text-[color:var(--sp-text)]"
                                        }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div
                            className="aspect-[3/4] rounded-2xl border border-dashed border-[color:var(--sp-border)] bg-[color:var(--sp-hover)] flex items-center justify-center overflow-hidden cursor-pointer"
                            onClick={() => document.getElementById('dress-upload-model')?.click()}
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
                                <label className="text-sm font-medium opacity-70">Gender</label>
                                <select value={gender} onChange={e => setGender(e.target.value)} className="w-full input-field text-sm">
                                    {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium opacity-70">Skin tone</label>
                                <select value={skinTone} onChange={e => setSkinTone(e.target.value)} className="w-full input-field text-sm">
                                    {SKIN_TONES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium opacity-70">Region</label>
                                <select value={region} onChange={e => setRegion(e.target.value)} className="w-full input-field text-sm">
                                    {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium opacity-70">Angle</label>
                                <select value={angle} onChange={e => setAngle(e.target.value)} className="w-full input-field text-sm">
                                    {ANGLES.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium opacity-70">Resolution</label>
                            <select
                                value={imageSize}
                                onChange={(e) => setImageSize(e.target.value as any)}
                                className="w-full input-field text-sm"
                            >
                                <option value="1K">1K</option>
                                <option value="2K">2K</option>
                                <option value="4K">4K</option>
                            </select>
                            <div className="text-xs text-[color:var(--sp-muted)]">
                                Higher resolutions are slower and cost more.
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium opacity-70">Additional instructions (optional)</label>
                            <textarea
                                value={additionalPrompt}
                                onChange={(e) => setAdditionalPrompt(e.target.value)}
                                placeholder="e.g., full body, straight pose, studio lighting, center subject, no accessories…"
                                className="w-full input-field text-sm"
                                rows={3}
                            />
                            <div className="text-xs text-[color:var(--sp-muted)]">
                                Helps the model follow your pose/framing/lighting preferences.
                            </div>
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !dressImage}
                            className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isGenerating ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 spinner-primary rounded-full animate-spin" />
                                    Generating…
                                </div>
                            ) : (
                                <>
                                    <UserPlus size={18} /> Generate
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
                        subtitle="Generated model image"
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
                                <a className="text-sm text-[color:var(--sp-text)] hover:underline inline-flex items-center gap-1" href={result} download>
                                    <Download size={16} /> Download
                                </a>
                            </div>
                        ) : null}
                    />
                    <CardBody>
                        {result ? (
                            <div className="aspect-[3/4] rounded-2xl overflow-hidden border border-[color:var(--sp-border)] bg-[color:var(--sp-hover)]">
                                <img src={result} alt="Result" className="w-full h-full object-cover" />
                            </div>
                        ) : (
                            <div className="aspect-[3/4] rounded-2xl border border-[color:var(--sp-border)] bg-[color:var(--sp-hover)] flex items-center justify-center text-[color:var(--sp-muted)]">
                                <div className="text-sm">No output yet</div>
                            </div>
                        )}
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}
