# Typing Roguelike

Bun 워크스페이스로 구성한 Phaser 게임 클라이언트와 Express API 서버 모노레포입니다.
현재는 게임 개발을 시작하기 위한 실행 셸과 폴더 구조만 포함합니다.

## 요구 환경

- Bun 1.3 이상

## 시작하기

```bash
bun install
bun run dev
```

- 게임 클라이언트: `http://localhost:5173`
- API 서버: `http://localhost:3000`
- 상태 확인: `http://localhost:3000/health`

API는 별도 DB 서버 없이 `apps/api/data/game.sqlite`에 익명 플레이어, 활성 런,
노드 진입 체크포인트 이력, 종료 결과를 저장합니다. 로컬 개발에서는 기본적으로
`http://localhost:5173`을 CORS 허용 origin으로 사용합니다.

주요 엔드포인트:

- `POST /runs`: 익명 런 시작
- `GET /runs/active`: 현재 브라우저의 활성 런 조회
- `PUT /runs/:runId/checkpoint`: 노드 진입 직후 상태 저장
- `POST /runs/:runId/complete`: 사망·클리어·포기 결과 저장

개별 앱은 필터로 실행할 수 있습니다.

```bash
bun run dev:game
bun run dev:api
```

## 구조

```text
.
├── apps
│   ├── api                 # Express API 서버
│   │   └── src
│   │       ├── config      # 서버 환경 설정
│   │       ├── controllers # 요청·응답 처리
│   │       ├── middleware  # Express 미들웨어
│   │       ├── routes      # API 라우트
│   │       └── services    # 애플리케이션 로직
│   └── game                # Phaser CSR 클라이언트
│       ├── public/assets   # 정적 게임 리소스
│       └── src
│           ├── game
│           │   ├── entities # 게임 객체
│           │   ├── scenes   # Phaser Scene
│           │   └── systems  # 게임 시스템
│           └── styles       # 전역 스타일
└── packages
    └── shared              # 클라이언트·서버 공유 계약과 타입
```

## 검증

```bash
bun run typecheck
bun run build
```

게임 클라이언트는 정적 결과물인 `apps/game/dist`를 생성합니다. 배포 제공자가 확정되면 해당 디렉터리를 Cloudflare Pages 또는 Vercel에 연결할 수 있습니다.
