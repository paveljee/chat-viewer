#!/usr/bin/env bash
set -euo pipefail

MISE_VERSION="2026.4.11"
MISE_BIN="${HOME}/.local/bin/mise"
BUN_VERSION="$(awk '$1 == "bun" { print $2; exit }' .tool-versions)"

if [ -z "${BUN_VERSION}" ]; then
  echo "Expected a pinned bun version in .tool-versions." >&2
  exit 1
fi

mise_version() {
  "$1" --version 2>/dev/null | awk '{print $1}'
}

if [ ! -x "${MISE_BIN}" ] || [ "$(mise_version "${MISE_BIN}")" != "${MISE_VERSION}" ]; then
  if ! command -v curl >/dev/null 2>&1; then
    echo "curl is required to install mise ${MISE_VERSION}." >&2
    exit 1
  fi

  curl -fsSL https://mise.run | MISE_VERSION="v${MISE_VERSION}" sh
fi

if [ ! -x "${MISE_BIN}" ]; then
  echo "mise ${MISE_VERSION} was not installed at ${MISE_BIN}." >&2
  exit 1
fi

if [ "$(mise_version "${MISE_BIN}")" != "${MISE_VERSION}" ]; then
  echo "Expected mise ${MISE_VERSION}, got $(${MISE_BIN} --version)." >&2
  exit 1
fi

"${MISE_BIN}" install "bun@${BUN_VERSION}"

if [ -f bun.lock ] || [ -f bun.lockb ]; then
  "${MISE_BIN}" exec "bun@${BUN_VERSION}" -- bun install --frozen-lockfile "$@"
else
  "${MISE_BIN}" exec "bun@${BUN_VERSION}" -- bun install "$@"
fi

echo "Run the app with: ${MISE_BIN} exec bun@${BUN_VERSION} -- bun run dev"
