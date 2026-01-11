export function toNiceToolName(jobType?: string | null) {
  const t = String(jobType || "").trim();
  if (!t) return "Creation";
  const map: Record<string, string> = {
    product_pack: "Product Pack",
    tryon_image: "Try-On",
    extract_garment: "Extract Garment",
    model_generator: "Model Generator",
    canvas_edit: "Magic Canvas",
  };
  if (map[t]) return map[t];
  return t.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export function formatShortTimestamp(d: Date) {
  // Example: "Jan 3 10:52"
  const s = d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return s.replace(",", "");
}

export function angleSummary(angles: Array<string | null | undefined>) {
  const cleaned = angles
    .map((a) => (a || "").trim())
    .filter(Boolean)
    .map((a) => a.replaceAll("_", " "));
  const set = new Set(cleaned.map((a) => a.toLowerCase()));
  const hasFront = set.has("front");
  const hasBack = set.has("back");
  if (hasFront && hasBack) return "Front/Back";

  const uniq: string[] = [];
  for (const a of cleaned) {
    if (!uniq.some((u) => u.toLowerCase() === a.toLowerCase())) uniq.push(a);
  }
  if (uniq.length === 0) return null;
  if (uniq.length === 1) return uniq[0];
  return `${uniq[0]}/${uniq[1]}`;
}

export function buildCreationTitle(args: {
  jobType?: string | null;
  inputJson?: any;
  angles?: Array<string | null | undefined>;
  createdAt?: string | Date | null;
}) {
  const tool = toNiceToolName(args.jobType);
  const ts = formatShortTimestamp(args.createdAt ? new Date(args.createdAt) : new Date());

  const input = args.inputJson || {};
  const sku = String(input.productId || input.sku || input.product_id || "").trim();
  const angleStr = angleSummary(args.angles || []);

  // Desired format: "Product Pack • SKU123 • Front/Back • Jan 3 10:52"
  const parts = [tool];
  if (sku) parts.push(sku);
  if (angleStr) parts.push(angleStr);
  parts.push(ts);
  return parts.join(" • ");
}




