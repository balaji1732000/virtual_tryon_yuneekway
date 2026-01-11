"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Play, Download, AlertCircle, Image as ImageIcon } from "lucide-react";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";

const ANGLES = ["Front", "Back", "Left-Side", "Right-Side", "Full body"];
const ASPECT_RATIOS: { value: string; label: string }[] = [
    { value: "1:1", label: "1:1 (Square)" },
    { value: "2:3", label: "2:3 (Portrait)" },
    { value: "3:2", label: "3:2 (Landscape)" },
    { value: "3:4", label: "3:4 (Portrait)" },
    { value: "4:3", label: "4:3 (Landscape)" },
    { value: "9:16", label: "9:16 (Vertical)" },
    { value: "16:9", label: "16:9 (Widescreen)" },
    { value: "21:9", label: "21:9 (Ultra-wide)" },
];
const IMAGE_SIZES: { value: "1K" | "2K" | "4K"; label: string }[] = [
    { value: "1K", label: "1K" },
    { value: "2K", label: "2K" },
    { value: "4K", label: "4K" },
];
const GARMENT_TYPES = ["Top", "Bottom", "One-Piece"] as const;

export default function ProductPack() {
    const { activeProfile, setActiveProfile } = useAppStore();
    const [productId, setProductId] = useState("");
    const [title, setTitle] = useState("");
    const [frontImage, setFrontImage] = useState<File | null>(null);
    const [backImage, setBackImage] = useState<File | null>(null);
    const [selectedAngles, setSelectedAngles] = useState<string[]>(["Front", "Back"]);
    const [ratio, setRatio] = useState("1:1");
    const [imageSize, setImageSize] = useState<"1K" | "2K" | "4K">("1K");
    const [useCutout, setUseCutout] = useState(false);
    const [garmentType, setGarmentType] = useState<typeof GARMENT_TYPES[number]>("Top");
    const [additionalPrompt, setAdditionalPrompt] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [results, setResults] = useState<{ angle: string; image: string; storagePath?: string; outputId?: string }[]>([]);
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
            referenceImagePath: p.referenceImagePath || undefined,
        });
    };

    const handleToggleAngle = (angle: string) => {
        setSelectedAngles(prev =>
            prev.includes(angle) ? prev.filter(a => a !== angle) : [...prev, angle]
        );
    };

    async function parseJsonOrText(res: Response) {
        const ct = (res.headers.get("content-type") || "").toLowerCase();
        if (ct.includes("application/json")) return await res.json();
        const text = await res.text();
        return { error: text || `Request failed (${res.status})` };
    }

    async function uploadToUserUploads(file: File, userId: string, kind: string) {
        const supabase = createSupabaseBrowserClient();
        const ext = (file.type || "").includes("png") ? "png" : "jpg";
        const id =
            (globalThis.crypto && "randomUUID" in globalThis.crypto) ? globalThis.crypto.randomUUID() : Math.random().toString(36).slice(2);
        const objectPath = `${userId}/${id}_${kind}.${ext}`;
        const up = await supabase.storage.from("uploads").upload(objectPath, file, {
            contentType: file.type || "image/jpeg",
            upsert: true,
        });
        if (up.error) throw new Error(up.error.message);
        return { bucket: "uploads", path: objectPath };
    }

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
            const supabase = createSupabaseBrowserClient();
            const {
                data: { user },
                error: userErr
            } = await supabase.auth.getUser();
            if (userErr || !user) throw new Error("Not authenticated");

            // Upload garment images directly to Supabase Storage to avoid Vercel 413 limits.
            const frontRef = await uploadToUserUploads(frontImage, user.id, "garment_front");
            const backRef = backImage ? await uploadToUserUploads(backImage, user.id, "garment_back") : null;

            for (const angle of selectedAngles) {
                const useBack = angle.toLowerCase().includes("back") && backRef;
                const dressRef = useBack ? backRef : frontRef;
                const referenceRef = activeProfile.referenceImagePath
                    ? { bucket: "profiles", path: activeProfile.referenceImagePath }
                    : null;

                const response = await fetch('/api/generate-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'pack',
                        jobId: newJobId,
                        angle,
                        productId,
                        productTitle: title || "",
                        useCutout,
                        additionalPrompt: additionalPrompt.trim(),
                        skinTone: activeProfile.skinTone,
                        region: activeProfile.region,
                        background: activeProfile.background,
                        gender: activeProfile.gender,
                        aspectRatio: ratio,
                        dressRef,
                        referenceRef,
                        imageSize,
                        garmentType,
                    }),
                });

                const data = await parseJsonOrText(response);
                if (data?.error) throw new Error(data.error);

                const img = data.signedUrl || `data:${data.mimeType};base64,${data.image}`;
                setResults(prev => [...prev, { angle, image: img, storagePath: data.storagePath, outputId: data.outputId }]);
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
                <div className="alert-warn text-xs flex items-center gap-2">
                    <AlertCircle size={14} />
                    <span>No active profile selected. Choose one below (or create one in “Model Profiles”).</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1">
                    <CardHeader title="Inputs" subtitle="SKU + images" />
                    <CardBody className="space-y-4">
                        <div className="space-y-2">
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

                        <div className="space-y-1">
                            <label className="text-sm font-medium opacity-70">Model profile</label>
                            <select
                                value={activeProfile?.id || ""}
                                onChange={(e) => selectProfileById(e.target.value)}
                                className="w-full input-field text-sm"
                            >
                                <option value="">-- Select a profile --</option>
                                {profiles.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                            <div className="flex items-center justify-between text-xs text-[color:var(--sp-muted)] mt-1">
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
                                <label className="text-sm font-medium opacity-70">Product ID (SKU)</label>
                            <input
                                type="text"
                                value={productId}
                                onChange={e => setProductId(e.target.value)}
                                placeholder="e.g. SKU123"
                                    className="w-full input-field text-sm"
                            />
                        </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium opacity-70">Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                    placeholder="Optional"
                                    className="w-full input-field text-sm"
                            />
                        </div>
                    </div>

                        <div className="grid grid-cols-1 gap-3">
                            <div className="space-y-1">
                                <label className="text-sm font-medium opacity-70">
                                    {garmentType === "Bottom" ? "Bottom" : garmentType === "One-Piece" ? "One-Piece" : "Front"} view (required)
                                </label>
                                <input type="file" onChange={(e) => setFrontImage(e.target.files?.[0] || null)} className="w-full text-sm" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium opacity-70">Back view (optional)</label>
                                <input type="file" onChange={e => setBackImage(e.target.files?.[0] || null)} className="w-full text-sm" />
                            </div>
                        </div>
                    </CardBody>
                </Card>

                <Card className="lg:col-span-1">
                    <CardHeader title="Settings" subtitle="Angles + output" />
                    <CardBody className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium opacity-70">Angles to render</label>
                        <div className="flex flex-wrap gap-2">
                            {ANGLES.map(angle => (
                                <button
                                    key={angle}
                                    onClick={() => handleToggleAngle(angle)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                            selectedAngles.includes(angle)
                                                ? "bg-[color:var(--sp-primary)] text-[color:var(--sp-primary-text)] border-[color:var(--sp-primary)]"
                                                : "bg-[color:var(--sp-panel)] text-[color:var(--sp-text)] border-[color:var(--sp-border)] hover:bg-[color:var(--sp-hover)]"
                                        }`}
                                >
                                    {angle}
                                </button>
                            ))}
                        </div>
                    </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium opacity-70">Aspect ratio</label>
                            <select
                                value={ratio}
                                onChange={e => setRatio(e.target.value)}
                                className="w-full input-field text-sm"
                            >
                                {ASPECT_RATIOS.map((r) => (
                                    <option key={r.value} value={r.value}>
                                        {r.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium opacity-70">Resolution</label>
                            <select
                                value={imageSize}
                                onChange={(e) => setImageSize(e.target.value as any)}
                                className="w-full input-field text-sm"
                            >
                                {IMAGE_SIZES.map((s) => (
                                    <option key={s.value} value={s.value}>
                                        {s.label}
                                    </option>
                                ))}
                            </select>
                            <div className="text-xs text-[color:var(--sp-muted)]">
                                Higher resolutions are slower and cost more.
                            </div>
                        </div>

                        <label className="flex items-start gap-2 text-sm text-[color:var(--sp-text)]">
                            <input
                                type="checkbox"
                                checked={useCutout}
                                onChange={(e) => setUseCutout(e.target.checked)}
                                className="mt-1"
                            />
                            <span>
                                <span className="font-medium">Use cutout (better fit)</span>
                                <span className="block text-xs opacity-70">
                                    Use if the garment photo has a busy background or wrinkles. Improves fidelity.
                                </span>
                            </span>
                        </label>

                        <div className="space-y-1">
                            <label className="text-sm font-medium opacity-70">Additional instructions (optional)</label>
                            <textarea
                                value={additionalPrompt}
                                onChange={(e) => setAdditionalPrompt(e.target.value)}
                                placeholder="e.g., full body, arms at side, studio lighting, center subject, no accessories…"
                                className="w-full input-field text-sm"
                                rows={3}
                            />
                            <div className="text-xs text-[color:var(--sp-muted)]">
                                Applied to all selected angles for this generation.
                            </div>
                        </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !activeProfile}
                        className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isGenerating ? (
                            <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 spinner-primary rounded-full animate-spin" />
                                    Generating…
                            </div>
                        ) : (
                            <>
                                    <Play size={18} /> Generate set
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

                <Card className="lg:col-span-1">
                    <CardHeader
                        title="Outputs"
                        subtitle={jobId ? `Job: ${jobId}` : "Generated renders"}
                        right={results.length > 0 ? (
                            <button className="text-sm text-[color:var(--sp-muted)] hover:underline inline-flex items-center gap-1" disabled>
                                <Download size={16} /> ZIP (next)
                            </button>
                        ) : null}
                    />
                    <CardBody>
                        <div className="grid grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
                        {results.map((res, i) => (
                                <div key={i} className="group">
                                    <a href={res.image} target="_blank" rel="noreferrer" className="block">
                                        <div className="aspect-[3/4] rounded-xl overflow-hidden border border-[color:var(--sp-border)] bg-[color:var(--sp-hover)]">
                                            <img src={res.image} alt={res.angle} className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform" />
                                        </div>
                                    </a>
                                    <div className="mt-1 flex items-center justify-between gap-2">
                                        <div className="text-[11px] text-[color:var(--sp-muted)] truncate">{res.angle}</div>
                                        {res.outputId && jobId && (
                                            <a
                                                className="text-[11px] text-[color:var(--sp-text)] hover:underline"
                                                href={`/app/canvas?jobId=${encodeURIComponent(jobId)}&outputId=${encodeURIComponent(res.outputId)}`}
                                            >
                                                Edit
                                            </a>
                                        )}
                                    </div>
                            </div>
                        ))}

                        {isGenerating && results.length < selectedAngles.length && (
                                <div className="aspect-[3/4] rounded-xl border border-[color:var(--sp-border)] bg-[color:var(--sp-hover)] flex items-center justify-center">
                                    <div className="w-6 h-6 spinner-muted rounded-full animate-spin" />
                            </div>
                        )}

                        {results.length === 0 && !isGenerating && (
                                <div className="col-span-2 aspect-[3/2] rounded-xl border border-[color:var(--sp-border)] bg-[color:var(--sp-hover)] flex flex-col items-center justify-center text-[color:var(--sp-muted)]">
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
