# CRONCORE Game Mode — false-earth integration

This directory is a vendored copy of **[momentchan/false-earth](https://github.com/momentchan/false-earth)** (MIT) with one additional 3D layer that drops Croncore site sections into the procedural landscape as floating monoliths.

## What was changed

- **Added** `src/components/CroncoreBlocks.tsx` — six glass monoliths in a ring around spawn. Each block represents a section of the Croncore site (Services, Advisor, How it works, Access, Payments, SPV). Hover glows the panel; click opens the corresponding `#section` anchor on the parent site.
- **Edited** `src/components/WorldController.tsx` — imports `CroncoreBlocks`, adds a `🏛 Croncore Blocks` toggle to the Leva `Game.Content` panel, and mounts the group alongside Rose / Grass / Character.
- **Edited** `index.html` — preconnect + Google Fonts (Geist, Newsreader italic, JetBrains Mono) so the in-world HTML labels render with brand typography. Title updated to `False Earth · CRONCORE`.

Nothing else from the original project was touched. `LICENSE` (MIT), `readme.md`, all shaders, terrain, character, grass, rose, etc. are untouched.

## Configuring the link target

The blocks link out to the marketing site. By default they resolve against the parent path (`..#section`), which works when the game is deployed at e.g. `https://croncore.com/game/`. Override at build time:

```bash
VITE_CRONCORE_URL=https://croncore.com npm run build
```

## Running

```bash
cd game
npm install
npm run dev    # HTTPS dev server, requires WebGPU-enabled browser (Chrome / Edge / Arc)
```

If the dev server fails on first install, see `readme.md` for the original setup notes.

## Caveats

- Requires WebGPU. The app falls back with an error overlay otherwise — see `App.tsx`.
- The blocks are placed at `y = 4` above the origin. Terrain amplitude defaults to ~1, so they float above the ground and remain visible even on hills. If you change `uTerrainAmp` past ~3 you may want to raise `Y_OFFSET` in `CroncoreBlocks.tsx`.
- All Croncore-side content is hardcoded in `BLOCKS` at the top of `CroncoreBlocks.tsx`. To localise or expand, swap the array.

## Attribution

Base scene, terrain, grass system, character controller, cosmic system, post-processing, and the WebGPU/TSL pipeline are © momentchan and contributors, MIT-licensed. See `LICENSE` and `readme.md`.
