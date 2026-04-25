---
name: 908-doha-design
description: Use this skill to generate well-branded interfaces and assets for 908 Doha, either for production or throwaway prototypes/mocks. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files. Key entry points:

- `README.md` — brand context, content fundamentals, visual foundations, iconography.
- `colors_and_type.css` — all CSS custom properties. Link this in any HTML you create for 908. Semantic tokens (`--text-primary`, `--accent-brand`, `--surface`) are the surface you design on; primitives (`--primary-500`) are below.
- `preview/` — specimen cards per foundation + component. Good starting point to see any part of the system in isolation.
- `ui_kits/mobile_app/` — a click-through mobile app built on the system. Copy screens from here; do not reinvent.
- `assets/logos/`, `assets/icons/` — brand marks (placeholder — ask the user for real files if they exist).

## How to work

**If creating visual artifacts** (slides, mocks, throwaway prototypes): copy `colors_and_type.css` and any needed assets into your artifact's folder, link the stylesheet, and use the role classes (`t-title1`, `t-body2`) and semantic tokens. Output self-contained HTML files.

**If working on production code**: treat this as a style reference. Map semantic tokens to your component library's token system; mirror the typography scale role names; reuse the same component vocabulary (ListRow, BottomCTA, Top, BottomSheet, Result).

**If the user invokes this skill without guidance**: ask what surface they want to design (mobile screen? marketing slide? component spec?), who the audience is, which flow, and whether they want the full component set or a minimal variant. Then produce an HTML artifact or production code, as appropriate.

## House rules
- Sentence case for all UI copy. No emoji.
- One primary action per screen. Fixed bottom CTA beats inline for forms.
- Warm sand grey, not cool. Teal `#0A6E6E` (teal-500) is used sparingly, reserved for `state-info` and data accents.
- Lucide icons at 1.5 stroke. No hand-drawn SVG icons unless the brand has a custom one.
- Dark mode shifts backgrounds toward a warm near-black (`#0A0A09`), not pure black.
