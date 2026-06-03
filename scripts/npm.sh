#!/usr/bin/env bash
# Use local Node when npm is not on PATH (e.g. fresh Terminal.app session).
export PATH="${HOME}/.local/node-v22/bin:${PATH}"
exec npm "$@"
