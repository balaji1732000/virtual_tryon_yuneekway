# API Documentation (Next.js Route Handlers)

Base: Next.js App Router route handlers under `src/app/api/**`.

Auth: APIs use Supabase auth via cookies (`getSupabaseAuthedClient`). Most routes return `401` if unauthenticated.

## Conventions

- **JSON responses**: `{ ... }` or `{ error: string }`
- **Uploads**: `multipart/form-data` (for images)
- **Signed URLs**: Storage assets are returned as short-lived signed URLs in some responses

---

## `/api/profiles`

### `GET /api/profiles`
Returns model profiles for the current user.

**Response 200**
- `{ profiles: Array<{ id, name, gender, skinTone, region, background, referenceImageUrl, referenceImagePath, createdAt }> }`

### `POST /api/profiles`
Creates a model profile and uploads the reference image to Storage bucket `profiles`.

**Request (multipart/form-data)**
- `name` (string, required)
- `gender` (string, required)
- `skinTone` (string, required)
- `region` (string, required)
- `background` (string, required)
- `referenceImage` (file, required)

**Response 200**
- `{ profile: { ...fields..., referenceImageUrl, referenceImagePath } }`

---

## `/api/generate-image`

This is the main image generation entrypoint. Supports:
- `type=tryon` (virtual try-on)
- `type=pack` (product pack multi-angle renders)

### `POST /api/generate-image` (try-on)

**Request (multipart/form-data)**
- `type`: `tryon`
- `jobId` (uuid string, optional) — client can supply to group outputs
- `modelImage` (file, required)
- `dressImage` (file, required)
- `additionalPrompt` (string, optional)

**Response 200**
- `{ jobId, outputId, storagePath, signedUrl, image, mimeType, text }`

### `POST /api/generate-image` (product pack)

**Request (multipart/form-data)**
- `type`: `pack`
- `jobId` (uuid string, optional)
- `angle` (string, required): `Front` | `Back` | `Left-Side` | `Right-Side` | `Three-quarter` | `Full body` (UI-driven)
- `productId` (string, required)
- `productTitle` (string, optional)
- `useCutout` (`true|false`, optional) — enables cached garment cutout pipeline
- `additionalPrompt` (string, optional)
- `skinTone` (string, required)
- `region` (string, required)
- `background` (string, required)
- `gender` (string, required)
- `aspectRatio` (string, required) e.g. `1:1 (Square)`
- `dressImage` (file, required)
- `referenceImage` (file, optional) — profile image to preserve identity across angles

**Response 200**
- `{ jobId, outputId, storagePath, signedUrl, image, mimeType, text }`

**Notable errors**
- `400 { error: "Reference image is not a valid image ..." }` — often expired signed URL fetched client-side
- `400 { error: "Unable to process input image ..." }` — normalization or Gemini invalid image input

---

## Magic Canvas APIs

Magic Canvas is modeled as:
**Creation (thread)** → **Assets (images)** + **Conversations (chats)** + **Messages (edits & outputs)**.

### `GET /api/canvas/threads`
Lists threads (deduped by `source_job_id` so “one creation per job”).

**Response 200**
- `{ threads: Array<{ id, title, base_storage_bucket, base_storage_path, created_at, updated_at, source_job_id }> }`

### `POST /api/canvas/threads`
Creates a new thread from uploaded image or existing storage path, and automatically creates:
- first conversation (`Chat 1`)
- first asset (label = title)

**Request (multipart/form-data)**
- `title` (string, optional)
- Either:
  - `image` (file)
  - OR `fromBucket` (string) + `fromPath` (string)

**Response 200**
- `{ thread: { ... }, conversationId, assetId }`

### `POST /api/canvas/resolve`
Resolves a history output into a single shared creation thread:
**one jobId → one thread**, and ensures all job outputs are present as assets.

**Request (JSON)**
- `{ jobId: string, outputId: string }`

**Response 200**
- `{ threadId: string, assetId: string, conversationId: string }`

### `GET /api/canvas/threads/:id`
Fetches full thread state:
- thread metadata + base signed URL
- assets + base/current signed URLs
- conversations
- messages (for active conversation; default latest)

**Query params**
- `conversationId` (optional)

**Response 200**
- `{ thread, assets, conversations, activeConversationId, messages }`

### `PATCH /api/canvas/threads/:id`
Renames a creation.

**Request (JSON)**
- `{ title: string }`

**Response 200**
- `{ thread: { id, title, updated_at } }`

### `POST /api/canvas/threads/:id/conversations`
Creates a new conversation (auto-titled `Chat N`).

**Response 200**
- `{ conversation: { id, title, created_at, updated_at } }`

### `POST /api/canvas/threads/:id/messages`
Sends a message to edit an image (mask optional) and returns the resulting output.

**Request (multipart/form-data)**
- `text` (string, required)
- `conversationId` (uuid string, required)
- `assetId` (uuid string, required)
- `mask` (file, optional) — PNG mask
- `invert` (`true|false`, optional)
- `feather` (number, optional)
- `baseOverrideBucket` (string, optional) — to edit a prior version
- `baseOverridePath` (string, optional)

**Response 200**
- `{ jobId, conversationId, assetId, output: { bucket, path, signedUrl }, mask }`

---

## `/api/extract-garment`

### `POST /api/extract-garment`
Uploads an image and returns a garment-only PNG with transparent background, stored in bucket `extractions`.

**Request (multipart/form-data)**
- `image` (file, required)

**Response 200**
- `{ jobId, outputId, storagePath, mimeType, signedUrl }`

---

## Video APIs

### `POST /api/generate-video`
Kicks off Gemini video generation (async operation).

**Request (multipart/form-data)**
- `prompt` (string, required)
- `dressImage` (file, required)

**Response 200**
- `{ operationId: string, status: "running" | "done" }`

### `GET /api/video-status?operationId=...`
Polls the operation and returns status + result.

**Response 200**
- `{ status: "running" }`
- or `{ status: "done", videoUri?, videoBytes? }`


