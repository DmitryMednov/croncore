#!/usr/bin/env python3
"""
CRONCORE preview server.

Both the marketing site and the false-earth-derived game are committed
as static files under the repo root, so a plain HTTP server is enough.

    /                       → index.html  (multilingual landing)
    /preview.html           → portal that links to both builds
    /game/  /game/anything  → game/index.html and game/<anything>
    /assets/*               → assets/ at the repo root (logo etc.)

The game's built JS uses relative paths for textures/audio/models/vat,
so deploying at sub-paths (e.g. https://croncore.io/game/) works as-is.

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

ROOT = Path(__file__).resolve().parent
GAME = ROOT / "game"


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        # Cache heavy game assets so a reload doesn't redownload ~80 MB.
        if any(self.path.startswith(p) for p in (
            "/game/textures/", "/game/audio/", "/game/models/",
            "/game/fonts/", "/game/vat/", "/game/assets/",
        )):
            self.send_header("Cache-Control", "public, max-age=3600")
        super().end_headers()

    def log_message(self, fmt: str, *args) -> None:
        try:
            status = int(args[1])
        except (ValueError, IndexError):
            status = 200
        if status >= 400:
            super().log_message(fmt, *args)


def main() -> int:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    os.chdir(ROOT)
    if not (GAME / "assets").exists():
        print(
            "[warn] game/assets/ is missing. Run `cd game && ./build.sh` to "
            "rebuild and place artefacts under game/. Site will still serve.",
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
