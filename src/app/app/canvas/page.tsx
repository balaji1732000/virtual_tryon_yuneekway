import MagicCanvas from "@/components/MagicCanvas";

export default function CanvasPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Magic Canvas</h1>
      <p className="text-sm opacity-70">Human-in-the-loop editing with masking + chat. Every version is saved to History.</p>
      <MagicCanvas />
    </div>
  );
}





