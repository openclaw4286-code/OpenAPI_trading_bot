# 908 Doha Design System — 개발자 Handoff 가이드

> 이 문서는 디자인 시스템을 **실제 제품 코드에 연결하는 개발자**를 위한 안내서입니다.
> 디자인 의도 / 브랜드 톤 / 컴포넌트 원칙은 [`README.md`](./README.md)를 참고하세요.

---

## TL;DR (30초 요약)

```bash
# 1) repo clone 또는 npm 설치
git clone https://github.com/YOUR_ORG/908-doha-design-system.git
# 또는
npm install 908-doha-design-system
```

```html
<!-- 2) CSS 한 줄 연결 -->
<link rel="stylesheet" href="node_modules/908-doha-design-system/dist/908-doha.css">
```

```jsx
// 3) 토큰 기반으로 작성
<button className="t-heading2" style={{
  background: 'var(--accent-brand)',
  color: 'var(--text-inverted)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-4) var(--space-6)',
  transition: 'transform var(--dur-fast) var(--ease-soft)',
}}>
  Confirm transfer
</button>
```

끝. 다크모드는 `<html data-theme="dark">` 한 줄로 전환됩니다.

---

## 1. 설치 옵션

### A) npm (React/Vue/Svelte/Next 등 번들러가 있는 프로젝트)

```bash
npm install 908-doha-design-system
# 또는
pnpm add 908-doha-design-system
# 또는
yarn add 908-doha-design-system
```

진입점 import:

```js
// 전체 번들 (토큰 + 리셋 + 폰트 + 타입 클래스)
import '908-doha-design-system/full';

// 토큰 변수만 필요하면 (앱에 리셋/폰트가 이미 있을 때)
import '908-doha-design-system/tokens-only';
```

### B) 정적 HTML / CDN (번들러 없음)

```html
<link rel="stylesheet"
      href="https://cdn.jsdelivr.net/gh/YOUR_ORG/908-doha-design-system@v0.9.0/dist/908-doha.css">
```

또는 저장소를 clone해서 그대로 서빙 — `index.html` + `dist/` + `fonts/` + `assets/`를 함께 올리면 됩니다.

### C) Git submodule (모노레포 / 여러 앱이 공유)

```bash
git submodule add https://github.com/YOUR_ORG/908-doha-design-system.git design-system
```

---

## 2. 디자인 토큰

### 소비 방법은 세 가지

| 방식 | 파일 | 언제 쓰나 |
|---|---|---|
| **CSS 변수** | `dist/908-doha.css` · `dist/908-doha.tokens.css` · `colors_and_type.css` | 가장 단순. 스타일에 `var(--accent-brand)` 처럼 직접 참조 |
| **Tailwind preset** | `tailwind.preset.js` | Tailwind 쓰는 프로젝트. `bg-brand`, `text-body1` 같은 유틸리티로 사용 |
| **JSON tokens** | `tokens.json` (DTCG 포맷) | Style Dictionary / Tokens Studio로 iOS(Swift), Android(Compose), RN 등에 변환 |

### CSS 변수 — 원칙

**항상 semantic token을 쓰고, primitive(—primary-500 등)는 직접 쓰지 않습니다.** Primitive는 semantic을 정의하는 하위 레이어일 뿐, 다크모드 대응이 안 됩니다.

```css
/* ❌ 하지 말 것 */
.btn { background: var(--primary-500); color: #fff; }

/* ✅ 이렇게 */
.btn { background: var(--accent-brand); color: var(--text-inverted); }
```

전체 토큰 목록은 [`dist/908-doha.tokens.css`](./dist/908-doha.tokens.css)의 주석을 보면 한눈에 들어옵니다. 핵심 그룹:

- **Surface/Text** — `--background`, `--surface`, `--surface-layered`, `--text-primary|secondary|tertiary`
- **Accent** — `--accent-brand`, `--accent-brand-hover`, `--accent-brand-press`, `--accent-brand-soft`
- **State** — `--state-positive|negative|warning|info` (+ `-soft` 변형)
- **Border** — `--border-subtle|default|strong|focus`
- **Spacing** — `--space-0` ~ `--space-12` (4pt 기준)
- **Radius** — `--radius-xs|sm|md|lg|xl|2xl|full`
- **Elevation** — `--elev-0` ~ `--elev-4`
- **Motion** — `--dur-fast|normal|slow|xslow`, `--ease-soft|emphasis|spring|out|in-out`

### Tailwind 설정 (v3 기준)

```js
// tailwind.config.js
import preset from '908-doha-design-system/tailwind';

export default {
  presets: [preset],
  content: ['./src/**/*.{html,js,jsx,ts,tsx,vue,svelte}'],
  // 다크모드는 preset이 ['class', '[data-theme="dark"]']로 설정함
};
```

그리고 앱 진입점에 CSS 파일 import도 반드시 필요합니다 (CSS 변수 정의가 들어있음):

```js
import '908-doha-design-system/full';
```

사용 예:

```jsx
<button className="bg-brand text-text-inverted rounded-md px-6 py-4
                   text-heading2 transition-transform duration-fast ease-soft
                   active:scale-[0.97]">
  Confirm transfer
</button>
```

### JSON → 네이티브 플랫폼

Style Dictionary 설정 스켈레톤:

```js
// build-tokens.config.mjs
import StyleDictionary from 'style-dictionary';
export default {
  source: ['node_modules/908-doha-design-system/tokens.json'],
  platforms: {
    ios:     { transformGroup: 'ios-swift',   buildPath: 'ios/',     files: [{ destination: 'Tokens.swift', format: 'ios-swift/class.swift' }] },
    android: { transformGroup: 'compose',     buildPath: 'android/', files: [{ destination: 'Tokens.kt',    format: 'compose/object' }] },
    js:      { transformGroup: 'js',          buildPath: 'dist/',    files: [{ destination: 'tokens.js',    format: 'javascript/es6' }] },
  },
};
```

---

## 3. 타이포그래피

**Role 클래스를 쓰고, `font-size`를 직접 지정하지 마세요.**

| 클래스 | 용도 | 크기 / 높이 / 굵기 |
|---|---|---|
| `.t-display` | 금액, 히어로 숫자 | 40 / 48 / Bold |
| `.t-title1` | 화면 제목 | 32 / 40 / Bold |
| `.t-title2` | 섹션 제목 | 26 / 34 / SemiBold |
| `.t-title3` | 카드 제목 | 22 / 30 / SemiBold |
| `.t-heading1` | 리스트 헤더 | 18 / 26 / SemiBold |
| `.t-heading2` | 버튼, 강조 라벨 | 16 / 24 / SemiBold |
| `.t-body1` | 본문 | 16 / 26 / Regular |
| `.t-body2` | 보조 본문 | 14 / 22 / Regular |
| `.t-label` | 폼 라벨, 태그 | 13 / 18 / Medium |
| `.t-caption` | 캡션, 타임스탬프 | 12 / 16 / Regular |

폰트 가족 변수: `--font-sans` (Pretendard, 기본) / `--font-serif` (Fraunces, 에디토리얼 전용) / `--font-mono` (JetBrains Mono, 숫자·계좌번호) / `--font-arabic` (Noto Kufi Arabic, RTL).

---

## 4. 다크모드

```html
<!-- 전역 전환 -->
<html data-theme="dark">

<!-- 또는 부분 전환 (섹션 단위) -->
<div class="theme-dark">...</div>
```

시스템 설정 연동:

```js
// 최초 로드 시 OS 설정 반영
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
document.documentElement.dataset.theme = prefersDark ? 'dark' : 'light';

// 변경 감지
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  document.documentElement.dataset.theme = e.matches ? 'dark' : 'light';
});
```

토큰이 자동으로 재바인딩되므로 컴포넌트 코드는 **하나도** 바꿀 필요가 없습니다.

---

## 5. 모션 — 908의 시그니처

> "Every state change earns a curve. Nothing teleports."

```css
/* 기본값 — 이 한 조합이 908의 80%를 만듭니다 */
.anything {
  transition: all var(--dur-normal) var(--ease-soft);
}

/* CTA 누름 — 물리적 반응 */
.btn:active {
  transform: scale(0.97);
  transition: transform 100ms var(--ease-soft);
}
.btn {
  transition: transform var(--dur-normal) var(--ease-spring);
}

/* 화면 전환 — emphasis */
.screen-enter {
  animation: slideIn var(--dur-slow) var(--ease-emphasis);
}
```

React에서는 Framer Motion과 바로 호환:

```jsx
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] /* --ease-soft */ }}
/>
```

---

## 6. 컴포넌트 참고

제품 코드에 넣을 완성형 React 컴포넌트 라이브러리는 이 저장소에 **포함되어 있지 않습니다.** 대신:

- [`docs/`](./docs/) — 모든 컴포넌트의 props, 상태, 변형을 확인할 수 있는 스펙 페이지
- [`ui_kits/mobile_app/`](./ui_kits/mobile_app/) — 실제 화면에 조합된 레퍼런스 (JSX로 작성된 소스)
- [`preview/`](./preview/) — 파운데이션과 컴포넌트의 개별 specimen

개발팀이 구현 시 권장 순서:
1. `docs/<component>.html`에서 스펙 확인 (크기, 패딩, 상태)
2. `ui_kits/mobile_app/components.jsx`에서 레퍼런스 구현 참고
3. 사내 컴포넌트 라이브러리에 토큰을 매핑해 재구현

---

## 7. 폰트

Pretendard OTF 9종이 [`fonts/`](./fonts/)에 번들되어 있습니다. `dist/908-doha.css`가 `../fonts/`에서 자동 로드합니다.

**셀프호스팅 경로가 다를 때** — `908-doha.tokens.css`(변수만)을 쓰고 앱 자체 CSS에서 `@font-face`를 직접 선언하세요.

Fraunces / JetBrains Mono / Noto Kufi Arabic은 Google Fonts CDN을 통해 로드됩니다. 오프라인 / 사내망 환경이면 해당 OTF/WOFF2를 받아 `@font-face`를 교체하세요.

---

## 8. 에셋

- [`assets/logos/`](./assets/logos/) — `908-mark.svg`, `908-wordmark.svg` *(⚠ 현재는 플레이스홀더. 실제 브랜드 마크 수령 후 교체 필요)*
- [`assets/icons/`](./assets/icons/) — 브랜드 고유 글리프
- **일반 아이콘**은 [Lucide](https://lucide.dev) 사용 권장 (`lucide-react` 등). 기본 24px, stroke 1.5.

---

## 9. 버전 / 업데이트 정책

- SemVer 준수. 메이저 버전업은 토큰 이름 / DOM 구조 변경 같은 breaking change 시에만.
- 마이너 — 토큰 추가, 새 컴포넌트 스펙 추가.
- 패치 — 값 미세 조정, 문서 수정.
- 변경 내역은 [`CHANGELOG.md`](./CHANGELOG.md)에서 추적됩니다.

업그레이드 가이드:

```bash
npm info 908-doha-design-system versions
npm install 908-doha-design-system@latest
```

---

## 10. 기여 / 문의

- 토큰 값 수정 제안 → `tokens.json` + `dist/908-doha.tokens.css` + `colors_and_type.css` 세 곳 동시 수정 후 PR
- 새 컴포넌트 제안 → `docs/_template.html` 복제 → 스펙 작성 → `preview/` specimen 추가
- 브랜드 가이드 문의 → 프로젝트 관리자

---

## FAQ

**Q. React Native에서 쓸 수 있나요?**
A. 네. `tokens.json`을 Style Dictionary로 RN 테마 객체로 변환해 사용하세요. CSS 변수는 RN에서 작동하지 않습니다.

**Q. CSS-in-JS (Emotion, styled-components)에서는?**
A. CSS 변수를 그대로 템플릿에 넣으면 됩니다: `` background: ${props => `var(--accent-brand)`} ``. 또는 `tokens.json`을 import해서 객체로 읽어도 됩니다.

**Q. 색상 하나를 바꾸고 싶습니다.**
A. primitive(예: `--primary-500`)를 직접 재정의하면 그걸 참조하는 semantic이 모두 따라 바뀝니다. 특정 surface만 바꾸려면 semantic(예: `--accent-brand`)를 덮어쓰세요.

```css
:root { --accent-brand: #0052D4; } /* 브랜드 블루만 살짝 조정 */
```

**Q. Figma와 연결되나요?**
A. Tokens Studio 플러그인에서 `tokens.json`을 import하면 Figma 변수로 매핑됩니다.
