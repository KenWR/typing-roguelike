---
name: github-pr
description: Create or update a GitHub pull request for this repository, including change review, verification, template selection, push, and final live-state confirmation.
---

# GitHub Pull Request Skill

이 저장소의 변경사항을 검토하고 검증한 뒤 GitHub Pull Request를 생성하거나 갱신합니다.

## 범위 확인

1. `git status --short --untracked-files=all`, 현재 브랜치, upstream, `origin`을 확인합니다.
2. base 브랜치는 사용자가 지정한 값을 우선합니다. 지정이 없으면 원격 저장소의 기본 브랜치를 확인합니다.
3. base와 비교한 commit 및 diff를 검토하고 PR에 포함될 변경만 확인합니다.
4. 사용자 변경사항과 무관한 파일이 섞였거나 현재 브랜치가 base 브랜치이면 PR 생성을 중단하고 사용자에게 확인합니다.

PR 생성 요청에는 현재 PR 브랜치를 원격에 push하고 `gh pr create`를 실행하는 과정이 포함됩니다. 새 변경을 자동으로 커밋하거나 기존 커밋을 수정하지 않습니다. 커밋이 필요하면 사용자의 승인을 확인하고 `git-commit` 스킬을 사용합니다.

## 제목과 본문

- 제목은 `type(scope): description` 형식을 사용합니다.
- `type`은 `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `build`, `ci`, `perf`, `revert` 중에서 선택합니다.
- scope는 변경의 핵심 영역인 `game`, `api`, `shared`, `config`, `skill`, `docs` 등을 사용합니다.
- 본문은 실제 diff와 검증 결과만 기록합니다. 수행하지 않은 검증은 완료로 표시하지 않습니다.
- 연결된 이슈가 있으면 `Closes #<number>`를 사용합니다. 이슈 번호를 추측하지 않습니다.
- 사용자 요청이 없으면 일반 PR로 생성합니다. Draft는 사용자가 요청했을 때만 사용합니다.

변경 성격에 맞는 템플릿을 사용합니다.

- 일반 변경: `.github/pull_request_template.md`
- 기능: `.github/PULL_REQUEST_TEMPLATE/feature.md`
- 버그 수정: `.github/PULL_REQUEST_TEMPLATE/bugfix.md`

템플릿의 안내 주석, 빈 항목, 적용되지 않는 섹션은 제출 전에 정리합니다. 체크박스는 실제 상태와 일치시킵니다.

## 검증과 생성

1. 변경 범위에 맞는 최소 검증을 실행합니다. 저장소 전체 변경은 기본적으로 `bun run typecheck`와 `bun run build`를 실행합니다.
2. 실패한 검증과 실행하지 못한 검증을 본문에 그대로 기록합니다. 환경 문제와 코드 실패를 구분합니다.
3. `git diff --check`와 base 대비 최종 diff를 확인합니다.
4. 현재 브랜치를 명시적으로 push한 뒤 `gh pr create --base <base> --head <branch> --title <title> --body-file <file>`로 PR을 생성합니다.
5. 이미 열린 PR이 있으면 중복 생성하지 않고 `gh pr edit`로 요청된 내용만 갱신합니다.
6. `gh pr view`로 URL, 제목, base/head, Draft 여부, 상태를 다시 확인합니다.

강제 push, base 브랜치 직접 push, PR merge, review 제출은 사용자의 별도 요청 없이 수행하지 않습니다. GitHub 인증 또는 네트워크 오류가 발생하면 PR이 생성되었다고 보고하지 않습니다.

## 완료 보고

PR URL, 제목, base/head 브랜치, 실행한 검증과 결과를 간결하게 보고합니다. 남은 실패나 미검증 항목이 있으면 함께 명시합니다.
