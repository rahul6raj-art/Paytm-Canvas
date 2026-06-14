#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENGINE_DIR="$ROOT/packages/craft-engine"
OUT_DIR="$ROOT/public/craft-engine"
BIN_DIR="$ROOT/packages/craft-engine/target/release"

if ! command -v wasm-pack >/dev/null 2>&1; then
  echo "wasm-pack not found. Install Rust, then: cargo install wasm-pack"
  exit 1
fi

if ! rustup target list --installed | grep -q wasm32-unknown-unknown; then
  rustup target add wasm32-unknown-unknown
fi

mkdir -p "$OUT_DIR"
wasm-pack build "$ENGINE_DIR" \
  --target web \
  --out-dir "$OUT_DIR" \
  --out-name craft_engine \
  --no-opt

echo "Built craft-engine WASM → public/craft-engine/"

if command -v cargo >/dev/null 2>&1; then
  cargo build --release --manifest-path "$ENGINE_DIR/Cargo.toml" --bin craft-render
  echo "Built native CLI → $BIN_DIR/craft-render"
fi
