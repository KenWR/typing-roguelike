#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  verified-head-merge.sh capture --repo <owner/repo> --pr <number>
  verified-head-merge.sh merge --repo <owner/repo> --pr <number> \
    --expected-head-sha <40-hex-sha> [--merge-method <merge|squash|rebase>] [--dry-run]

The capture command records the reviewed PR head before live checks.
The merge command re-reads the head immediately before a conditional merge.

Exit status 2 means invalid arguments, 10 means STALE_REVIEW, and 12 means the
live head SHA could not be read or validated.
USAGE
}

usage_error() {
  printf 'error: %s\n' "$1" >&2
  usage >&2
  exit 2
}

if [[ $# -eq 0 ]]; then
  usage_error "a subcommand is required: capture or merge"
fi

subcommand="$1"
shift

case "$subcommand" in
  capture|merge)
    ;;
  --help|-h)
    usage >&1
    exit 0
    ;;
  *)
    usage_error "unknown subcommand: $subcommand"
    ;;
esac

repo=''
pr_number=''
expected_head_sha=''
merge_method='squash'
dry_run=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      [[ $# -ge 2 ]] || usage_error "--repo requires a value"
      repo="$2"
      shift 2
      ;;
    --pr)
      [[ $# -ge 2 ]] || usage_error "--pr requires a value"
      pr_number="$2"
      shift 2
      ;;
    --expected-head-sha)
      [[ "$subcommand" == 'merge' ]] || usage_error "--expected-head-sha is only valid for merge"
      [[ $# -ge 2 ]] || usage_error "--expected-head-sha requires a value"
      expected_head_sha="$2"
      shift 2
      ;;
    --merge-method)
      [[ "$subcommand" == 'merge' ]] || usage_error "--merge-method is only valid for merge"
      [[ $# -ge 2 ]] || usage_error "--merge-method requires a value"
      merge_method="$2"
      shift 2
      ;;
    --dry-run)
      [[ "$subcommand" == 'merge' ]] || usage_error "--dry-run is only valid for merge"
      dry_run=true
      shift
      ;;
    --help|-h)
      usage >&1
      exit 0
      ;;
    *)
      usage_error "unknown argument: $1"
      ;;
  esac
done

[[ -n "$repo" ]] || usage_error "--repo is required"
[[ "$repo" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || usage_error "--repo must be owner/name"

[[ -n "$pr_number" ]] || usage_error "--pr is required"
[[ "$pr_number" =~ ^[1-9][0-9]*$ ]] || usage_error "--pr must be a positive integer"

if [[ "$subcommand" == 'merge' ]]; then
  [[ -n "$expected_head_sha" ]] || usage_error "--expected-head-sha is required for merge"
  [[ "$expected_head_sha" =~ ^[0-9a-f]{40}$ ]] || usage_error "--expected-head-sha must be a 40-character lowercase hexadecimal SHA"

  case "$merge_method" in
    merge|squash|rebase)
      ;;
    *)
      usage_error "--merge-method must be merge, squash, or rebase"
      ;;
  esac
fi

if ! command -v gh >/dev/null 2>&1; then
  printf 'error: GitHub CLI is required: gh\n' >&2
  exit 127
fi

read_head_sha() {
  local head_sha

  if ! head_sha="$(gh pr view "$pr_number" --repo "$repo" --json headRefOid --jq '.headRefOid')"; then
    printf 'error: failed to read live head SHA for %s#%s\n' "$repo" "$pr_number" >&2
    return 1
  fi

  if [[ ! "$head_sha" =~ ^[0-9a-f]{40}$ ]]; then
    printf 'error: live head SHA is missing or invalid for %s#%s\n' "$repo" "$pr_number" >&2
    return 1
  fi

  printf '%s\n' "$head_sha"
}

if [[ "$subcommand" == 'capture' ]]; then
  if ! captured_head_sha="$(read_head_sha)"; then
    exit 12
  fi

  printf 'CAPTURED_HEAD_SHA=%s\n' "$captured_head_sha"
  exit 0
fi

# All draft, check, approval, conflict, and review-thread gates are evaluated by
# the caller before this final head comparison. This adapter never uses --admin.
if ! current_head_sha="$(read_head_sha)"; then
  exit 12
fi

if [[ "$current_head_sha" != "$expected_head_sha" ]]; then
  printf 'STALE_REVIEW expected_head_sha=%s current_head_sha=%s\n' \
    "$expected_head_sha" "$current_head_sha" >&2
  exit 10
fi

if [[ "$dry_run" == true ]]; then
  printf 'MERGE_READY expected_head_sha=%s\n' "$expected_head_sha"
  printf 'DRY_RUN=gh pr merge %s --repo %s --%s --match-head-commit %s\n' \
    "$pr_number" "$repo" "$merge_method" "$expected_head_sha"
  exit 0
fi

merge_args=(
  pr merge "$pr_number"
  --repo "$repo"
  --match-head-commit "$expected_head_sha"
)
case "$merge_method" in
  merge)
    merge_args+=(--merge)
    ;;
  squash)
    merge_args+=(--squash)
    ;;
  rebase)
    merge_args+=(--rebase)
    ;;
esac

if gh "${merge_args[@]}"; then
  printf 'MERGE_ACCEPTED expected_head_sha=%s\n' "$expected_head_sha"
else
  merge_status=$?
  printf 'error: conditional merge failed expected_head_sha=%s\n' "$expected_head_sha" >&2
  exit "$merge_status"
fi
