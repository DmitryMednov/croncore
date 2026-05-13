# CRONCORE Game Mode — false-earth integration

This directory is a vendored copy of **[momentchan/false-earth](https://github.com/momentchan/false-earth)** (MIT) with one additional 3D layer that drops Croncore site sections into the procedural landscape as floating monoliths.

## Layout

After running `./build.sh`, this folder contains **both** the dev source and the production deployment artefact, side by side:

```
game/
├── index.html        ← production (built by Vite, references ./assets/*)
├── dev.index.html    ← preserved copy of the original dev entry
├── assets/           ← bundled JS + CSS (hashed filenames)
├── textures/  audio/  models/  fonts/  vat/   ← assets the bundle fetches
├── _headers          ← Netlify/CF Pages headers, copied from public/
├── src/              ← React + R3F source (untouched false-earth + our addition)
├── public/           ← source for the asset folders above
├── packages/three-core/   ← vendored submodule (also MIT)
├── package.json  vite.config.js  tsconfig.json
└── build.sh          ← rebuild + patch + promote pipeline
```

Static hosts that publish the repo root will serve `https://<host>/game/` from `game/index.html` (the built one), and all `./assets/*`, `./textures/*`, `./audio/*`, `./models/*`, `./vat/*` references resolve relative to the page URL — no host rewrites required.

## What's been changed vs upstream

- **Added** `src/components/CroncoreBlocks.tsx` — six glass monoliths in a ring around spawn. Each block represents a section of the Croncore site (Services, Advisor, How it works, Access, Payments, SPV). Hover glows the panel; click opens the matching `#section` anchor on the parent site.
- **Edited** `src/components/WorldController.tsx` — imports `CroncoreBlocks`, adds a `🏛 Croncore Blocks` toggle to the Leva `Game.Content` panel, mounts the group alongside Rose / Grass / Character.
- **Edited** `index.html` — preconnect + Google Fonts (Geist, Newsreader italic, JetBrains Mono) for the in-world HTML labels; title `False Earth · CRONCORE`.
- **Added** `build.sh` — Vite build + sed pass that strips the leading `/` from the absolute asset URLs that false-earth's source hard-codes as string literals (e.g. `"/textures/starmap_2020_4k.ktx2"` → `"textures/starmap_2020_4k.ktx2"`), so the bundle works when served at sub-paths.

The original LICENSE, readme.md, shaders, terrain, character, grass, rose, cosmic system, and post-processing are untouched.

## Rebuilding

```bash
cd game
./build.sh
```

Idempotent. Run after editing `src/components/CroncoreBlocks.tsx` (or anything else). The script handles `npm install` on first run.

## Configuring the link target

Blocks link to the marketing site. By default they resolve against the parent path (`..#section`), which works when the game is deployed at e.g. `https://croncore.io/game/`. Override at build time:

```bash
VITE_CRONCORE_URL=https://croncore.io ./build.sh
```

## Local dev (HMR) — optional

The production `index.html` references hashed bundle filenames, so Vite's dev server can't use it directly. To run HMR development against the source:

```bash
cp dev.index.html index.html
npm run dev    # HTTPS dev server, requires a WebGPU browser
```

Re-run `./build.sh` afterwards to restore the production `index.html`.

## Caveats

- Requires **WebGPU**. Chrome 121+, Edge 121+, Arc on desktop. Safari and Firefox stable will hit the explicit `WEBGPU NOT SUPPORTED` overlay in `App.tsx`.
- Blocks are placed at `y = 4` above origin. Default terrain amplitude is ~1, so they float above ground on any hill. If you push `uTerrainAmp` past ~3, raise `Y_OFFSET` in `CroncoreBlocks.tsx`.
- All Croncore-side content is hardcoded in `BLOCKS` at the top of `CroncoreBlocks.tsx`. Swap the array to localise or extend.

## Attribution

Base scene, terrain, grass system, character controller, cosmic system, post-processing, and the WebGPU/TSL pipeline are © momentchan and contributors, MIT-licensed. See `LICENSE` and `readme.md`.
