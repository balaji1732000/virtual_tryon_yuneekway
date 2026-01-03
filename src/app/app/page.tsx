import Link from "next/link";

export default function AppHome() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm opacity-70">Pick a tool to start generating ecommerce assets.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link className="glass-panel p-5 hover:scale-[1.01] transition-transform" href="/app/product-pack">
          <div className="font-semibold">Product Pack</div>
          <div className="text-sm opacity-70">Multi-angle generation + ZIP export</div>
        </Link>
        <Link className="glass-panel p-5 hover:scale-[1.01] transition-transform" href="/app/try-on">
          <div className="font-semibold">Virtual Try-On</div>
          <div className="text-sm opacity-70">Model + garment transformation</div>
        </Link>
        <Link className="glass-panel p-5 hover:scale-[1.01] transition-transform" href="/app/model-generator">
          <div className="font-semibold">Model Generator</div>
          <div className="text-sm opacity-70">Single + batch context-rich</div>
        </Link>
        <Link className="glass-panel p-5 hover:scale-[1.01] transition-transform" href="/app/video">
          <div className="font-semibold">Video</div>
          <div className="text-sm opacity-70">Async operation + polling</div>
        </Link>
        <Link className="glass-panel p-5 hover:scale-[1.01] transition-transform" href="/app/extract-garment">
          <div className="font-semibold">Extract Garment</div>
          <div className="text-sm opacity-70">Create transparent PNG + mask</div>
        </Link>
        <Link className="glass-panel p-5 hover:scale-[1.01] transition-transform" href="/app/profiles">
          <div className="font-semibold">Model Profiles</div>
          <div className="text-sm opacity-70">Reference identity + consistent renders</div>
        </Link>
      </div>
    </div>
  );
}



