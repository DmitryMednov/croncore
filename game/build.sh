#!/usr/bin/env bash
# CRONCORE game build script.
#
# Vite emits to dist/ with absolute /textures /audio /models /vat URLs
# baked into the JS bundle as string literals (the original false-earth
# source uses them that way). For sub-path deployment like
# https://croncore.io/game/ we need those URLs relative — otherwise the
# JS resolves them against the domain root and 404s.
#
# Pipeline:
#   1. vite build           → game/dist/
#   2. patch JS literals    → strip the leading "/" on asset prefixes
#   3. promote dist/ → game/   so /game/index.html is the built artefact
#   4. drop the now-empty dist/
#
# Idempotent. Run after editing src/.

set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "[build] installing dependencies (first run)..."
  npm install --no-audit --no-fund
fi

echo "[build] vite build..."
npm run build

echo "[build] patching absolute asset paths in JS bundle..."
for f in dist/assets/index-*.js; do
  [ -f "$f" ] || continue
  sed -i \
    -e 's|"/textures/|"textures/|g' \
    -e 's|"/audio/|"audio/|g' \
    -e 's|"/models/|"models/|g' \
    -e 's|"/vat/|"vat/|g' \
    -e 's|"/fonts/|"fonts/|g' \
    "$f"
done
# Source-maps add ~13 MB and are not useful in production.
find dist -name "*.map" -delete

echo "[build] syncing build → game/ root..."
cp dist/index.html index.html
[ -f dist/_headers ] && cp dist/_headers _headers
for d in assets textures audio models fonts vat; do
  if [ -d "dist/$d" ]; then
    rm -rf "$d"
    mv "dist/$d" "$d"
  fi
done
rm -rf dist

echo "[build] done. Deploy game/ as https://<host>/game/ (or set the publish root accordingly)."
