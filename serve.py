#!/usr/bin/env python3
"""
CRONCORE preview server.

Serves both the marketing site (root) and the vendored false-earth game
(game/dist) from a single port with the routing the game expects:

  /                       → index.html (multilingual landing)
  /preview.html           → portal that links to site + game
  /game/  /game/anything  → served from game/dist/
  /textures/* /audio/*    → falls through to game/dist/ (game uses
  /models/*   /fonts/*      absolute paths internally — Vite copied
  /vat/*      /assets/*     these from game/public/)

Run from the repo root:

    python3 serve.py            # http://localhost:8000
    python3 serve.py 9000       # custom port
"""

from __future__ import annotations
import http.server
import os
import socketserver
import sys
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent
GAME_DIST = ROOT / "game" / "dist"

# Top-level paths whose contents live under game/dist (the game's bundled
# JS hard-codes absolute URLs like "/textures/foo.ktx2").
GAME_FALLBACK_PREFIXES = ("/textures/", "/audio/", "/models/", "/fonts/", "/vat/")


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        # Strip query/fragment, decode percent-escapes, normalise.
        raw = path.split("?", 1)[0].split("#", 1)[0]
        raw = unquote(raw)

        # 1) Explicit /game/* → game/dist/*
        if raw == "/game" or raw == "/game/":
            return str(GAME_DIST / "index.html")
        if raw.startswith("/game/"):
            sub = raw[len("/game/") :].lstrip("/")
            return str(GAME_DIST / sub)

        # 2) Asset prefixes the game expects at root (textures, audio, …).
        for prefix in GAME_FALLBACK_PREFIXES:
            if raw.startswith(prefix):
                return str(GAME_DIST / raw.lstrip("/"))

        # 3) /assets/* — shared namespace. Prefer the main site (logo.png),
        # fall back to the game build (hashed JS chunks).
        if raw.startswith("/assets/"):
            site_candidate = ROOT / raw.lstrip("/")
            if site_candidate.exists():
                return str(site_candidate)
            return str(GAME_DIST / raw.lstrip("/"))

        # 4) Default: serve from repo root.
        return super().translate_path(raw)

    def end_headers(self) -> None:
        # Some browsers refuse to fetch KTX2/EXR/HDR with strict no-cache;
        # leaving defaults. Just add a short Cache-Control for assets so
        # repeated reloads don't redownload 80MB of textures.
        if self.path.startswith(("/textures/", "/audio/", "/models/", "/fonts/", "/vat/", "/assets/")):
            self.send_header("Cache-Control", "public, max-age=3600")
        super().end_headers()

    def log_message(self, fmt: str, *args) -> None:
        # Quieter logs — keep only non-200 lines.
        try:
            status = int(args[1])
        except (ValueError, IndexError):
            status = 200
        if status >= 400:
            super().log_message(fmt, *args)


def main() -> int:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    os.chdir(ROOT)
    if not GAME_DIST.exists():
        print(
            "[warn] game/dist/ is missing. Run `cd game && npm install && npm run build` "
            "to enable the game preview. Site will still serve.",
            file=sys.stderr,
        )
    with socketserver.ThreadingTCPServer(("", port), Handler) as httpd:
        httpd.allow_reuse_address = True
        print(f"CRONCORE preview server running on http://localhost:{port}")
        print(f"  · Site    →  http://localhost:{port}/")
        print(f"  · Portal  →  http://localhost:{port}/preview.html")
        print(f"  · Game    →  http://localhost:{port}/game/   (requires WebGPU browser)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nbye")
            return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
