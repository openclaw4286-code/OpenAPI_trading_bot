# 908 Doha UI — drop-in 번들

이 폴더 하나만 다른 프로젝트의 GitHub repo에 업로드하면 908 Doha 디자인 시스템 + React 컴포넌트를 그대로 사용할 수 있습니다.

## 폴더 구조

```
908-doha-ui/
├── styles/
│   ├── 908-doha.css           ← 토큰 + 폰트 + 리셋 + 타입 클래스 (전체 번들)
│   ├── 908-doha.tokens.css    ← CSS 변수만
│   └── colors_and_type.css    ← 토큰 원본 (light + dark)
├── fonts/                     ← Pretendard 9 weights (.otf)
├── components/                ← 32개 React 컴포넌트
├── contexts/                  ← Auth / Notes / Toast / Viewport providers
└── lib/                       ← 컴포넌트가 의존하는 유틸 (auth, crypto, files, members, notes, tasks, vault 등)
```

## 1. 설치 (3단계)

```bash
# 1) 이 폴더를 새 프로젝트 루트에 복사
cp -r 908-doha-ui /path/to/new-project/

# 2) 새 프로젝트에서 peer dependencies 설치
cd /path/to/new-project
npm install react react-dom lucide-react @supabase/supabase-js
```

```js
// 3) 진입점(main.jsx 등)에서 CSS 한 번만 import
import './908-doha-ui/styles/908-doha.css';
```

## 2. 사용 — 두 가지 트랙

### A. 순수 디자인 컴포넌트 (백엔드 불필요)

별도 설정 없이 바로 사용 가능:

`Button` · `IconButton` · `Modal` · `Toast` · `Skeleton` · `AutoTextarea` · `FormField` · `FormInput` · `FormPasswordInput` · `FormSelect` · `FormTextarea` · `SearchField` · `EmptyScaffold` · `FolderSidebar` · `KanbanColumn` · `SlashMenu` · `NoteCard`

```jsx
import Button from './908-doha-ui/components/Button.jsx';
import Modal from './908-doha-ui/components/Modal.jsx';

<Button variant="primary" onClick={...}>Confirm transfer</Button>
```

### B. 앱 결합 컴포넌트 (Supabase 필요)

`TaskCard` · `TaskEditor` · `NotePage` · `VaultEntry` · `VaultEntryEditor` · `VaultUnlock` · `VaultPasswordModal` · `MemberEditor` · `MemberAvatar` · `FirstRunSetup` · `LoginScreen` · `ColorPicker` · `FileCard` · `FileDropzone` · `FormMemberMultiSelect`

이 컴포넌트들은 `contexts/` 의 provider 와 Supabase 연결을 요구합니다.

**필수 환경 변수** (`.env.local`):
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

**Provider 래핑:**
```jsx
import { AuthProvider } from './908-doha-ui/contexts/AuthContext.jsx';
import { ToastProvider } from './908-doha-ui/contexts/ToastContext.jsx';
import { NotesProvider } from './908-doha-ui/contexts/NotesContext.jsx';
import { ViewportProvider } from './908-doha-ui/contexts/ViewportContext.jsx';

<ViewportProvider>
  <ToastProvider>
    <AuthProvider>
      <NotesProvider>
        <App />
      </NotesProvider>
    </AuthProvider>
  </ToastProvider>
</ViewportProvider>
```

> Supabase 를 쓰지 않는 프로젝트라면 A 트랙만 사용하거나, `lib/supabase.js` 를 자체 백엔드 클라이언트로 교체하면 됩니다.

## 3. 디자인 토큰

스타일 작성 시 raw 값 대신 CSS 변수를 사용하세요:

```jsx
<div style={{
  background: 'var(--accent-brand)',
  color: 'var(--text-inverted)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-4) var(--space-6)',
  transition: 'transform var(--dur-fast) var(--ease-soft)',
}}>
```

다크모드 전환:
```html
<html data-theme="dark">
```

## 4. Tailwind 를 쓰는 프로젝트

새 프로젝트의 `tailwind.config.js`:
```js
import preset from '../tailwind.preset.js'; // 원본 repo 의 preset 을 함께 복사하면 사용 가능
export default { presets: [preset], content: ['./src/**/*.{js,jsx}'] };
```

(preset 이 필요하면 원본 repo 루트의 `tailwind.preset.js` 를 같이 복사하세요.)

## 5. 알려진 한계

- 일부 컴포넌트(`Button`, `Toast`, `MemberAvatar` 등)에 `'#FFFFFF'` 가 하드코딩되어 있어, 다크모드/리브랜딩 시 토큰 (`var(--text-inverted)`) 으로 치환이 필요합니다.
- `lib/members.js` 의 멤버 색상 팔레트 7개는 hex 직접 값입니다 — 디자인 시스템 accent 토큰으로 옮길 수 있습니다.
- `Toast.jsx` 의 그림자가 elevation 토큰을 우회합니다.

## 6. 라이선스 / 출처

원본 디자인 시스템: 908 Doha Design System (MIT). Pretendard 폰트는 SIL OFL 라이선스.
