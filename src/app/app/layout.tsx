"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { LayoutGrid, User, Package, RefreshCw, UserPlus, Video, Scissors, Clock, Sparkles, CreditCard, MessageSquare } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { FeedbackButton } from "@/components/FeedbackButton";
import { FeedbackModal } from "@/components/FeedbackModal";

const nav = [
  { href: "/app", label: "Dashboard", icon: LayoutGrid },
  { href: "/app/history", label: "History", icon: Clock },
  { href: "/app/canvas", label: "Magic Canvas", icon: Sparkles },
  { href: "/app/profiles", label: "Model Profiles", icon: User },
  { href: "/app/product-pack", label: "Product Pack", icon: Package },
  { href: "/app/try-on", label: "Virtual Try-On", icon: RefreshCw },
  { href: "/app/model-generator", label: "Model Generator", icon: UserPlus },
  { href: "/app/video", label: "Video", icon: Video },
  { href: "/app/extract-garment", label: "Extract Garment", icon: Scissors },
  { href: "/app/billing", label: "Billing", icon: CreditCard },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[280px_1fr]">
      <aside className="p-4 lg:p-6">
        <div className="glass-panel p-5">
          <div className="mb-5">
            <Link href="/app" className="inline-flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl border border-[color:var(--sp-border)] bg-[color:var(--sp-panel)] p-1.5 shadow-sm flex items-center justify-center">
                <Image
                  src="/YuneekwayAI-transparent.png"
                  alt="Yuneekwayai logo"
                  width={40}
                  height={40}
                  className="object-contain"
                  priority
                />
              </div>
              <div className="text-lg font-semibold tracking-tight">YUNEEKWAYAI</div>
            </Link>
          </div>

          <nav className="space-y-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[color:var(--sp-hover)] transition-colors text-sm"
              >
                <item.icon size={16} className="opacity-70" />
                <span>{item.label}</span>
              </Link>
            ))}
            
            {/* Feedback link */}
            <button
              onClick={() => setIsFeedbackModalOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[color:var(--sp-hover)] transition-colors text-sm text-left"
            >
              <MessageSquare size={16} className="opacity-70" />
              <span>Feedback</span>
            </button>
          </nav>

          <div className="mt-6 pt-6 border-t border-[color:var(--sp-border)] space-y-3">
            <ThemeToggle />
            <form action="/auth/logout" method="post">
              <button className="w-full btn-secondary">Log out</button>
            </form>
          </div>
        </div>
      </aside>

      <main className="p-4 lg:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Workspace</div>
            <div className="text-xs opacity-60">Your ecommerce assets</div>
          </div>
        </div>
        <div className="glass-panel p-6">{children}</div>
      </main>

      {/* Feedback System */}
      <FeedbackButton onOpen={() => setIsFeedbackModalOpen(true)} />
      <FeedbackModal isOpen={isFeedbackModalOpen} onClose={() => setIsFeedbackModalOpen(false)} />
    </div>
  );
}


