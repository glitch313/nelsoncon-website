# Nelsoncon Website

Static multi-page website for the annual Nelsoncon convention.

## Local Preview

From this folder:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000/index.html`.

## Memory Photos (Auto Slot Mapping)

Drop JPG/JPEG files into the year folders under `assets/memories/` and `assets/memories/winter/`.

When deployed, the workflow auto-maps newest files to:

- `photo1.jpg`
- `photo2.jpg`
- `photo3.jpg`

You can also run this locally:

```powershell
./sync-memory-photos.ps1
```

## GitHub Pages Publish

This repo includes a workflow at `.github/workflows/deploy-pages.yml`.

1. Push this folder to a GitHub repo (branch: `main`).
2. In GitHub: `Settings` -> `Pages` -> `Build and deployment` -> Source: `GitHub Actions`.
3. Push to `main` (or run the workflow manually in `Actions`).
4. Your site will publish at:
   `https://<your-username>.github.io/<repo-name>/`
