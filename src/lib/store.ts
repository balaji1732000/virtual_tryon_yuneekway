import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ModelProfile {
    id: string;
    name: string;
    // Short-lived signed URL for display (may expire)
    referenceImage?: string;
    // Storage path for the profile image (stable; preferred for server-side usage)
    referenceImagePath?: string;
    skinTone: string;
    region: string;
    gender: string;
    background: string;
}

interface AppState {
    activeProfile: ModelProfile | null;
    setActiveProfile: (profile: ModelProfile) => void;
    clearActiveProfile: () => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            activeProfile: null,
            setActiveProfile: (profile) => set({ activeProfile: profile }),
            clearActiveProfile: () => set({ activeProfile: null }),
        }),
        {
            name: 'stylecraft-storage',
        }
    )
);
