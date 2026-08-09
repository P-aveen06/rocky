# Brand mark

`rocky-mission-patch.png` is the full-resolution source for the app logo:
1254×1254, transparent background, shield-shaped mission patch.

Everything shipped to the browser is derived from it. Regenerate with:

```bash
sips -Z 256 design/assets/brand/rocky-mission-patch.png --out web/src/assets/rocky-patch.png
sips -Z 180 design/assets/brand/rocky-mission-patch.png --out web/public/assets/rocky-icon-180.png
sips -Z 32  design/assets/brand/rocky-mission-patch.png --out web/public/assets/favicon-32.png
```

Where each one is used:

- `web/src/assets/rocky-patch.png` — the sidebar brand, the landing header, and
  the expired-session card, all through `.studio-brand__mark` and
  `.topbar__brand-mark` in CSS. Imported by the bundler, so it is content
  hashed.
- `web/public/assets/favicon-32.png` — browser tab icon.
- `web/public/assets/rocky-icon-180.png` — iOS home screen icon.

The icons live under `public/assets/` rather than `public/` because `/assets`
is the only directory the FastAPI server mounts; anything at the document root
falls through to the SPA index and is served as HTML.
