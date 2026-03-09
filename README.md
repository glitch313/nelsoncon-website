# Nelsoncon Website

Static multi-page website for the annual Nelsoncon convention.

## Local Preview

From this folder:

```powershell
python -m http.server 8000
```

Open [http://localhost:8000/index.html](http://localhost:8000/index.html).

## Memories Media (Photos + Videos)

Drop files into year folders under:

- `assets/memories/<year>/`
- `assets/memories/winter/<year>/`

Supported images:

- `.jpg`
- `.jpeg`
- `.png`
- `.webp`

Supported videos:

- `.mp4`
- `.webm`

### Fast Upload Prep (Recommended)

This compresses videos first (if `ffmpeg` is installed), then refreshes the gallery manifest:

```powershell
powershell -ExecutionPolicy Bypass -File .\\prepare-memory-media.ps1 -TargetSizeMB 50
```

If `ffmpeg` is missing, it still updates the manifest.

### Manifest Only

```powershell
powershell -ExecutionPolicy Bypass -File .\sync-memory-photos.ps1
```

## GitHub Pages Publish

This repo includes `.github/workflows/deploy-pages.yml`, which auto-syncs the memory manifest on each push to `main`.

1. Push this folder to a GitHub repo (`main` branch).
2. In GitHub: `Settings -> Pages -> Build and deployment -> Source: GitHub Actions`.
3. Push to `main` (or run workflow manually in `Actions`).
4. Site URL: `https://<your-username>.github.io/<repo-name>/`

## RSVP Storage (Supabase)

The RSVP form posts to Supabase REST using config in `assets/rsvp-config.js`.

### 1) Create/update the RSVP database objects

Run the SQL from [`database/rsvps.sql`](./database/rsvps.sql) in Supabase SQL Editor. Re-run it when this file changes to apply new constraints/policies.

This script creates/updates:

- `public.rsvps` table
- stricter validation checks (`full_name` format/length and allowed `ticket_type` values)
- `created_at` index
- RLS enabled on the table
- anonymous insert policy + required grants (including a simple per-minute insert throttle)

### 2) Add project config

Edit `assets/rsvp-config.js` and fill:

- `supabaseUrl` (project URL)
- `anonKey` (project anon/public key)
- `table` (defaults to `rsvps`)

### 3) View entries

Use Supabase Dashboard -> Table Editor -> `rsvps`.

