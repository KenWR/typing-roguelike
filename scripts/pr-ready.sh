#!/usr/bin/env bash
set -euo pipefail

usage() {
  printf 'Usage: %s <pr-number>\n' "${0##*/}" >&2
}

if [[ $# -ne 1 ]]; then
  usage
  exit 2
fi

pr_number="$1"

if [[ ! "$pr_number" =~ ^[0-9]+$ ]]; then
  printf 'error: PR number must be numeric: %s\n' "$pr_number" >&2
  usage
  exit 2
fi

if ! command -v gh >/dev/null 2>&1; then
  printf 'error: GitHub CLI is required: gh\n' >&2
  exit 127
fi

gh pr ready "$pr_number"
