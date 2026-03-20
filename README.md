# Toot Frontend MVP (Next.js + TypeScript + Tailwind)

Backend API is expected to be running at:
- `http://api.tootapp.net`

Media is expected to be served from:
- `http://media.tootapp.net`

This MVP uses plain HTTP (no SSL assumptions yet).

## Description

MVP frontend for the Toot social platform.

## Tech stack

- Next.js
- TypeScript
- Tailwind CSS

## Project name

Toot Frontend

## Project structure

```text
src/
  app/
    layout.tsx
    globals.css
    page.tsx                (landing `/`)
    login/page.tsx         (`/login`)
    register/page.tsx      (`/register`)
    home/page.tsx          (`/home`)        (protected)
    profile/page.tsx       (`/profile`)     (protected)
    upload-test/page.tsx   (`/upload-test`) (protected)
  components/
    AuthGate.tsx
    forms/
      TextInput.tsx
    ui/
      Button.tsx
      Card.tsx
      Spinner.tsx
  lib/
    api.ts                  (health + API fetch helpers)
    auth.ts                 (login/register + token helpers)
    media.ts                (build media URL from key; fallback)
```

## Run (development)

```bash
npm install
npm run dev
```

The dev server runs on port `3001` by default.

## Build for production

```bash
npm run build
npm run start
```

Next will serve the production build on port `3001`.

## Environment variables

Create `.env.local` based on `.env.example`:

```bash
cp .env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_API_BASE_URL` (e.g. `http://api.tootapp.net`)
- `NEXT_PUBLIC_MEDIA_BASE_URL` (e.g. `http://media.tootapp.net`)

## Protected pages + auth

- `/home`, `/profile`, `/upload-test` are protected.
- The app stores the backend `accessToken` in `localStorage` under `toot_access_token`.
- If the token is missing, users are redirected to `/login`.

