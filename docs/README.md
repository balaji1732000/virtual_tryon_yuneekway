# Yuneekwayai (Virtual Try-On) — Engineering Documentation

This folder contains **production-ready system design documentation** for the Yuneekwayai web app.

## Documents

- [`SYSTEM_DESIGN.md`](SYSTEM_DESIGN.md) — end-to-end architecture, flows, and core concepts
- [`DATABASE.md`](DATABASE.md) — database schema + ERD + storage buckets
- [`API.md`](API.md) — API contracts (request/response) for all Next.js route handlers

## Source of truth

- **Backend**: Next.js Route Handlers under `src/app/api/**`
- **Frontend**: Next.js App Router pages under `src/app/app/**` and components under `src/components/**`
- **Database**: Supabase Postgres tables under `public.*`
- **AI**: Gemini SDK in `src/lib/gemini.ts`





