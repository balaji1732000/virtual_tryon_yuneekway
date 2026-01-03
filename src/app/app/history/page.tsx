import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Row = {
  id: string;
  job_id: string;
  kind: string;
  angle: string | null;
  mime_type: string | null;
  storage_path: string;
  created_at: string;
  jobs?: { type: string; status: string; created_at: string }[] | null;
};

function bucketForKind(kind: string) {
  if (kind === "extraction") return "extractions";
  if (kind === "video") return "videos";
  if (kind === "zip") return "zips";
  // default for generated images
  return "outputs";
}

function niceType(t?: string | null) {
  const type = (t || "").replaceAll("_", " ").trim();
  return type ? type.replace(/\b\w/g, (m) => m.toUpperCase()) : "Job";
}

export default async function HistoryPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("job_outputs")
    .select("id,job_id,kind,angle,mime_type,storage_path,created_at,jobs:jobs(type,status,created_at)")
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">History</h1>
        <p className="text-sm opacity-70">Couldn’t load outputs: {error.message}</p>
      </div>
    );
  }

  const rows = (data || []) as unknown as Row[];

  // Sign URLs (best-effort)
  const signed = await Promise.all(
    rows.map(async (r) => {
      const bucket = bucketForKind(r.kind);
      const { data: signedUrl } = await supabase.storage.from(bucket).createSignedUrl(r.storage_path, 60 * 60 * 24);
      return { ...r, bucket, signedUrl: signedUrl?.signedUrl || null };
    })
  );

  const grouped = new Map<string, { jobType: string; jobCreatedAt: string; outputs: (Row & { signedUrl: string | null })[] }>();
  for (const r of signed) {
    const jobId = r.job_id;
    const existing = grouped.get(jobId);
    const jobType = niceType((r as any).jobs?.[0]?.type);
    const jobCreatedAt = (r as any).jobs?.[0]?.created_at || r.created_at;
    if (!existing) {
      grouped.set(jobId, { jobType, jobCreatedAt, outputs: [r as any] });
    } else {
      existing.outputs.push(r as any);
    }
  }

  const groups = Array.from(grouped.entries());

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">History</h1>
          <p className="text-sm opacity-70">All your generated outputs across tools.</p>
        </div>
        <div className="text-sm">
          <Link href="/app" className="hover:underline">
            Back to dashboard
          </Link>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="glass-panel p-6">
          <div className="text-sm font-medium">No outputs yet</div>
          <div className="text-sm opacity-70 mt-1">Generate something from Product Pack / Try-On / Extract Garment and it will appear here.</div>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(([jobId, g]) => (
            <div key={jobId} className="glass-panel p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{g.jobType}</div>
                  <div className="text-xs opacity-60">{new Date(g.jobCreatedAt).toLocaleString()}</div>
                </div>
                <div className="text-xs opacity-60">Job: {jobId}</div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {g.outputs.map((o) => (
                  <div key={o.id} className="rounded-xl border border-[color:var(--sp-border)] overflow-hidden">
                    <div className="aspect-[3/2] bg-[color:var(--sp-hover)] flex items-center justify-center overflow-hidden">
                      {o.signedUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={o.signedUrl} alt={o.angle || o.kind} className="h-full w-full object-contain" />
                      ) : (
                        <div className="text-xs opacity-60 p-4 text-center">Couldn’t sign URL</div>
                      )}
                    </div>
                    <div className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate">{o.angle || o.kind}</div>
                        <div className="text-[11px] opacity-60 truncate">{o.mime_type || ""}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {o.signedUrl && (o.mime_type || "").startsWith("image/") && (
                          <Link
                            href={`/app/canvas?fromBucket=${encodeURIComponent((o as any).bucket)}&fromPath=${encodeURIComponent(o.storage_path)}&title=${encodeURIComponent(g.jobType)}`}
                            className="text-xs hover:underline text-[color:var(--sp-text)]"
                          >
                            Edit
                          </Link>
                        )}
                        {o.signedUrl && (
                          <a href={o.signedUrl} target="_blank" rel="noreferrer" className="text-xs hover:underline text-[color:var(--sp-text)]">
                            Download
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


