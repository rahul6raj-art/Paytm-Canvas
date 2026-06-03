#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="${HOME}/.local/node-v22/bin:${PATH}"
npm install
# Fresh .next avoids "Internal Server Error" after code changes while dev was running.
npm run dev:clean
