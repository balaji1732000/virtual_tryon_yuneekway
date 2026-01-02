import type { ReactNode } from "react";
import Link from "next/link";
import { LayoutGrid, User, Package, RefreshCw, UserPlus, Video, Scissors, Clock } from "lucide-react";

const nav = [
  { href: "/app", label: "Dashboard", icon: LayoutGrid },
  { href: "/app/history", label: "History", icon: Clock },
  { href: "/app/profiles", label: "Model Profiles", icon: User },
  { href: "/app/product-pack", label: "Product Pack", icon: Package },
  { href: "/app/try-on", label: "Virtual Try-On", icon: RefreshCw },
  { href: "/app/model-generator", label: "Model Generator", icon: UserPlus },
  { href: "/app/video", label: "Video", icon: Video },
  { href: "/app/extract-garment", label: "Extract Garment", icon: Scissors },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[280px_1fr]">
      <aside className="p-4 lg:p-6">
        <div className="glass-panel p-5">
          <div className="mb-5">
            <div className="text-lg font-semibold tracking-tight">Yuneekwayai</div>
            <div className="text-xs opacity-70">Powered by Nano Banana</div>
          </div>

          <nav className="space-y-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-black/[0.03] transition-colors text-sm"
              >
                <item.icon size={16} className="opacity-70" />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="mt-6 pt-6 border-t border-black/5">
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
    </div>
  );
}


