"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { Upload, CheckCircle, User, MapPin, Palette, Image as ImageIcon } from "lucide-react";

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

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = () => {
        if (!name || !image) {
            alert("Please provide a name and a reference image.");
            return;
        }

        setActiveProfile({
            id: activeProfile?.id || Math.random().toString(36).substr(2, 9),
            name,
            gender,
            skinTone,
            region,
            background,
            referenceImage: image,
        });
    };

    return (
        <div className="p-6 md:p-8 space-y-8">
            <div className="flex flex-col md:flex-row gap-8">
                <div className="flex-1 space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium opacity-70 flex items-center gap-2">
                            <User size={16} /> Profile Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Summer Collection Model"
                            className="w-full input-field"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium opacity-70 flex items-center gap-2">
                                <User size={16} /> Gender
                            </label>
                            <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full input-field">
                                {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium opacity-70 flex items-center gap-2">
                                <Palette size={16} /> Skin Tone
                            </label>
                            <select value={skinTone} onChange={(e) => setSkinTone(e.target.value)} className="w-full input-field">
                                {SKIN_TONES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium opacity-70 flex items-center gap-2">
                                <MapPin size={16} /> Region Context
                            </label>
                            <select value={region} onChange={(e) => setRegion(e.target.value)} className="w-full input-field">
                                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium opacity-70 flex items-center gap-2">
                                <ImageIcon size={16} /> Background
                            </label>
                            <select value={background} onChange={(e) => setBackground(e.target.value)} className="w-full input-field">
                                {BACKGROUND_STYLES.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                    </div>

                    <button onClick={handleSave} className="w-full btn-primary flex items-center justify-center gap-2">
                        <CheckCircle size={20} /> Save Active Profile
                    </button>
                </div>

                <div className="w-full md:w-80 space-y-4">
                    <label className="text-sm font-medium opacity-70 block">Reference Model Image</label>
                    <div
                        className="aspect-[3/4] glass-panel border-2 border-dashed border-primary/30 flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer"
                        onClick={() => document.getElementById('profile-upload')?.click()}
                    >
                        {image ? (
                            <img src={image} alt="Reference" className="w-full h-full object-cover" />
                        ) : (
                            <div className="text-center p-4">
                                <Upload size={48} className="mx-auto mb-2 opacity-30 group-hover:opacity-100 transition-opacity" />
                                <p className="text-sm opacity-50">Click to upload reference photo</p>
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
                    <p className="text-xs opacity-50 text-center italic">
                        💡 Use a clear, face-forward photo for best results.
                    </p>
                </div>
            </div>

            {activeProfile && (
                <div className="p-4 bg-accent/10 border border-accent/20 rounded-2xl flex items-center gap-3 animate-fade-in">
                    <CheckCircle className="text-accent" />
                    <div>
                        <p className="text-sm font-semibold">Active Profile: {activeProfile.name}</p>
                        <p className="text-xs opacity-70">{activeProfile.gender}, {activeProfile.skinTone} skin, {activeProfile.region}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
