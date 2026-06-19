#!/usr/bin/env bash
# One-shot Craft bridge setup from any repo.
# Usage: craft-setup src/App.tsx
#        CRAFT_ROOT=/path/to/Craft-main craft-setup src/App.tsx
set -euo pipefail

CRAFT_ROOT="${CRAFT_ROOT:-${CRAFT_HOME:-$HOME/Downloads/Craft-main}}"
CLI="$CRAFT_ROOT/packages/craft-bridge/cli.mjs"

if [[ ! -f "$CLI" ]]; then
  echo "Craft CLI not found at $CLI"
  echo "Set CRAFT_ROOT to your Craft-main folder, e.g.:"
  echo "  export CRAFT_ROOT=/path/to/Craft-main"
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: craft-setup <source-file> [--preview URL]"
  echo "Example: craft-setup src/App.tsx"
  exit 1
fi

exec node "$CLI" setup "$@"
