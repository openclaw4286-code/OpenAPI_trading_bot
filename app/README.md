# 908doha Workspace · app

내부 업무 통합 툴. 명세서 v1.1을 구현하기 위한 React 앱 (Supabase 백엔드).

## 초기 세팅

### 1) Supabase 스키마 적용

1. Supabase 대시보드 → SQL Editor → New query
2. `supabase/migrations/0001_init.sql` 내용 전체 붙여넣기 → Run
3. Table Editor에서 `tasks`, `notes`, `files`, `vault`, `members` 5개 테이블 생성 확인

재실행해도 안전 (`if not exists`, `drop policy if exists`).

### 2) 환경 변수

로컬 개발:

```bash
cp app/.env.example app/.env.local
# .env.local 열어서 VITE_SUPABASE_ANON_KEY 채우기
# 키는 Supabase → Settings → API → Project API keys → anon/public
```

Vercel 배포:
Project → Settings → Environment Variables 에서 동일한 두 변수 추가
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

### 3) 개발 서버

```bash
cd app
npm install
npm run dev   # http://localhost:5173
```

## 현재 상태 (v0.3)

- **Board** — F-TASK / F-BOARD 칸반 · Supabase 실시간 동기화 (옵티미스틱 업데이트, 포커스 시 자동 리프레시)
- **Notes** — F-NOTE · 미구현
- **Files** — F-FILE · 미구현
- **Vault** — F-VAULT · 잠금 화면만. crypto 헬퍼 완성 (`src/lib/crypto.js`)

## 아키텍처

| 항목 | 선택 |
|---|---|
| 백엔드 | Supabase (Postgres + RLS + Realtime) |
| 저장 레이어 | 도메인별 테이블 + REST. 각 테이블에 v0.3 open anon RLS (인증 추가 전까지) |
| Vault | 단일 행 암호화 blob. AES-GCM 256 + PBKDF2-SHA256 600k (명세 7.2) |
| 파일 | Base64 ≤5MB (명세 3.4 옵션 A, v1 한정) |
| 프레임워크 | React 18 + Vite 5 + Tailwind 3 |
| 디자인 토큰 | 루트 `colors_and_type.css` + `../tailwind.preset.js` |

## 보안 참고

현재 모든 테이블 RLS는 anon에 열려있음 — 누구나 URL+anon key 조합이면
읽기/쓰기 가능. Vault blob은 클라이언트 사이드 암호화되어 안전하지만,
tasks/notes/files는 평문. **외부 노출 전에 인증(Magic Link/SSO) 붙이고
RLS를 사용자 scope로 좁혀야 합니다.**
