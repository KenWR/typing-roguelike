#!/usr/bin/env bash
set -euo pipefail

scripts_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
script="$scripts_dir/verified-head-merge.sh"
fixture_dir="$(mktemp -d)"
trap 'rm -rf "$fixture_dir"' EXIT

mock_bin="$fixture_dir/bin"
mkdir -p "$mock_bin"
mock_gh="$mock_bin/gh"
mock_heads="$fixture_dir/heads"
mock_count="$fixture_dir/count"
mock_log="$fixture_dir/gh.log"

cat > "$mock_gh" <<'MOCK_GH'
#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ge 2 && "$1" == 'pr' && "$2" == 'view' ]]; then
  printf 'view' >> "$MOCK_GH_LOG"
  for argument in "$@"; do
    printf ' %s' "$argument" >> "$MOCK_GH_LOG"
  done
  printf '\n' >> "$MOCK_GH_LOG"
  count="$(<"$MOCK_GH_COUNT")"
  line_number=$((count + 1))
  head_sha="$(sed -n "${line_number}p" "$MOCK_GH_HEADS")"
  [[ -n "$head_sha" ]] || exit 44
  printf '%s' "$line_number" > "$MOCK_GH_COUNT"
  printf '%s\n' "$head_sha"
  exit 0
fi

if [[ $# -ge 2 && "$1" == 'pr' && "$2" == 'merge' ]]; then
  printf 'merge' >> "$MOCK_GH_LOG"
  for argument in "$@"; do
    printf ' %s' "$argument" >> "$MOCK_GH_LOG"
  done
  printf '\n' >> "$MOCK_GH_LOG"
  exit 0
fi

printf 'unexpected gh invocation\n' >&2
exit 45
MOCK_GH
chmod +x "$mock_gh"

export PATH="$mock_bin:$PATH"
export MOCK_GH_HEADS="$mock_heads"
export MOCK_GH_COUNT="$mock_count"
export MOCK_GH_LOG="$mock_log"

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

write_heads() {
  printf '%s\n' "$@" > "$MOCK_GH_HEADS"
  printf '0\n' > "$MOCK_GH_COUNT"
  : > "$MOCK_GH_LOG"
}

valid_sha='0123456789abcdef0123456789abcdef01234567'
changed_sha='fedcba9876543210fedcba9876543210fedcba98'

if output="$($script 2>&1)"; then
  fail 'missing subcommand was accepted'
else
  status=$?
  [[ $status -eq 2 ]] || fail "missing subcommand status was $status"
  assert_contains "$output" 'Usage:'
fi

if output="$($script merge --repo KenWR/typing-roguelike --pr 7 2>&1)"; then
  fail 'missing expected SHA was accepted'
else
  status=$?
  [[ $status -eq 2 ]] || fail "missing expected SHA status was $status"
  assert_contains "$output" '--expected-head-sha is required'
fi

if output="$($script merge --repo KenWR/typing-roguelike --pr 7 --expected-head-sha invalid 2>&1)"; then
  fail 'invalid expected SHA was accepted'
else
  status=$?
  [[ $status -eq 2 ]] || fail "invalid expected SHA status was $status"
  assert_contains "$output" '40-character lowercase hexadecimal SHA'
fi

if output="$($script capture --repo KenWR/typing-roguelike --pr 0 2>&1)"; then
  fail 'invalid PR number was accepted'
else
  status=$?
  [[ $status -eq 2 ]] || fail "invalid PR number status was $status"
  assert_contains "$output" 'positive integer'
fi

write_heads "$valid_sha"
output="$($script capture --repo KenWR/typing-roguelike --pr 7)"
assert_contains "$output" "CAPTURED_HEAD_SHA=$valid_sha"
assert_contains "$(<"$MOCK_GH_LOG")" 'view'

write_heads "$valid_sha"
output="$($script merge --repo KenWR/typing-roguelike --pr 7 --expected-head-sha "$valid_sha" --merge-method squash)"
assert_contains "$output" "MERGE_ACCEPTED expected_head_sha=$valid_sha"
merge_log="$(<"$MOCK_GH_LOG")"
assert_contains "$merge_log" '--match-head-commit'
assert_contains "$merge_log" "$valid_sha"
assert_contains "$merge_log" '--squash'

write_heads 'invalid-head-sha'
if output="$($script merge --repo KenWR/typing-roguelike --pr 7 --expected-head-sha "$valid_sha" 2>&1)"; then
  fail 'invalid live SHA was accepted'
else
  status=$?
  [[ $status -eq 12 ]] || fail "invalid live SHA status was $status"
  assert_contains "$output" 'live head SHA is missing or invalid'
  assert_not_contains "$(<"$MOCK_GH_LOG")" 'merge'
fi

write_heads "$changed_sha"
if output="$($script merge --repo KenWR/typing-roguelike --pr 7 --expected-head-sha "$valid_sha" 2>&1)"; then
  fail 'changed head was accepted'
else
  status=$?
  [[ $status -eq 10 ]] || fail "changed head status was $status"
  assert_contains "$output" "STALE_REVIEW expected_head_sha=$valid_sha current_head_sha=$changed_sha"
  assert_not_contains "$(<"$MOCK_GH_LOG")" 'merge'
fi

write_heads "$valid_sha"
output="$($script merge --repo KenWR/typing-roguelike --pr 7 --expected-head-sha "$valid_sha" --dry-run)"
assert_contains "$output" "MERGE_READY expected_head_sha=$valid_sha"
assert_contains "$output" "--match-head-commit $valid_sha"
assert_not_contains "$(<"$MOCK_GH_LOG")" 'merge'

printf 'verified-head-merge fixture tests passed\n'
