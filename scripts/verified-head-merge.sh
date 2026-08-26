#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  verified-head-merge.sh capture --repo <owner/repo> --pr <number>
  verified-head-merge.sh merge --repo <owner/repo> --pr <number> \
    --expected-head-sha <40-hex-sha> --expected-base-ref <ref> \
    --expected-base-sha <40-hex-sha> [--merge-method <merge|squash|rebase>] [--dry-run]

The capture command records the reviewed PR head and base identity before live checks.
The merge command re-reads all three values immediately before a conditional merge.

Exit status 2 means invalid arguments, 10 means STALE_REVIEW, and 12 means the
live PR identity or merge state could not be read or validated. Exit status 13
means the merge was refused because it did not complete, auto-merge was detected,
or auto-merge cancellation could not be safely verified.
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
expected_base_ref=''
expected_base_sha=''
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
    --expected-base-ref)
      [[ "$subcommand" == 'merge' ]] || usage_error "--expected-base-ref is only valid for merge"
      [[ $# -ge 2 ]] || usage_error "--expected-base-ref requires a value"
      expected_base_ref="$2"
      shift 2
      ;;
    --expected-base-sha)
      [[ "$subcommand" == 'merge' ]] || usage_error "--expected-base-sha is only valid for merge"
      [[ $# -ge 2 ]] || usage_error "--expected-base-sha requires a value"
      expected_base_sha="$2"
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
  [[ -n "$expected_base_ref" ]] || usage_error "--expected-base-ref is required for merge"
  [[ "$expected_base_ref" =~ ^[^[:space:]]+$ ]] || usage_error "--expected-base-ref must not contain whitespace"
  [[ -n "$expected_base_sha" ]] || usage_error "--expected-base-sha is required for merge"
  [[ "$expected_base_sha" =~ ^[0-9a-f]{40}$ ]] || usage_error "--expected-base-sha must be a 40-character lowercase hexadecimal SHA"

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

read_identity_snapshot() {
  local identity_snapshot
  local live_head_sha
  local live_base_ref
  local live_base_sha

  if ! identity_snapshot="$(gh pr view "$pr_number" --repo "$repo" \
    --json headRefOid,baseRefName,baseRefOid \
    --jq '[.headRefOid, .baseRefName, .baseRefOid] | @tsv')"; then
    printf 'error: failed to read live PR identity for %s#%s\n' "$repo" "$pr_number" >&2
    return 1
  fi

  IFS=$'\t' read -r live_head_sha live_base_ref live_base_sha <<< "$identity_snapshot"
  if [[ ! "$live_head_sha" =~ ^[0-9a-f]{40}$ ]] \
    || [[ ! "$live_base_ref" =~ ^[^[:space:]]+$ ]] \
    || [[ ! "$live_base_sha" =~ ^[0-9a-f]{40}$ ]]; then
    printf 'error: live PR identity is missing or invalid for %s#%s\n' "$repo" "$pr_number" >&2
    return 1
  fi

  printf '%s\t%s\t%s\n' "$live_head_sha" "$live_base_ref" "$live_base_sha"
}

read_merge_state() {
  local merge_state_snapshot

  if ! merge_state_snapshot="$(gh pr view "$pr_number" --repo "$repo" \
    --json state,mergedAt,autoMergeRequest \
    --jq '[.state, (.mergedAt // "NONE"), (if .autoMergeRequest == null then "NONE" else "PRESENT" end)] | @tsv')"; then
    printf 'error: failed to read post-merge state for %s#%s\n' "$repo" "$pr_number" >&2
    return 1
  fi

  printf '%s\n' "$merge_state_snapshot"
}

if [[ "$subcommand" == 'capture' ]]; then
  if ! captured_identity="$(read_identity_snapshot)"; then
    exit 12
  fi
  IFS=$'\t' read -r captured_head_sha captured_base_ref captured_base_sha <<< "$captured_identity"

  printf 'CAPTURED_HEAD_SHA=%s\n' "$captured_head_sha"
  printf 'CAPTURED_BASE_REF=%s\n' "$captured_base_ref"
  printf 'CAPTURED_BASE_SHA=%s\n' "$captured_base_sha"
  exit 0
fi

# All draft, check, approval, conflict, and review-thread gates are evaluated by
# the caller before this final head comparison. This adapter never uses --admin.
if ! current_identity="$(read_identity_snapshot)"; then
  exit 12
fi
IFS=$'\t' read -r current_head_sha current_base_ref current_base_sha <<< "$current_identity"

if [[ "$current_head_sha" != "$expected_head_sha" ]] \
  || [[ "$current_base_ref" != "$expected_base_ref" ]] \
  || [[ "$current_base_sha" != "$expected_base_sha" ]]; then
  printf 'STALE_REVIEW expected_head_sha=%s current_head_sha=%s expected_base_ref=%s current_base_ref=%s expected_base_sha=%s current_base_sha=%s\n' \
    "$expected_head_sha" "$current_head_sha" "$expected_base_ref" "$current_base_ref" \
    "$expected_base_sha" "$current_base_sha" >&2
  exit 10
fi

if [[ "$dry_run" == true ]]; then
  printf 'MERGE_READY expected_head_sha=%s expected_base_ref=%s expected_base_sha=%s\n' \
    "$expected_head_sha" "$expected_base_ref" "$expected_base_sha"
  printf 'DRY_RUN=gh pr merge %s --repo %s --match-head-commit %s --%s\n' \
    "$pr_number" "$repo" "$expected_head_sha" "$merge_method"
  printf 'AUTO_MERGE_GUARD=detect-post-state-and-cancel-with-gh-pr-merge-disable-auto\n'
  exit 0
fi

# `gh pr merge` can return success by enabling auto-merge for a merge-queue base
# while required checks are pending. The actual merge invocation must not include
# --disable-auto because that flag selects the separate cancellation operation.
# The post-command state check below detects an implicit auto-merge, cancels it,
# and prevents any non-merged result from being reported as accepted.
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

cancel_auto_merge() {
  local cancel_status=0
  local cancellation_state
  local cancellation_final_auto_merge

  if gh pr merge "$pr_number" --repo "$repo" --disable-auto >/dev/null; then
    :
  else
    cancel_status=$?
  fi

  if ! cancellation_state="$(read_merge_state)"; then
    printf 'AUTO_MERGE_CANCEL_FAILED expected_head_sha=%s expected_base_ref=%s expected_base_sha=%s status=%s state=UNREADABLE\n' \
      "$expected_head_sha" "$expected_base_ref" "$expected_base_sha" "$cancel_status" >&2
    return 1
  fi
  IFS=$'\t' read -r _ _ cancellation_final_auto_merge <<< "$cancellation_state"

  if [[ "$cancel_status" -ne 0 || "$cancellation_final_auto_merge" == 'PRESENT' ]]; then
    printf 'AUTO_MERGE_CANCEL_FAILED expected_head_sha=%s expected_base_ref=%s expected_base_sha=%s status=%s auto_merge=%s\n' \
      "$expected_head_sha" "$expected_base_ref" "$expected_base_sha" \
      "$cancel_status" "$cancellation_final_auto_merge" >&2
    return 1
  fi
}

merge_status=0
if gh "${merge_args[@]}"; then
  :
else
  merge_status=$?
fi

if ! merge_state="$(read_merge_state)"; then
  exit 12
fi
IFS=$'\t' read -r final_state final_merged_at final_auto_merge <<< "$merge_state"

if [[ "$final_auto_merge" == 'PRESENT' ]]; then
  cancel_auto_merge || exit 13
  printf 'AUTO_MERGE_REFUSED expected_head_sha=%s expected_base_ref=%s expected_base_sha=%s\n' \
    "$expected_head_sha" "$expected_base_ref" "$expected_base_sha" >&2
  exit 13
fi

if [[ "$merge_status" -ne 0 ]]; then
  printf 'error: conditional merge failed expected_head_sha=%s expected_base_ref=%s expected_base_sha=%s status=%s\n' \
    "$expected_head_sha" "$expected_base_ref" "$expected_base_sha" "$merge_status" >&2
  exit "$merge_status"
fi

if [[ "$final_state" != 'MERGED' || "$final_merged_at" == 'NONE' ]]; then
  printf 'MERGE_NOT_COMPLETED state=%s expected_head_sha=%s expected_base_ref=%s expected_base_sha=%s\n' \
    "$final_state" "$expected_head_sha" "$expected_base_ref" "$expected_base_sha" >&2
  exit 13
fi

printf 'MERGE_ACCEPTED expected_head_sha=%s expected_base_ref=%s expected_base_sha=%s\n' \
  "$expected_head_sha" "$expected_base_ref" "$expected_base_sha"
