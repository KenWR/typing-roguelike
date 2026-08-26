# Codex project setup

## Skills

- `phaser-gamedev`: Phaser 3 구현과 구조를 위한 저장소 스킬입니다.
- `github-pr`: 변경 검토, 검증, 템플릿 적용, GitHub PR 생성과 상태 확인을 위한 저장소 스킬입니다.
- `taste-bootstrap`, `create-specification`, `playwright`: 사용자 범위에 설치된 기존 스킬을 사용합니다.

Codex는 저장소 루트의 `.agents/skills`를 자동으로 탐색합니다. 새 스킬이 목록에 보이지 않으면 Codex를 다시 시작합니다.

## Agents

모든 프로젝트 에이전트는 `gpt-5.6-luna`와 `max` reasoning으로 고정합니다.

| Agent | Responsibility | Access |
|---|---|---|
| `code-mapper` | 실행 경로와 영향 범위 조사 | read-only |
| `docs-researcher` | Phaser 3, Bun, Vite, Express 공식 문서 조사 | read-only |
| `game-worker` | `apps/game` 구현 | workspace-write |
| `api-worker` | `apps/api`, `packages/shared` 구현 | workspace-write |
| `test-manager` | 테스트 계획과 결과 통합 | workspace-write |
| `e2e-tester` | 브라우저와 API E2E 검증 | workspace-write |
| `reviewer` | 정확성, 보안, 성능, 테스트 공백 검토 | read-only |
| `verifier` | 최종 타입 검사, 빌드, 실행 검증 | workspace-write |
| `PR-merger` | GitHub PR의 live 상태, 병합 조건, 최종 상태 확인 | workspace-write |

동시에 실행하는 하위 에이전트는 최대 6개입니다. 구현 에이전트에는 작업마다 파일 소유권을 지정해야 합니다.
