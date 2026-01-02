import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";
const EMAIL = process.env.TEST_EMAIL || "balaji.test+e2e002@gmail.com";
const PASSWORD = process.env.TEST_PASSWORD || "TestPass#12345";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function fileToBlob(filePath, mimeType) {
  const buf = await fs.readFile(filePath);
  return new Blob([buf], { type: mimeType });
}

async function main() {
  console.log("Base URL:", BASE_URL);

  // 1) Auth: sign in and get bearer token
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data, error } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  ok(!error, `Login failed: ${error?.message}`);
  ok(data.session?.access_token, "No access token returned");
  const token = data.session.access_token;
  console.log("Auth OK:", data.user?.email);

  // 2) Prepare sample images from repo
  const repoRoot = process.cwd().includes("nextjs_app") ? path.resolve(process.cwd(), "..") : process.cwd();
  const sampleDress = path.join(repoRoot, "virtual_tryon", "outputs", "SKU_4f3d6033", "SKU_4f3d6033_front_1024x1024.png");
  const sampleModel = path.join(repoRoot, "virtual_tryon", "profiles", "0c418a42-36a3-4ec3-bd3a-9bdcdc809401", "reference.jpg");
  console.log("Using sample dress:", sampleDress);
  console.log("Using sample model:", sampleModel);

  // 3) Extract garment
  {
    const fd = new FormData();
    fd.append("image", await fileToBlob(sampleDress, "image/png"), "dress.png");
    const res = await fetch(`${BASE_URL}/api/extract-garment`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const json = await res.json().catch(() => ({}));
    ok(res.ok, `extract-garment failed: ${res.status} ${JSON.stringify(json)}`);
    ok(json.signedUrl, "extract-garment missing signedUrl");
    console.log("Extract garment OK:", json.storagePath);
  }

  // 4) Try-on image
  {
    const fd = new FormData();
    fd.append("type", "tryon");
    fd.append("modelImage", await fileToBlob(sampleModel, "image/jpeg"), "model.jpg");
    fd.append("dressImage", await fileToBlob(sampleDress, "image/png"), "dress.png");
    fd.append("additionalPrompt", "Keep background unchanged.");
    const res = await fetch(`${BASE_URL}/api/generate-image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const json = await res.json().catch(() => ({}));
    ok(res.ok, `tryon failed: ${res.status} ${JSON.stringify(json)}`);
    ok(json.signedUrl, "tryon missing signedUrl");
    console.log("Try-on OK:", json.storagePath);
  }

  // 5) Product pack single angle
  {
    const fd = new FormData();
    fd.append("type", "pack");
    fd.append("jobId", crypto.randomUUID());
    fd.append("angle", "Front");
    fd.append("skinTone", "Medium");
    fd.append("region", "Europe");
    fd.append("background", "Studio Grey");
    fd.append("gender", "Female");
    fd.append("aspectRatio", "1:1 (Square)");
    fd.append("additionalPrompt", "");
    fd.append("dressImage", await fileToBlob(sampleDress, "image/png"), "dress.png");
    fd.append("referenceImage", await fileToBlob(sampleModel, "image/jpeg"), "reference.jpg");
    const res = await fetch(`${BASE_URL}/api/generate-image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const json = await res.json().catch(() => ({}));
    ok(res.ok, `product-pack failed: ${res.status} ${JSON.stringify(json)}`);
    ok(json.signedUrl, "product-pack missing signedUrl");
    console.log("Product pack OK:", json.storagePath);
  }

  console.log("SMOKE TEST PASSED ✅");
}

main().catch((e) => {
  console.error("SMOKE TEST FAILED ❌");
  console.error(e);
  process.exit(1);
});


