# Nelsoncon Website

Static multi-page website for the annual Nelsoncon convention.

## Local Preview

From this folder:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000/index.html`.

## Memory Photos (Auto Slot Mapping)

Drop image files into year folders under `assets/memories/` and `assets/memories/winter/`.

Supported formats:

- `.jpg`
- `.jpeg`
- `.png`
- `.webp`

When deployed, the workflow auto-maps newest files to slot names used by the tabs:

- `photo1.<ext>`
- `photo2.<ext>`
- `photo3.<ext>`

The page image tags automatically fall back across formats (`jpg -> jpeg -> png -> webp`) if needed.

You can also run the slot sync locally:

```powershell
powershell -ExecutionPolicy Bypass -File .\sync-memory-photos.ps1
```

## GitHub Pages Publish

This repo includes a workflow at `.github/workflows/deploy-pages.yml`.

1. Push this folder to a GitHub repo (branch: `main`).
2. In GitHub: `Settings` -> `Pages` -> `Build and deployment` -> Source: `GitHub Actions`.
3. Push to `main` (or run the workflow manually in `Actions`).
4. Your site will publish at:
   `https://<your-username>.github.io/<repo-name>/`
