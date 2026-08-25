---
name: git-commit
description: >
  Review current repository changes, stage the intended files, and create a project-compliant Git commit.
---

# Git Commit Skill

현재 변경사항을 확인하고 프로젝트 규칙에 맞는 커밋 메시지를 작성한 뒤, 의도된 파일을 스테이징하고 커밋합니다.

## 실행 절차

1. `git status --short --untracked-files=all`과 관련 diff를 확인합니다.
2. 변경 범위와 기존 사용자 변경사항을 확인합니다. 요청 범위에 해당하는 파일만 커밋 대상으로 선택합니다.
3. 아래 규칙에 맞는 Header와 Body를 작성합니다.
4. 선택한 파일만 명시적으로 `git add`한 뒤 `git commit`을 실행합니다.
5. `git status --short`와 최신 커밋 정보를 확인하고 실제 결과를 보고합니다.

변경 범위가 불명확하거나 무관한 사용자 변경사항이 함께 있으면 커밋을 중단하고 확인을 요청합니다. 변경사항이 없으면 커밋을 만들지 않고 상태를 보고합니다.

## 프로젝트 규칙

### Header

- 형식은 `type(scope): description`입니다.
- `type`은 다음 목록에서 선택합니다.
  - `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `build`, `ci`, `perf`, `revert`
- `scope`는 필수입니다. 변경 경로의 의미 단위를 사용합니다.
  - `.codex/config.toml`은 `config`를 사용합니다.
  - `.agents/skills/...`는 `skill`을 사용합니다.
- Breaking change를 허용합니다.
  - Header에는 `type(scope)!: description` 형식을 사용할 수 있습니다.
  - Footer에는 `BREAKING CHANGE: <description>` 형식을 사용할 수 있습니다.

### Body

- Body는 필수입니다.
- 변경 이유와 핵심 내용을 분명하고 구체적인 표현으로 작성합니다.
- 미사여구와 불필요한 단어를 사용하지 않습니다.

## 실행 및 안전 규칙

- 이 스킬을 호출하면 커밋 메시지 작성과 Git stage 및 commit 실행까지 수행합니다.
- `git add .`처럼 범위가 넓은 명령은 사용하지 않습니다. 선택한 경로를 명시적으로 스테이징합니다.
- `git reset --hard`, `git checkout --`, 강제 push, amend는 사용자의 명시적 요청 없이 실행하지 않습니다.
- 커밋이 실패하면 실제 오류를 보고하고 성공으로 표시하지 않습니다.
- 사용자별 환경 설정은 커밋 메시지에 반영하지 않습니다.
