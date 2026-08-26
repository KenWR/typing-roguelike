---
title: "Notion local export"
exported_at: "2026-08-26"
database_url: "https://app.notion.com/p/c6bf6543290c4e7aa72e70740017bafd?v=3c712168d5218108a55e000cef34e5ce&source=copy_link"
project_url: "https://app.notion.com/p/3c612168d521804f9ed4c8c7f9471df0"
source_page_count: 11
kanban_rows_exported: 165
---

# Notion local export

연결된 Notion 원문 페이지를 2026-08-26 기준으로 로컬에 저장한 스냅샷입니다.

## Current limitation

칸반 데이터베이스의 API 행 조회는 Notion `Query Data Source` 사용 한도에 도달했습니다. 브라우저의 Notion 내보내기 기능으로 전체 CSV 165개 행을 로컬에 저장했습니다.

## Files

- [CEX Project Kanban 원본 뷰](https://app.notion.com/p/c6bf6543290c4e7aa72e70740017bafd?v=3c712168d5218108a55e000cef34e5ce&source=copy_link)
- [프로젝트 페이지](./sources/00-typing-roguelike-3c612168d521.md)
- [Computer Use CSV export](./computer-use-export/README.md)
- [추가 위키·구조 문서 원본](./pages/README.md)

## GitHub issue import

- 전체 Kanban의 Task 101개를 기존 이슈와 대조했습니다.
- 기존 이슈 51개는 그대로 연결했습니다.
- 새 이슈 50개를 생성했습니다. 범위는 [#147](https://github.com/KenWR/typing-roguelike/issues/147)부터 [#196](https://github.com/KenWR/typing-roguelike/issues/196)까지입니다.
- 새 이슈 중 47개는 열림 상태이며, Notion `Done` 카드 3개는 완료 상태로 닫았습니다.
- 새 이슈 본문에는 원본 Notion 작업 ID를 숨은 import 표식으로 기록했습니다.

### Linked source pages

- [🗼 탑과 런](./sources/01-탑과-런-3c612168d521.md)
- [⌨️ typing-roguelike 초기 제품 스펙 v0.2](./sources/02-typing-roguelike-초기-제품-스펙-v0-2-3c612168d521.md)
- [🏁 OpenAI Game Builders Seoul 2026 — 해커톤 정보](./sources/03-openai-game-builders-seoul-2026-해커톤-정보-3c712168d521.md)
- [👹 적과 보스](./sources/04-적과-보스-3c612168d521.md)
- [⌨️ 전투 시스템](./sources/05-전투-시스템-3c612168d521.md)
- [✨ 스킬과 커맨드](./sources/06-스킬과-커맨드-3c612168d521.md)
- [⚔️ 장비](./sources/07-장비-3c612168d521.md)
- [🖥️ UI·UX 원칙](./sources/08-ui-ux-원칙-3c612168d521.md)
- [💰 재화와 정산](./sources/09-재화와-정산-3c612168d521.md)
- [🏺 유물](./sources/10-유물-3c612168d521.md)
- [에셋 크기](./sources/11-에셋-크기-3c712168d521.md)

## Database schema captured

- `Name` — title
- `Acceptance Criteria` — text
- `Assignee` — person
- `Blocked By` — relation
- `Children` — relation
- `GitHub Issue` — URL
- `GitHub PR` — URL
- `Level` — Epic / Feature / Task
- `Objective` — text
- `Parent` — relation
- `Phase` — Phase 0 through Phase 5
- `Priority` — P0 through P4
- `Related Tasks` — relation
- `Source` — URL
- `Status` — Backlog / Ready / In Progress / Blocked / Review / Done
- `Subtype` — project-specific select
- `Type` — Gameplay / Frontend / Backend / Infrastructure / Assets / Game Design / Balance / Audio / QA / Deploy / Documentation / Submission

## Exported Kanban data

- `computer-use-export/CEX Project Kanban-all-content.csv` — 전체 데이터베이스 165개 행
- `computer-use-export/CEX Project Kanban-current-view.csv` — 현재 `Kanban — Status` 뷰 101개 행
