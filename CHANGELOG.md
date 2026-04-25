# Changelog

All notable changes to the 908 Doha Design System are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.0] — 2026-04-22

### Added
- `package.json` — installable as an npm package with `main`, `exports`, and `files` manifest.
- `tokens.json` — platform-neutral design tokens (DTCG draft format) for Style Dictionary / Tokens Studio pipelines.
- `tailwind.preset.js` — Tailwind v3 preset mapping all 908 tokens onto theme scales.
- `dist/908-doha.css` — bundled stylesheet (tokens + base reset + type classes + `@font-face`).
- `dist/908-doha.tokens.css` — variables-only build for consumers with their own base styles.
- `HANDOFF.md` — developer integration guide (Korean + English).
- `LICENSE` — MIT with third-party font license notice.
- `.gitignore`.

### Notes
- Placeholder 908 brand mark in `assets/logos/` — swap in real SVG when available.
- Dark mode activates via `[data-theme="dark"]` on `<html>` or `.theme-dark` wrapper.

## [0.8.0] — prior
- Initial foundations (`colors_and_type.css`), preview pages, mobile UI kit, component docs.
