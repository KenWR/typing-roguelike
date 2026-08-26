#!/usr/bin/env bash
set -euo pipefail

scripts_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
script="$scripts_dir/verified-head-merge.sh"
fixture_dir="$(mktemp -d)"
trap 'rm -rf "$fixture_dir"' EXIT

mock_bin="$fixture_dir/bin"
mkdir -p "$mock_bin"
mock_gh="$mock_bin/gh"
mock_identity="$fixture_dir/identity"
mock_log="$fixture_dir/gh.log"
mock_merge_state="$fixture_dir/merge-state"

cat > "$mock_gh" <<'MOCK_GH'
#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ge 2 && "$1" == 'pr' && "$2" == 'view' ]]; then
  printf 'view' >> "$MOCK_GH_LOG"
  for argument in "$@"; do
    printf ' %s' "$argument" >> "$MOCK_GH_LOG"
  done
  printf '\n' >> "$MOCK_GH_LOG"
  state_query=false
  for argument in "$@"; do
    if [[ "$argument" == 'state,mergedAt,autoMergeRequest' ]]; then
      state_query=true
      break
    fi
  done
  if [[ "$state_query" == true ]]; then
    cat "$MOCK_GH_MERGE_STATE"
    exit 0
  fi
  cat "$MOCK_GH_IDENTITY"
  exit 0
fi

if [[ $# -ge 2 && "$1" == 'pr' && "$2" == 'merge' ]]; then
  printf 'merge' >> "$MOCK_GH_LOG"
  for argument in "$@"; do
    printf ' %s' "$argument" >> "$MOCK_GH_LOG"
  done
  printf '\n' >> "$MOCK_GH_LOG"

  has_disable_auto=false
  for argument in "$@"; do
    if [[ "$argument" == '--disable-auto' ]]; then
      has_disable_auto=true
      break
    fi
  done
  case "${MOCK_GH_MERGE_MODE:-merged}" in
    merged)
      printf 'MERGED\t2026-08-26T12:00:00Z\tNONE\n' > "$MOCK_GH_MERGE_STATE"
      ;;
    pending-auto)
      if [[ "$has_disable_auto" == true ]]; then
        printf 'OPEN\tNONE\tNONE\n' > "$MOCK_GH_MERGE_STATE"
        printf 'required checks are pending\n' >&2
        exit 78
      fi
      printf 'OPEN\tNONE\tPRESENT\n' > "$MOCK_GH_MERGE_STATE"
      ;;
    implicit-auto)
      printf 'OPEN\tNONE\tPRESENT\n' > "$MOCK_GH_MERGE_STATE"
      ;;
    *)
      printf 'unknown merge mode\n' >&2
      exit 46
      ;;
  esac
  exit 0
fi

printf 'unexpected gh invocation\n' >&2
exit 45
MOCK_GH
chmod +x "$mock_gh"

export PATH="$mock_bin:$PATH"
export MOCK_GH_IDENTITY="$mock_identity"
export MOCK_GH_LOG="$mock_log"
export MOCK_GH_MERGE_STATE="$mock_merge_state"

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

assert_contains() {
  local actual="$1"
  local expected="$2"
  [[ "$actual" == *"$expected"* ]] || fail "expected '$expected' in '$actual'"
}

assert_not_contains() {
  local actual="$1"
  local unexpected="$2"
  [[ "$actual" != *"$unexpected"* ]] || fail "did not expect '$unexpected' in '$actual'"
}

write_identity() {
  printf '%s\t%s\t%s\n' "$1" "$2" "$3" > "$MOCK_GH_IDENTITY"
  : > "$MOCK_GH_LOG"
  printf 'OPEN\tNONE\tNONE\n' > "$MOCK_GH_MERGE_STATE"
}

valid_sha='0123456789abcdef0123456789abcdef01234567'
changed_sha='fedcba9876543210fedcba9876543210fedcba98'
base_sha='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
changed_base_sha='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

if output="$($script 2>&1)"; then
  fail 'missing subcommand was accepted'
else
  status=$?
  [[ $status -eq 2 ]] || fail "missing subcommand status was $status"
  assert_contains "$output" 'Usage:'
fi

if output="$($script merge --repo KenWR/typing-roguelike --pr 7 --expected-head-sha "$valid_sha" 2>&1)"; then
  fail 'missing expected base identity was accepted'
else
  status=$?
  [[ $status -eq 2 ]] || fail "missing expected base identity status was $status"
  assert_contains "$output" '--expected-base-ref is required'
fi

if output="$($script merge --repo KenWR/typing-roguelike --pr 7 --expected-head-sha invalid --expected-base-ref main --expected-base-sha "$base_sha" 2>&1)"; then
  fail 'invalid expected SHA was accepted'
else
  status=$?
  [[ $status -eq 2 ]] || fail "invalid expected SHA status was $status"
  assert_contains "$output" '40-character lowercase hexadecimal SHA'
fi

if output="$($script merge --repo KenWR/typing-roguelike --pr 7 --expected-head-sha "$valid_sha" --expected-base-ref main 2>&1)"; then
  fail 'missing expected base SHA was accepted'
else
  status=$?
  [[ $status -eq 2 ]] || fail "missing expected base SHA status was $status"
  assert_contains "$output" '--expected-base-sha is required'
fi

if output="$($script merge --repo KenWR/typing-roguelike --pr 7 --expected-head-sha "$valid_sha" --expected-base-ref 'main branch' --expected-base-sha "$base_sha" 2>&1)"; then
  fail 'invalid expected base ref was accepted'
else
  status=$?
  [[ $status -eq 2 ]] || fail "invalid expected base ref status was $status"
  assert_contains "$output" 'must not contain whitespace'
fi

if output="$($script merge --repo KenWR/typing-roguelike --pr 7 --expected-head-sha "$valid_sha" --expected-base-ref main --expected-base-sha invalid 2>&1)"; then
  fail 'invalid expected base SHA was accepted'
else
  status=$?
  [[ $status -eq 2 ]] || fail "invalid expected base SHA status was $status"
  assert_contains "$output" '40-character lowercase hexadecimal SHA'
fi

if output="$($script capture --repo KenWR/typing-roguelike --pr 0 2>&1)"; then
  fail 'invalid PR number was accepted'
else
  status=$?
  [[ $status -eq 2 ]] || fail "invalid PR number status was $status"
  assert_contains "$output" 'positive integer'
fi

write_identity "$valid_sha" main "$base_sha"
output="$($script capture --repo KenWR/typing-roguelike --pr 7)"
assert_contains "$output" "CAPTURED_HEAD_SHA=$valid_sha"
assert_contains "$output" 'CAPTURED_BASE_REF=main'
assert_contains "$output" "CAPTURED_BASE_SHA=$base_sha"
assert_contains "$(<"$MOCK_GH_LOG")" 'view'

export MOCK_GH_MERGE_MODE=merged
write_identity "$valid_sha" main "$base_sha"
output="$($script merge --repo KenWR/typing-roguelike --pr 7 --expected-head-sha "$valid_sha" --expected-base-ref main --expected-base-sha "$base_sha" --merge-method squash)"
assert_contains "$output" "MERGE_ACCEPTED expected_head_sha=$valid_sha expected_base_ref=main expected_base_sha=$base_sha"
merge_log="$(<"$MOCK_GH_LOG")"
assert_contains "$merge_log" '--match-head-commit'
assert_contains "$merge_log" "$valid_sha"
assert_contains "$merge_log" '--squash'
assert_contains "$merge_log" '--disable-auto'

write_identity 'invalid-head-sha' main "$base_sha"
if output="$($script merge --repo KenWR/typing-roguelike --pr 7 --expected-head-sha "$valid_sha" --expected-base-ref main --expected-base-sha "$base_sha" 2>&1)"; then
  fail 'invalid live SHA was accepted'
else
  status=$?
  [[ $status -eq 12 ]] || fail "invalid live SHA status was $status"
  assert_contains "$output" 'live PR identity is missing or invalid'
  assert_not_contains "$(<"$MOCK_GH_LOG")" 'merge'
fi

write_identity "$changed_sha" main "$base_sha"
if output="$($script merge --repo KenWR/typing-roguelike --pr 7 --expected-head-sha "$valid_sha" --expected-base-ref main --expected-base-sha "$base_sha" 2>&1)"; then
  fail 'changed head was accepted'
else
  status=$?
  [[ $status -eq 10 ]] || fail "changed head status was $status"
  assert_contains "$output" "STALE_REVIEW expected_head_sha=$valid_sha current_head_sha=$changed_sha"
  assert_not_contains "$(<"$MOCK_GH_LOG")" 'merge'
fi

write_identity "$valid_sha" release "$changed_base_sha"
if output="$($script merge --repo KenWR/typing-roguelike --pr 7 --expected-head-sha "$valid_sha" --expected-base-ref main --expected-base-sha "$base_sha" 2>&1)"; then
  fail 'changed base was accepted'
else
  status=$?
  [[ $status -eq 10 ]] || fail "changed base status was $status"
  assert_contains "$output" "STALE_REVIEW expected_head_sha=$valid_sha current_head_sha=$valid_sha expected_base_ref=main current_base_ref=release expected_base_sha=$base_sha current_base_sha=$changed_base_sha"
  assert_not_contains "$(<"$MOCK_GH_LOG")" 'merge'
fi

export MOCK_GH_MERGE_MODE=pending-auto
write_identity "$valid_sha" main "$base_sha"
if output="$($script merge --repo KenWR/typing-roguelike --pr 7 --expected-head-sha "$valid_sha" --expected-base-ref main --expected-base-sha "$base_sha" 2>&1)"; then
  fail 'pending checks were accepted'
else
  status=$?
  [[ $status -eq 78 ]] || fail "pending checks status was $status"
  assert_contains "$output" 'conditional merge failed'
  assert_not_contains "$output" 'MERGE_ACCEPTED'
  assert_contains "$(<"$MOCK_GH_LOG")" '--disable-auto'
fi

export MOCK_GH_MERGE_MODE=implicit-auto
write_identity "$valid_sha" main "$base_sha"
if output="$($script merge --repo KenWR/typing-roguelike --pr 7 --expected-head-sha "$valid_sha" --expected-base-ref main --expected-base-sha "$base_sha" 2>&1)"; then
  fail 'implicit auto-merge was accepted'
else
  status=$?
  [[ $status -eq 13 ]] || fail "implicit auto-merge status was $status"
  assert_contains "$output" 'AUTO_MERGE_REFUSED'
  assert_not_contains "$output" 'MERGE_ACCEPTED'
fi

export MOCK_GH_MERGE_MODE=merged
write_identity "$valid_sha" main "$base_sha"
output="$($script merge --repo KenWR/typing-roguelike --pr 7 --expected-head-sha "$valid_sha" --expected-base-ref main --expected-base-sha "$base_sha" --dry-run)"
assert_contains "$output" "MERGE_READY expected_head_sha=$valid_sha expected_base_ref=main expected_base_sha=$base_sha"
assert_contains "$output" "--disable-auto --match-head-commit $valid_sha"
assert_not_contains "$(<"$MOCK_GH_LOG")" 'merge'

printf 'verified-head-merge fixture tests passed\n'
