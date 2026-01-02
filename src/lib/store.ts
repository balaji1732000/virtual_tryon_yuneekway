import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ModelProfile {
    id: string;
    name: string;
    referenceImage?: string; // Base64
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
