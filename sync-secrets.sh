#!/usr/bin/env bash
# Sync .env into GitHub Actions repository secrets via `gh secret set`.
# Requires the `gh` CLI authenticated against the repo's owner.
#
# Usage:
#   ./sync-secrets.sh              # sync every KEY from .env
#   ./sync-secrets.sh KEY1 KEY2    # sync only the listed keys

set -euo pipefail

ENV_FILE="$(dirname "$0")/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: $ENV_FILE not found" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh CLI not installed (https://cli.github.com)" >&2
  exit 1
fi

gh auth status >/dev/null 2>&1 || { echo "error: gh not authenticated — run 'gh auth login'" >&2; exit 1; }

filter=("$@")
in_filter() {
  [[ ${#filter[@]} -eq 0 ]] && return 0
  local k="$1"
  for f in "${filter[@]}"; do [[ "$f" == "$k" ]] && return 0; done
  return 1
}

count=0
while IFS= read -r line || [[ -n "$line" ]]; do
  # strip leading whitespace, skip blanks and comments
  line="${line#"${line%%[![:space:]]*}"}"
  [[ -z "$line" || "$line" == \#* ]] && continue

  key="${line%%=*}"
  val="${line#*=}"
  [[ "$key" == "$line" ]] && continue   # no '=' on the line

  # strip surrounding single or double quotes from value
  if [[ "$val" =~ ^\"(.*)\"$ ]] || [[ "$val" =~ ^\'(.*)\'$ ]]; then
    val="${BASH_REMATCH[1]}"
  fi

  in_filter "$key" || continue

  printf 'setting %s ... ' "$key"
  printf '%s' "$val" | gh secret set "$key" --body -
  count=$((count + 1))
done < "$ENV_FILE"

echo "synced $count secret(s)"
