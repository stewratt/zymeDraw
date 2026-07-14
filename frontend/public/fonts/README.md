# UI fonts (ui-bg-experiment)

Drop-in fonts for the dev **BG EXPERIMENT** font picker. Files here are
served verbatim at `/fonts/…` (Vite `public/`), so the picker can
`@font-face`-load them by URL with no build step.

> This is **not** `frontend/src/assets/fonts/` — that location is reserved
> for Foundry's OFL **card-art** fonts (bundler-imported for the card type
> layer). These are UI-chrome experiment fonts only.

## Bundled library (already here)

Pulled from the Fontsource CDN (open-licensed — SIL OFL / Apache), weights
200/300/400 where the family offers them:

- **Sans** — Inter · Work Sans · Space Grotesk · IBM Plex Sans · Manrope ·
  DM Sans · Sora · Archivo
- **Serif** — Fraunces · EB Garamond · Spectral · Cormorant
- **Mono** — JetBrains Mono · Space Mono · IBM Plex Mono · Fira Code · DM Mono

All are already in `fontsCatalog.js`, so they show up in the picker. The
sections below are only for adding *more*.

## Structure — one subfolder per family

```
frontend/public/fonts/
├── inter/
│   ├── Inter-ExtraLight.woff2   # 200
│   ├── Inter-Light.woff2        # 300
│   └── Inter-Regular.woff2      # 400
└── space-mono/
    └── SpaceMono-Regular.woff2  # 400
```

## To add a font

1. Create `public/fonts/<family-slug>/` and drop the weight files in
   (`.woff2` preferred). The UI uses weights **200 / 300 / 400** — ship
   those three where you can; anything missing is browser-synthesized.
2. Add an entry to `frontend/src/fontsCatalog.js` (`slot: 'ui'` or
   `'mono'`, `family`, `fallback`, and a `faces[]` mapping weight → file).
3. Reload — it appears in the picker's `ui font` / `mono font` cycler.
