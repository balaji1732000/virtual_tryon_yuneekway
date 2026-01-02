import type { ReactNode } from "react";
import Link from "next/link";

const nav = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/profiles", label: "Model Profiles" },
  { href: "/app/product-pack", label: "Product Pack" },
  { href: "/app/try-on", label: "Virtual Try-On" },
  { href: "/app/model-generator", label: "Model Generator" },
  { href: "/app/video", label: "Video" },
  { href: "/app/extract-garment", label: "Extract Garment" },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[280px_1fr]">
      <aside className="glass-panel m-4 p-4 lg:m-6 lg:p-6">
        <div className="mb-6">
          <div className="text-lg font-semibold">SellerPic Style SaaS</div>
          <div className="text-xs opacity-70">Nano Banana powered</div>
        </div>

        <nav className="space-y-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-2 rounded-xl hover:bg-white/10 transition-colors text-sm"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-6 pt-6 border-t border-white/10">
          <form action="/auth/logout" method="post">
            <button className="w-full btn-secondary">Log out</button>
          </form>
        </div>
      </aside>

      <main className="p-4 lg:p-6">
        <div className="glass-panel p-6">{children}</div>
      </main>
    </div>
  );
}


