"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { Play, Download, AlertCircle, Image as ImageIcon } from "lucide-react";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";

const ANGLES = ["Front", "Back", "Left-Side", "Right-Side", "Three-quarter", "Full body"];
const RATIOS = ["1:1 (Square)", "2:3 (Portrait)", "3:2 (Landscape)", "4:5 (Portrait)", "9:16 (Vertical)"];

export default function ProductPack() {
    const { activeProfile, setActiveProfile } = useAppStore();
    const [productId, setProductId] = useState("");
    const [title, setTitle] = useState("");
    const [frontImage, setFrontImage] = useState<File | null>(null);
    const [backImage, setBackImage] = useState<File | null>(null);
    const [selectedAngles, setSelectedAngles] = useState<string[]>(["Front", "Back"]);
    const [ratio, setRatio] = useState("1:1 (Square)");
    const [isGenerating, setIsGenerating] = useState(false);
    const [results, setResults] = useState<{ angle: string; image: string; storagePath?: string }[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [jobId, setJobId] = useState<string | null>(null);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [profilesLoading, setProfilesLoading] = useState(false);

    const loadProfiles = async () => {
        setProfilesLoading(true);
        try {
            const res = await fetch("/api/profiles");
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || "Failed to load profiles");
            setProfiles(json.profiles || []);
        } catch (e: any) {
            // keep silent here; we already show errors on generate
        } finally {
            setProfilesLoading(false);
        }
    };

    useEffect(() => {
        loadProfiles();
    }, []);

    // Auto-select first available profile if none is active yet
    useEffect(() => {
        if (!activeProfile && profiles.length > 0) {
            selectProfileById(profiles[0].id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profiles.length]);

    const selectProfileById = (id: string) => {
        const p = profiles.find((x) => x.id === id);
        if (!p) return;
        setActiveProfile({
            id: p.id,
            name: p.name,
            gender: p.gender,
            skinTone: p.skinTone,
            region: p.region,
            background: p.background,
            referenceImage: p.referenceImageUrl || undefined,
        });
    };

    const handleToggleAngle = (angle: string) => {
        setSelectedAngles(prev =>
            prev.includes(angle) ? prev.filter(a => a !== angle) : [...prev, angle]
        );
    };

    const handleGenerate = async () => {
        if (!activeProfile) {
            setError("Please select a model profile first.");
            return;
        }
        if (!productId || !frontImage) {
            setError("Please provide a Product ID and at least a front garment image.");
            return;
        }

        setIsGenerating(true);
        setError(null);
        setResults([]);
        const newJobId = (globalThis.crypto && "randomUUID" in globalThis.crypto) ? globalThis.crypto.randomUUID() : Math.random().toString(36).slice(2);
        setJobId(newJobId);

        try {
            for (const angle of selectedAngles) {
                const formData = new FormData();
                formData.append('type', 'pack');
                formData.append('jobId', newJobId);
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

                const img = data.signedUrl || `data:${data.mimeType};base64,${data.image}`;
                setResults(prev => [...prev, { angle, image: img, storagePath: data.storagePath }]);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Product Pack"
                subtitle="Generate a consistent multi-angle set using your active model profile."
            />

            {!activeProfile && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-center gap-2">
                    <AlertCircle size={14} />
                    <span>No active profile selected. Choose one below (or create one in “Model Profiles”).</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1">
                    <CardHeader title="Inputs" subtitle="SKU + images" />
                    <CardBody className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700">Model profile</label>
                            <select
                                value={activeProfile?.id || ""}
                                onChange={(e) => selectProfileById(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-4 focus:ring-black/10"
                            >
                                <option value="">-- Select a profile --</option>
                                {profiles.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                            <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                                <span>{profiles.length} profile(s)</span>
                                <div className="flex items-center gap-3">
                                    <a href="/app/profiles" className="hover:underline">Create new</a>
                                    <button type="button" className="hover:underline" onClick={loadProfiles} disabled={profilesLoading}>
                                        Refresh
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">Product ID (SKU)</label>
                                <input
                                    type="text"
                                    value={productId}
                                    onChange={e => setProductId(e.target.value)}
                                    placeholder="e.g. SKU123"
                                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-4 focus:ring-black/10"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="Optional"
                                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-4 focus:ring-black/10"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">Front view (required)</label>
                                <input type="file" onChange={e => setFrontImage(e.target.files?.[0] || null)} className="w-full text-sm" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">Back view (optional)</label>
                                <input type="file" onChange={e => setBackImage(e.target.files?.[0] || null)} className="w-full text-sm" />
                            </div>
                        </div>
                    </CardBody>
                </Card>

                <Card className="lg:col-span-1">
                    <CardHeader title="Settings" subtitle="Angles + ratio" />
                    <CardBody className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Angles to render</label>
                            <div className="flex flex-wrap gap-2">
                                {ANGLES.map(angle => (
                                    <button
                                        key={angle}
                                        onClick={() => handleToggleAngle(angle)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${selectedAngles.includes(angle)
                                            ? "bg-black text-white border-black"
                                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                            }`}
                                    >
                                        {angle}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700">Aspect ratio</label>
                            <select
                                value={ratio}
                                onChange={e => setRatio(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-4 focus:ring-black/10"
                            >
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
                                    Generating…
                                </div>
                            ) : (
                                <>
                                    <Play size={18} /> Generate set
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

                <Card className="lg:col-span-1">
                    <CardHeader
                        title="Outputs"
                        subtitle={jobId ? `Job: ${jobId}` : "Generated renders"}
                        right={results.length > 0 ? (
                            <button className="text-sm text-slate-700 hover:underline inline-flex items-center gap-1" disabled>
                                <Download size={16} /> ZIP (next)
                            </button>
                        ) : null}
                    />
                    <CardBody>
                        <div className="grid grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
                            {results.map((res, i) => (
                                <div key={i} className="group">
                                    <a href={res.image} target="_blank" rel="noreferrer" className="block">
                                        <div className="aspect-[3/4] rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                                            <img src={res.image} alt={res.angle} className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform" />
                                        </div>
                                    </a>
                                    <div className="mt-1 flex items-center justify-between gap-2">
                                        <div className="text-[11px] text-slate-600 truncate">{res.angle}</div>
                                        {res.storagePath && (
                                            <a
                                                className="text-[11px] text-slate-700 hover:underline"
                                                href={`/app/canvas?fromBucket=${encodeURIComponent("outputs")}&fromPath=${encodeURIComponent(res.storagePath)}&title=${encodeURIComponent("Product Pack")}`}
                                            >
                                                Edit
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {isGenerating && results.length < selectedAngles.length && (
                                <div className="aspect-[3/4] rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center">
                                    <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin" />
                                </div>
                            )}

                            {results.length === 0 && !isGenerating && (
                                <div className="col-span-2 aspect-[3/2] rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400">
                                    <ImageIcon size={42} className="mb-2" />
                                    <div className="text-sm">Renders will appear here</div>
                                </div>
                            )}
                        </div>
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}
