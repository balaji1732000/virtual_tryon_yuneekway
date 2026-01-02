import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "StyleCraft Studio - Virtual Try-On",
  description: "Experience the future of fashion with AI-powered virtual try-ons",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <main className="min-h-screen p-4 md:p-8 flex flex-col items-center">
          <div className="w-full max-w-6xl space-y-8">
            <header className="glass-panel p-8 text-center animate-fade-in">
              <h1 className="text-4xl md:text-6xl font-bold gradient-text mb-2">
                ✨ StyleCraft Studio
              </h1>
              <p className="text-lg md:text-xl opacity-80 font-light">
                Experience the future of fashion with AI-powered virtual try-ons
              </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="glass-panel p-6 text-center hover:scale-105 transition-transform">
                <div className="text-4xl mb-4">👗</div>
                <h3 className="text-xl font-semibold mb-2">Virtual Try-On</h3>
                <p className="text-sm opacity-70">See how any dress looks on your model with realistic AI visualization</p>
              </div>
              <div className="glass-panel p-6 text-center hover:scale-105 transition-transform">
                <div className="text-4xl mb-4">🎨</div>
                <h3 className="text-xl font-semibold mb-2">Model Generation</h3>
                <p className="text-sm opacity-70">Create custom models with different skin tones and poses for your dresses</p>
              </div>
              <div className="glass-panel p-6 text-center hover:scale-105 transition-transform">
                <div className="text-4xl mb-4">⚡</div>
                <h3 className="text-xl font-semibold mb-2">Instant Results</h3>
                <p className="text-sm opacity-70">Get high-quality, professional-grade images in seconds</p>
              </div>
            </div>

            {children}

            <footer className="glass-panel p-6 text-center text-sm opacity-60">
              <p>© 2026 StyleCraft Studio. Powered by Gemini AI.</p>
            </footer>
          </div>
        </main>
      </body>
    </html>
  );
}
