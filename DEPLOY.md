# Vercel 배포 가이드

Vercel은 **워크스페이스 앱만** 배포합니다.

- `/` — 908doha Workspace (React/Vite, `app/` 에서 빌드)

디자인 시스템은 워크스페이스 앱 안에 토큰(CSS variables) + Tailwind
preset으로 **내장**되어 있습니다. 별도 페이지로 서빙하지 않습니다.
루트의 `index.html`·`docs/`·`preview/`는 로컬 참고용으로만 사용.

## 환경 변수

Vercel → Project → Settings → Environment Variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

환경 변수는 빌드 타임에 번들에 주입됩니다. 변수 추가/변경 후에는
반드시 Deployments → 최신 배포 → **Redeploy** 실행하세요.

## 로컬 빌드 재현

```bash
cd app && npm ci && npm run build
# 결과: app/dist/ — 이게 Vercel의 outputDirectory와 동일
```

## 1) 프로젝트 다운로드 & 압축 해제
받은 ZIP을 원하는 위치에 풀어주세요.

```bash
cd ~/Downloads/908-doha-design-system
```

## 2) Claude Code 실행
```bash
claude
```

그리고 Claude Code 안에서 이렇게 요청하면 됩니다:

> "이 폴더를 Vercel에 배포해줘. 정적 HTML 프로젝트이고 `index.html`이 메인 페이지야. `vercel.json`은 이미 있어."

## 3) 수동으로 배포하는 경우

### 방법 A — Vercel CLI (가장 간단)
```bash
npm i -g vercel
vercel login        # 최초 1회
vercel              # 프리뷰 배포
vercel --prod       # 프로덕션 배포
```

처음 실행하면 이런 질문이 나옵니다:
- `Set up and deploy?` → **Y**
- `Which scope?` → 본인 계정 선택
- `Link to existing project?` → **N**
- `Project name?` → `908-doha-design-system` (원하는 이름)
- `Which directory is your code in?` → `./` (그냥 엔터)
- `Override settings?` → **N**

끝나면 `https://908-doha-design-system.vercel.app` 같은 URL을 줍니다.

### 방법 B — GitHub + Vercel 대시보드
1. GitHub에 새 repo 만들기
2. 로컬에서:
   ```bash
   git init
   git add .
   git commit -m "initial"
   git branch -M main
   git remote add origin https://github.com/USERNAME/REPO.git
   git push -u origin main
   ```
3. [vercel.com/new](https://vercel.com/new) → GitHub repo import → Deploy

이후 push할 때마다 자동 배포됩니다.

## 4) 도메인 연결 (선택)
Vercel 대시보드 → Project → Settings → Domains → 도메인 추가

## 설정 파일 설명
- **`vercel.json`** — `/` 요청이 `/index.html`로 가도록, 깔끔한 URL(`.html` 숨김)을 켜는 최소 설정.
- **`index.html`** — 랜딩 페이지. 모바일 프로토타입과 디자인 시스템 프리뷰로 연결됩니다.

## 파일명에 공백이 있을 때
`908 Doha Toast.html`처럼 공백이 있는 파일도 Vercel에서 잘 서빙되지만, URL에서는 `%20`으로 인코딩됩니다. 신경 쓰이면 `908-doha-toast.html`로 바꾸세요.
