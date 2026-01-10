# System Design — Yuneekwayai (Virtual Try-On + Magic Canvas)

This document explains the architecture, data flows, and key implementation details for the **Yuneekwayai** application so new engineers can quickly contribute.

## Tech stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4
- **State**: Zustand (client-side)
- **Backend**: Next.js Route Handlers (`src/app/api/**`)
- **Database**: Supabase Postgres (RLS enabled)
- **Auth**: Supabase Auth (cookie-based session via `@supabase/ssr`)
- **Storage**: Supabase Storage (buckets: outputs, profiles, extractions, videos, zips)
- **AI provider**: Google Gemini (`@google/genai`)
- **Image processing**: `sharp` (server-side normalization)

## High-level architecture

```mermaid
flowchart LR
  user[Browser_User] --> ui[NextJS_AppRouter_UI]
  ui --> api[NextJS_RouteHandlers_API]
  api --> supaDb[Supabase_Postgres_RLS]
  api --> supaStorage[Supabase_Storage]
  api --> gemini[Gemini_Image_and_Video_Models]
  supaDb --> ui
  supaStorage --> ui
```

### Key product concepts

- **Job**: one logical generation/edit action (stored in `jobs`)
- **Job output**: an artifact created by a job (stored in `job_outputs`)
- **Creation (Magic Canvas thread)**: one shared workspace thread per job (`canvas_threads.source_job_id`)
- **Asset**: an image within a creation (`canvas_assets`), often mapped to `job_outputs`
- **Conversation**: a chat session inside a creation (`canvas_conversations`)
- **Message**: chat message; assistant messages can reference an output image (`canvas_messages`)

## Codebase structure (where to look)

```text
nextjs_app/
  src/
    app/
      api/                      # Backend route handlers (JSON/FormData)
      app/                      # Auth-protected UI pages (workspace)
      login|register|forgot/    # Auth pages
    components/                 # Feature UIs (ProductPack, MagicCanvas, TryOn, etc.)
    lib/
      gemini.ts                 # Gemini prompts + SDK usage
      image-normalize.ts        # sharp normalization to safe JPEG
      garment-cutout.ts         # cached cutout generation
      creation-title.ts         # user-friendly creation titles
      supabase/                 # auth + server/browser clients
      store.ts                  # zustand store (active profile)
    middleware.ts               # auth redirects for /app
```

## Authentication & routing

`src/middleware.ts` enforces:
- unauthenticated users visiting `/app/**` are redirected to `/login`
- authenticated users visiting `/login|/register|/forgot` are redirected to `/app`
- API routes are **not** redirected by middleware (each API route does its own `401` checks)

## Data model (overview)

See [`DATABASE.md`](DATABASE.md) for the full ERD and tables.

At a glance:
- Generation features create rows in `jobs` + `job_outputs`
- Magic Canvas uses `canvas_threads`, `canvas_assets`, `canvas_conversations`, `canvas_messages`
- Storage stores binaries (images/masks/versions), referenced by DB paths

## Primary flows

### 1) Product Pack (multi-angle model renders)

Goal: user uploads garment images and generates consistent multi-angle photos using a selected model profile.

```mermaid
sequenceDiagram
  participant UI as ProductPack_UI
  participant API as POST_api_generate_image
  participant DB as Supabase_DB
  participant ST as Supabase_Storage
  participant AI as Gemini_Image

  UI->>UI: Collect angles + garment image + profile reference image
  UI->>API: FormData(type=pack, angle, dressImage, referenceImage?, additionalPrompt, useCutout...)
  API->>API: normalizeToJpeg(dressImage/referenceImage)
  API->>DB: upsert jobs(type=product_pack)
  API->>AI: generateModelWithDress(...)
  AI-->>API: inline output image
  API->>ST: upload outputs/{userId}/{jobId}/pack_{angle}_...png
  API->>DB: insert job_outputs(kind=image, angle, storage_path, mime_type)
  API-->>UI: signedUrl + outputId + jobId
```

Notes:
- **Angles** are generated per request (UI loops selected angles).
- Optional **cutout pipeline** (`useCutout=true`) creates/uses a cached transparent PNG in `garment_cutouts` to improve fit.

### 2) Virtual Try-On (dress on a model photo)

```mermaid
sequenceDiagram
  participant UI as VirtualTryOn_UI
  participant API as POST_api_generate_image
  participant ST as Supabase_Storage
  participant DB as Supabase_DB
  participant AI as Gemini_Image

  UI->>API: FormData(type=tryon, modelImage, dressImage, additionalPrompt)
  API->>API: normalizeToJpeg(modelImage/dressImage)
  API->>AI: generateVirtualTryOn(modelB64, dressB64, additionalPrompt)
  AI-->>API: inline output image
  API->>ST: upload outputs/{userId}/{jobId}/tryon_...png
  API->>DB: upsert jobs(type=tryon_image)
  API->>DB: insert job_outputs(kind=image, storage_path)
  API-->>UI: signedUrl + jobId + outputId
```

### 3) Magic Canvas (one creation → multiple versions)

Goal: **one creation per job**, show all images/versions, edit using chat, support multiple chats.

```mermaid
sequenceDiagram
  participant UI as MagicCanvas_UI
  participant RES as POST_api_canvas_resolve
  participant TH as GET_api_canvas_thread
  participant MSG as POST_api_canvas_messages
  participant DB as Supabase_DB
  participant ST as Supabase_Storage
  participant AI as Gemini_ImageEdit

  UI->>RES: {jobId, outputId}
  RES->>DB: find_or_create canvas_threads(source_job_id=jobId)
  RES->>DB: ensure canvas_assets for all job_outputs(jobId)
  RES-->>UI: threadId + assetId + conversationId

  UI->>TH: GET /api/canvas/threads/{threadId}
  TH->>DB: load thread + assets + conversations + messages
  TH->>ST: sign base/current urls
  TH-->>UI: full thread state

  UI->>MSG: FormData(text, conversationId, assetId, mask?, baseOverride?)
  MSG->>ST: download latest base image for asset (or override)
  MSG->>AI: editImageWithMask(base, mask, prompt)
  AI-->>MSG: output image
  MSG->>ST: upload outputs/.../versions/{msgId}.png
  MSG->>DB: insert jobs(type=canvas_edit) + job_outputs + canvas_messages
  MSG->>DB: update canvas_assets.current_storage_*
  MSG-->>UI: signedUrl to output
```

Important invariants:
- `canvas_threads.source_job_id` enforces **one creation per job** (deduped in thread listing).
- `canvas_assets.source_output_id` ties job outputs to assets inside the creation.

### 4) Garment extraction / cutout caching

Used both as a standalone tool and internally when Product Pack uses cutouts.

```mermaid
sequenceDiagram
  participant UI as UI_or_API
  participant API as ExtractGarment_or_CutoutService
  participant DB as Supabase_DB
  participant ST as Supabase_Storage
  participant AI as Gemini_Image

  UI->>API: upload garment image
  API->>API: normalizeToJpeg(image)
  API->>DB: lookup garment_cutouts by (user_id, source_hash, kind)
  alt cache_hit
    DB-->>API: existing storage_bucket/path
    API->>ST: download cached png
  else cache_miss
    API->>AI: generateContent(extract-only garment)
    AI-->>API: transparent PNG
    API->>ST: upload extractions/.../garment_cutouts/{hash}_{kind}.png
    API->>DB: upsert garment_cutouts row
  end
  API-->>UI: png signed url / base64
```

## Reliability & production readiness notes

### Image normalization
Gemini image endpoints can reject inputs due to:
- HEIC/HEIF formats
- huge images
- odd color profiles

Server-side normalization is handled in:
- `src/lib/image-normalize.ts` (`sharp` → sRGB JPEG, resized, size-capped)

### Signed URL expiration (profiles)
Profiles return a **signed URL** for reference images; it expires. UI should refresh/reselect profile if it becomes invalid.

### Observability (recommended improvements)
Not fully implemented yet, but production should add:
- structured logs with request IDs
- error reporting (Sentry, etc.)
- rate limiting on generation endpoints

## Environments & configuration

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GEMINI_API_KEY`

## Deployment notes (Vercel)

- Next.js is deployable on Vercel as-is.
- Configure the three env vars in Vercel project settings.
- Ensure Supabase Auth redirect URLs include your Vercel domain and your custom domain.

## Security model (current)

- All APIs use `getSupabaseAuthedClient`:
  - prefers cookie session (browser)
  - falls back to `Authorization: Bearer <token>` for scripts
- RLS is enabled on key tables and should enforce `user_id = auth.uid()` access (see `DATABASE.md`).



