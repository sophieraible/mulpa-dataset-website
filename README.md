# MULPA dataset website

The public-facing companion website for the MULPA dataset.

## Build for GitHub Pages

Install the locked dependencies and create the static site:

```powershell
pnpm install --frozen-lockfile
pnpm build:github
```

The exported site is written to `out/`. The GitHub Actions workflow in
`.github/workflows/deploy-pages.yml` runs this command automatically after a
push to `main`.

## Data included in this repository

`data/participants.tsv` is included so the participant explorer reflects the
release metadata. Raw recordings, including `.snirf` files, are deliberately
excluded. The website's compact, derived display data is kept in
`app/derived-data.json`.

`scripts/prepare_site_data.py` is only for regenerating that derived data on a
local machine with access to the raw dataset. Its input paths must be adapted
before use; it is not run by GitHub Actions.

## Social-preview image

`public/og.png` is the image used when the website link is shared on services
such as Slack, LinkedIn, or WhatsApp. You can replace it manually with a PNG
that is 1200 × 630 pixels, keeping the same filename. Commit and push the
replacement. The metadata includes a version query so newly shared links use
the updated image, although individual services may keep their own cache.
