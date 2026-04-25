# 908 Doha Design System

> A mobile-first design system for **908 Doha** — the quiet confidence of a Gulf-modern product language. Structurally inspired by the Toss Design System (TDS), with its own brand identity rooted in warm neutrals, oasis teal, and patient typography.

---

## Brand summary

**908 DS** (or simply **908**) is the interface language of 908 Doha — a product family for the Gulf region that values trust, calm, and precision over novelty. The system is built for fintech-grade reliability but warm enough for lifestyle, wellbeing, and everyday concierge use.

- **One-line mission:** *"Interfaces that move like breath — you only notice when they don't."*
- **Tone & mood:** Quiet, premium, hospitable. Never loud.
- **Primary direction:** **908 Blue `#0064FF`** on warm sand neutrals. The blue is used *precisely* — CTAs, brand marks, high-signal moments. The system's expressiveness still lives primarily in **motion**.
- **Core principle — motion:** Every state change earns a curve. Nothing teleports. 908's signature easing is `cubic-bezier(0.32, 0.72, 0, 1)` (`--ease-soft`) — a long, breath-like settle that makes even mundane taps feel considered.
- **Target domain:** Fintech / lifestyle / transit & concierge for the Gulf.

### Sources given

- User prompt: benchmark Toss DS Mobile structure with a new brand.
- Reference used for component taxonomy and semantic-token naming conventions: **TDS Mobile docs** — `https://tossmini-docs.toss.im/tds-mobile/` (component list, 10-step color scale, semantic background tokens). 908 DS mirrors the *structure* but not the *values* — every color, font, radius, and motion curve is 908's own.
- No external codebase, Figma, or slide deck was attached for this system. All brand decisions (name interpretation, palette, type pairing, motion language) were synthesized from the brand name "908 Doha" and the TDS architectural brief.

> **If you have a codebase, Figma, or brand book for 908 Doha, attach it via the Import menu and I'll reconcile the system to match.**

---

## Content fundamentals

How copy is written across 908 surfaces.

**Voice.** Second person, never first. The product addresses the customer directly but stays out of the way. *"Send 500 QAR"*, not *"We'll send 500 QAR for you."* Avoid *"our team"*, *"we think"*, *"at 908 we..."*.

**Casing.** Sentence case everywhere — buttons, titles, toasts, menu items. `Confirm transfer`, never `CONFIRM TRANSFER` or `Confirm Transfer`. The only exceptions are proper nouns and the product word **908**, which is always numeric.

**Tone ladder.**
1. **Instructional** (primary actions, headers): calm imperative. *"Confirm transfer."* *"Scan to pay."*
2. **Informational** (body, helpers): full sentences, no exclamation. *"Transfers to this account usually arrive in under a minute."*
3. **Affirmational** (success, empty states): short, specific. *"Sent. 500 QAR is on its way."* — not *"Hooray! 🎉"*
4. **Corrective** (errors): tell the user what happened and what to do, in that order. *"This card expired in March. Add a new one to continue."*

**I vs. you.** Always *you*. The system never refers to itself as *we* or *I*.

**Numbers & currency.** Latin numerals. QAR amounts lead: `QAR 500` in running copy, `500 QAR` in lists/ledgers where the unit trails a right-aligned figure. Thousands separator: comma. Decimals: always two for currency (`250.00 QAR`).

**Length.** Button labels ≤ 24 characters. Toast titles ≤ 48. Empty-state headers ≤ 40. If you must shorten, drop articles before verbs (*"Add card"* not *"Add a card"*).

**Emoji.** No. Unicode characters used as icons (→ ← ✓ · •) are allowed when paired with text. Product iconography handles the rest.

**Arabic.** When localized, Arabic uses Noto Kufi Arabic with slightly looser tracking. Mirror the layout (RTL); mirror directional icons (→ becomes ←); do not mirror logos or non-directional illustration.

**Examples.**
- Header: *"Good evening, Laila."*
- Body: *"Your salary arrived Tuesday. Most of it is already at work."*
- Button: *"Move to savings"*
- Error: *"That code didn't match. Two tries left."*
- Empty: *"No cards yet." / "Add your first card to start."*

---

## Visual foundations

### Colors
- **Primary — 908 Blue** (`#0064FF`). Used precisely: primary CTAs, brand marks, selected states, high-signal highlights. Never as a large background fill except as the soft tint `primary-50`.
- **Warm sand neutrals.** The grey scale carries everything else. Warm sand bias keeps the blue from feeling cold or corporate.
- **Accents** (orange / yellow / teal / purple) are kept low-saturation, reserved for data (tags, chips, chart slices). Never for primary CTAs.
- **Semantic states** (positive / negative / warning) available filled and soft.
- **Dark mode** uses a deep near-black background, surfaces elevate with lightness, and the blue shifts to `primary-400` for AA contrast.

### Typography
- **Sans:** Pretendard (primary) for Latin + Korean coverage; Noto Kufi Arabic for Arabic; `-apple-system` fallback.
- **Serif:** Fraunces — used only for editorial moments (empty-state headlines, marketing quotes, hero titles in concierge content). Never for UI chrome.
- **Mono:** JetBrains Mono — for reference numbers, IBANs, receipts.
- **Scale:** Display / Title1–3 / Heading1–2 / Body1–2 / Label / Caption. Use role tokens, not raw sizes.
- **Tracking:** Latin titles use slight negative tracking (-0.01em to -0.02em) for optical tightness. Korean/Arabic inherit a looser -0.5% / 0 respectively.

### Spacing & layout
- **4pt base.** Touch targets are always ≥ 44px tall. List rows minimum 56px.
- **Safe area.** Mobile content uses 20px side gutter; rows/cards nest inside this gutter.
- **Rhythm.** Vertical spacing snaps to 4/8/16/24; avoid arbitrary values.

### Corner radii
- **Inputs & buttons:** 12px (`--radius-md`).
- **Cards & sheets:** 20px (`--radius-xl`).
- **Bottom sheet top edge:** 28px (`--radius-2xl`) — softer than content cards for visual hierarchy.
- **Pills/avatars/badges:** `full`.
- Squared corners (0–4px) are reserved for data-dense rows (ledgers, tables).

### Backgrounds
- **No gradients for fills.** A single, subtle radial glow (`primary-500` at 3–5% opacity) is permitted on hero surfaces.
- **No background images behind text.** If used, text must sit over a solid scrim.
- **No patterns.** The brand's visual identity is carried by type and spacing, not texture.

### Elevation & shadows
- **Five-step elevation** (0–4). Shadows are soft, low-opacity, and warm (tinted with `grey-900`, never pure black).
- In **dark mode**, surfaces elevate with lightness tint, not shadow. `surface-layered` is 1 step brighter than `surface`.

### Borders
- **1px hairlines.** `border-subtle` for inside-a-surface dividers, `border-default` for component outlines, `border-strong` for emphasis and focus rings.
- Never use borders *and* shadows on the same element.

### Motion — the signature of 908
Motion is not decoration in 908. It is the brand. Because color is absent, the *feel* of transitions is how users recognize the product.

- **Durations:** `fast 160ms` / `normal 280ms` / `slow 480ms` / `xslow 720ms`.
- **Signature easing — `--ease-soft`** `cubic-bezier(0.32, 0.72, 0, 1)`: a long, breath-like settle. Use for *every* state change in the UI unless another curve is specifically called for. Things enter fast and settle slowly, like a page turn.
- **`--ease-emphasis`** `cubic-bezier(0.2, 0, 0, 1)`: for screen-level transitions and hero entries.
- **`--ease-spring`** `cubic-bezier(0.34, 1.56, 0.64, 1)`: tactile micro-interactions only — switch thumb, checkbox tick, bottom-sheet handle drag. Use sparingly.
- **Entrances** combine opacity 0→1 (fast) with a 6–12px translateY (normal). Never scale.
- **Exits** fade (fast) and slide slightly *away* from the user's intent (e.g. a dismissed sheet slides down).
- **Press** on a CTA: scale to 0.97 over 100ms on press, rebound with `--ease-spring` on release. Never darken.
- **Hover** (desktop, rare): nothing moves — only a subtle 6% shift in fill (`grey-100 → grey-200`). The system reserves movement for intention.
- **Focus:** 2px ring of `border-focus` with 3px offset. Focus rings never animate; they appear instantly.
- **Numbers animate.** Balance changes, counters, step indicators — always interpolate, never snap.
- **List reorders animate.** Use FLIP / layout animation when rows sort or filter.
- **Screen transitions:** push (forward) slides the new screen in from the right + fades; pop (back) reverses. Modal sheets slide from bottom with `--ease-soft` over 480ms.
- **The 908 rule:** if two states can be connected with a curve, they must be. Teleports are a bug.

### Transparency & blur
- **Sparingly.** Top nav / bottom tab bar use `backdrop-filter: blur(20px) saturate(1.4)` over `surface` at 80% — and only when content can scroll under them. Modals use solid scrims; avoid blur on full-screen overlays.

### Imagery
- Warm tones. Matte, not glossy. Muted saturation. Prefer architecture, textiles, aerials of the Gulf coast, and low-contrast portraits over stock-lit product shots. Never apply filters that add grain.

### Layout rules
- One primary action per screen. Fixed bottom CTA is preferred over inline for forms.
- Headers are sticky but small (52–56px); no hero banners inside product flows.
- Sheets over stacked navigation for secondary flows. Modals only for disruption (confirmation, alert).

---

## Iconography

- **Primary icon set:** **Lucide** (CDN / `lucide-react`) — its 1.5px stroke and rounded line caps match the system's calm tone. Use the default **24px** at 1.5 stroke weight; drop to 20px inline, 28px for hero.
- **Brand icons:** A handful of hand-drawn glyphs live in `assets/icons/` (the 908 mark, Gulf-specific payment rails, RTL-safe chevrons). Use these when Lucide doesn't cover the concept.
- **No emoji.** No color-emoji substitutions for icons. Unicode arrows/checkmarks in running text are fine.
- **Filled vs. outline:** Outline is default. Use filled only to mark *active* state (e.g. the selected tab in a bottom nav).
- **Color:** Icons inherit `currentColor`. Primary actions in `--text-primary`, secondary in `--text-secondary`, destructive in `--state-negative`.
- **Logo:** `assets/logos/908-mark.svg` (mark) and `assets/logos/908-wordmark.svg` (wordmark). Keep clear space equal to the "0" glyph; never place on a gradient background.

> **Substitution flag:** the real 908 Doha brand mark was not provided; the current mark in `assets/logos/` is a placeholder built from the brand's intended letterform system. **Please provide the real SVG logo files and we'll swap them in.**

---

## Quick start for developers

```bash
git clone https://github.com/YOUR_ORG/908-doha-design-system.git
# or
npm install 908-doha-design-system
```

```html
<link rel="stylesheet" href="dist/908-doha.css">
```

Then use CSS variables (`var(--accent-brand)`, `var(--text-primary)`, `var(--radius-md)` …) or role classes (`t-title1`, `t-body2`). Toggle dark mode with `<html data-theme="dark">`.

**Full integration guide (ko+en):** [`HANDOFF.md`](./HANDOFF.md)
**Token JSON (Style Dictionary / Tokens Studio):** [`tokens.json`](./tokens.json)
**Tailwind preset:** [`tailwind.preset.js`](./tailwind.preset.js)
**Changelog:** [`CHANGELOG.md`](./CHANGELOG.md)

---

## Index — what's in this folder

```
README.md                    ← brand + design principles
HANDOFF.md                   ← developer integration guide (KO/EN)
CHANGELOG.md                 ← version history
LICENSE                      ← MIT + font license notes
SKILL.md                     ← Claude Code skill manifest
package.json                 ← npm manifest
tokens.json                  ← platform-neutral tokens (DTCG)
tailwind.preset.js           ← Tailwind v3 preset
colors_and_type.css          ← all CSS custom properties (light + dark) — source of truth
dist/
  908-doha.css               ← bundled: tokens + fonts + reset + type classes
  908-doha.tokens.css        ← tokens only (variables), no reset/fonts
assets/
  logos/                     ← 908 marks and wordmarks (placeholder; needs real files)
  icons/                     ← brand-specific glyphs
preview/                     ← design-system cards for the Design System tab
  colors-*.html              ← color scale & semantic cards
  type-*.html                ← typography specimens
  spacing-*.html             ← spacing, radius, elevation
  components-*.html          ← button, input, badge, etc.
ui_kits/
  mobile_app/                ← reference mobile app built on 908 DS
    index.html               ← interactive click-through prototype
    *.jsx                    ← component sources
```

### UI kits included
- **`ui_kits/mobile_app/`** — a lifestyle/finance-tinted concierge app demonstrating the full token system and the 25 core components in their natural habitat (home, transfer confirmation, account detail, settings).

### Font substitutions flagged
- The brief requested Pretendard-first with SF Pro / Inter fallback. **Pretendard** is loaded from the public CDN. If you have a licensed/local Pretendard subset, drop it into `fonts/` and update `colors_and_type.css`. Noto Kufi Arabic is loaded from Google Fonts for RTL coverage.

---

## How to use this system

1. Link `colors_and_type.css` in any HTML you create for 908 Doha.
2. Use semantic tokens (`var(--text-primary)`, `var(--accent-brand)`) in your styles — not primitives.
3. For typography, apply the role classes (`t-title1`, `t-body2`) rather than setting `font-size` directly.
4. For components, copy from `ui_kits/mobile_app/` rather than re-implementing.
5. For dark mode, add `data-theme="dark"` to `<html>` or `.theme-dark` to a wrapper.

---

## Recommended compositions (starter recipes)

Three real-screen recipes using the token + component set.

1. **Login / passcode screen** — `Top` (back only) + `Display` headline + 6-digit `Stepper`-style passcode row + `BottomCTA` (Double: "Forgot passcode" tertiary / "Continue" primary).
2. **Transfer confirm** — `Top` (back + title) + `ListRow` stack (From / To / Amount / Fee) on `surface-layered` card + `BottomCTA` Single ("Confirm transfer") with destructive confirmation in `AlertDialog`.
3. **Account detail** — `Top` (transparent, over hero) + large balance `Display` + `SegmentedControl` (Activity / Cards / Insights) + paged `BoardRow` list + floating `IconButton` FAB.
4. **Empty state** — centered `Result` (`Empty` variant) + single `TextButton` action; uses Fraunces on the headline for editorial warmth.
5. **Onboarding sheet** — `BottomSheet` with drag handle, step `ProgressBar` at top, illustration slot, `Title2` + `Body1`, `BottomCTA` pinned.
