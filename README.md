# Typing Roguelike

Bun 워크스페이스로 구성한 Phaser 게임 클라이언트와 Express API 서버 모노레포입니다.
런 저장소는 Cloudflare D1을 사용하며, Express API는 저장소 주입 경계를 제공합니다.

## 요구 환경

- Bun 1.3 이상

## 시작하기

```bash
bun install
bun run dev:game
```

- 게임 클라이언트: `http://localhost:5173`

API Worker 런타임과 D1 바인딩 연결은 #259 범위입니다.

Express API는 `createApp({ repository })`로 생성합니다. Cloudflare Worker에서는
`env.DB`를 `createD1RunRepository(env.DB)`에 전달합니다. `apps/api/src/server.ts`는
`DB` 바인딩이 없는 단독 Bun 실행을 fail-fast로 종료합니다. 로컬 D1 마이그레이션은 다음
명령으로 실행하며, `--local`은 원격 D1을 수정하지 않습니다.

```bash
bun run --filter @typing-roguelike/api db:migrate:local
```

D1 설정은 `apps/api/wrangler.toml`에 있으며, 실제 원격 database ID 연결은 #260에서
환경별로 구성합니다.

맵 seed는 `RunState.map.seed`에 저장하며, 선택 경로(`choicePath`)와 seed를 사용해
라운드별 3개 노드와 전투 몬스터를 결정적으로 재생성합니다. 1라운드는 상점을 제외하고,
9라운드는 휴식, 10라운드는 보스를 포함합니다.

주요 엔드포인트:

- `POST /runs`: 익명 런 시작
- `GET /runs/active`: 현재 브라우저의 활성 런 조회
- `PUT /runs/:runId/checkpoint`: 노드 진입 직후 상태 저장
- `POST /runs/:runId/complete`: 사망·클리어·포기 결과 저장
- `GET /leaderboard?limit=20`: 점수순 리더보드 조회 (최대 100개)

`bun run dev:api`를 실행하려면 D1 바인딩을 제공하는 실행 경계가 필요합니다. Worker
진입점 연결은 #259에서 추가합니다.

## 구조

```text
.
├── apps
│   ├── api                 # Express API 서버
│   │   ├── migrations      # D1 SQL 마이그레이션
│   │   └── src
│   │       ├── config      # 서버 환경 설정
│   │       ├── repositories # D1 저장소와 저장소 인터페이스
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

## UI 구현 참고

게임 UI를 구현하거나 리뷰할 때는 [UI/UX 원칙: Mood & Visual Direction](docs/ui-ux-principles.md)을 먼저 확인합니다. 문서에는 `dark fantasy × magical documents × tower exploration` 무드, 화면별 시각 방향, 판독성 기준, AI/UI 작업 규칙이 정리되어 있습니다.

## 검증

```bash
bun run typecheck
bun run build
bun run --filter @typing-roguelike/api test
```

게임 클라이언트는 정적 결과물인 `apps/game/dist`를 생성합니다. Cloudflare Workers Static Assets 배포 설정과 로컬 검증 절차는 [게임 Worker 배포 문서](docs/game-workers-static-assets.md)에 정리되어 있습니다.
