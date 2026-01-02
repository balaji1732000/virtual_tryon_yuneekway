"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { Upload, CheckCircle } from "lucide-react";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";

const REGIONS = [
    "South Asia", "East Asia", "Europe", "Middle East & North Africa",
    "Sub-Saharan Africa", "Latin America", "North America",
    "Southeast Asia", "Oceania"
];

const SKIN_TONES = ["Light", "Fair", "Medium", "Olive", "Tan", "Brown", "Dark"];
const GENDERS = ["Female", "Male"];
const BACKGROUND_STYLES = [
    "Studio Grey", "White Seamless", "Light Grey", "Pastel"
];

export default function ProfileCreator() {
    const { activeProfile, setActiveProfile } = useAppStore();
    const [name, setName] = useState(activeProfile?.name || "");
    const [gender, setGender] = useState(activeProfile?.gender || "Female");
    const [skinTone, setSkinTone] = useState(activeProfile?.skinTone || "Medium");
    const [region, setRegion] = useState(activeProfile?.region || "Europe");
    const [background, setBackground] = useState(activeProfile?.background || "Studio Grey");
    const [image, setImage] = useState<string | null>(activeProfile?.referenceImage || null);
    const [file, setFile] = useState<File | null>(null);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const activeId = activeProfile?.id || null;

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const loadProfiles = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/profiles");
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || "Failed to load profiles");
            setProfiles(json.profiles || []);
        } catch (e: any) {
            setError(e?.message || "Failed to load profiles");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProfiles();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSelectProfile = (p: any) => {
        setActiveProfile({
            id: p.id,
            name: p.name,
            gender: p.gender,
            skinTone: p.skinTone,
            region: p.region,
            background: p.background,
            referenceImage: p.referenceImageUrl || undefined,
        });
        setName(p.name);
        setGender(p.gender);
        setSkinTone(p.skinTone);
        setRegion(p.region);
        setBackground(p.background);
        setImage(p.referenceImageUrl || null);
        setFile(null);
    };

    const handleCreateProfile = async () => {
        if (!name || (!file && !image)) {
            setError("Please provide a name and a reference image.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const fd = new FormData();
            fd.append("name", name);
            fd.append("gender", gender);
            fd.append("skinTone", skinTone);
            fd.append("region", region);
            fd.append("background", background);
            if (file) {
                fd.append("referenceImage", file);
            } else if (image && image.startsWith("data:")) {
                // Convert existing preview (data URL) into a file so we can persist to Supabase
                const res = await fetch(image);
                const blob = await res.blob();
                fd.append("referenceImage", blob, "reference.jpg");
            }

            const res = await fetch("/api/profiles", { method: "POST", body: fd });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || "Failed to create profile");

            // Refresh list and set active to new profile
            await loadProfiles();
            if (json.profile) handleSelectProfile(json.profile);
        } catch (e: any) {
            setError(e?.message || "Failed to create profile");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader title="Model Profiles" subtitle="Create a consistent identity for multi-angle generation." />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                    <CardHeader title="Profile details" subtitle="Name + styling context" right={
                        <button
                            type="button"
                            onClick={loadProfiles}
                            className="text-sm text-slate-700 hover:underline disabled:opacity-50"
                            disabled={loading}
                        >
                            Refresh
                        </button>
                    } />
                    <CardBody className="space-y-4">
                        {error && (
                            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                                {error}
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700">Existing profiles</label>
                            <select
                                value={activeId || ""}
                                onChange={(e) => {
                                    const id = e.target.value;
                                    const p = profiles.find((x) => x.id === id);
                                    if (p) handleSelectProfile(p);
                                }}
                                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-4 focus:ring-black/10"
                            >
                                <option value="">-- Select a profile --</option>
                                {profiles.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                            <div className="text-xs text-slate-500 mt-1">
                                Profiles are stored in Supabase and can be reused across sessions.
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700">Profile name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Summer Collection Model"
                                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-4 focus:ring-black/10"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">Gender</label>
                                <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-4 focus:ring-black/10">
                                    {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">Skin tone</label>
                                <select value={skinTone} onChange={(e) => setSkinTone(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-4 focus:ring-black/10">
                                    {SKIN_TONES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">Region (styling context)</label>
                                <select value={region} onChange={(e) => setRegion(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-4 focus:ring-black/10">
                                    {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">Background</label>
                                <select value={background} onChange={(e) => setBackground(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-4 focus:ring-black/10">
                                    {BACKGROUND_STYLES.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>
                        </div>

                        <button
                            onClick={handleCreateProfile}
                            disabled={loading || (!file && !image)}
                            className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <CheckCircle size={18} /> Save profile to workspace
                        </button>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader title="Reference image" subtitle="Used for identity consistency" />
                    <CardBody className="space-y-3">
                        <div
                            className="aspect-[3/4] rounded-2xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden cursor-pointer"
                            onClick={() => document.getElementById('profile-upload')?.click()}
                        >
                            {image ? (
                                <img src={image} alt="Reference" className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-center p-6 text-slate-500">
                                    <Upload size={42} className="mx-auto mb-2 opacity-70" />
                                    <div className="text-sm">Click to upload</div>
                                </div>
                            )}
                            <input
                                id="profile-upload"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleImageUpload}
                            />
                        </div>
                        <p className="text-xs text-slate-500">
                            Tip: use a clear, face-forward photo. Hair will be preserved across angles.
                        </p>
                    </CardBody>
                </Card>
            </div>

            {activeProfile && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle size={14} />
                    <span>Active profile: <b>{activeProfile.name}</b> ({activeProfile.gender}, {activeProfile.skinTone}, {activeProfile.region})</span>
                </div>
            )}
        </div>
    );
}
