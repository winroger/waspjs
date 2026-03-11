<div style="width: 100%; height: auto; margin: 0 auto; display: flex; align-items: center; justify-content: center;">
    <img src="./public/graphics/banner.svg" alt="WaspJS Banner" style="width: 100%; height: auto;">
</div>
<br>

<p align="center">
    <a href="https://www.npmjs.com/package/webwaspjs">
        <img src="https://img.shields.io/npm/v/webwaspjs.svg" alt="npm version">
    </a>
    <a href="https://www.npmjs.com/package/webwaspjs">
        <img src="https://img.shields.io/npm/dm/webwaspjs.svg" alt="npm downloads">
    </a>
    <a href="https://github.com/winroger/waspjs/LICENSE">
        <img src="https://img.shields.io/github/license/winroger/waspjs.svg" alt="license">
    </a>
</p>

---
WaspJS is a JavaScript port of the WASP Grasshopper plugin for discrete aggregations in the browser. The monorepo ships the core library `webwaspjs` and a Vite demo showcasing it.

This implementation is authored by Roger Winkler and builds upon the original concept of the Python-based Grasshopper plug‑in WASP by Andrea Rossi. For more information on WASP, visit the [original WASP repository](https://github.com/ar0551/Wasp).

## Packages and apps

- Library: [packages/waspjs](packages/waspjs) publishes `webwaspjs` (ESM + CJS).
- Demo: [apps/demo](apps/demo) is a React + Vite app that loads example aggregations from [public/examples](public/examples) via [apps/demo/src/config/availableSets.ts](apps/demo/src/config/availableSets.ts).

## Quickstart

```bash
npm install
npm run dev            # start demo (Vite)
npm run test           # vitest tests for library + demo
npm run build          # build library + demo
```

Node 18+ is required (CI and builds run on Node 20).

Install the library directly in your own project:

```bash
npm install webwaspjs
```

**TypeScript:** Currently ships JavaScript only (no bundled d.ts). Use `// @ts-check` or your own ambient types if needed.

## Core concepts

- `Aggregation` grows assemblies using connection `Rule`s and collision checks. Supports both random placement (seeded RNG) and deterministic manual placement.
- `Part` stores geometry, connection planes, and colliders; active connections reset per rule set.
- `Connection` defines a plane + type on a part; `generateRulesTable` maps rules to active connections.
- `Plane` keeps orthonormal axes and applies transforms; `newPlaneToPlane` computes part placement transforms.
- `Collider` can be single or per-connection; intersection uses `three-mesh-bvh` for speed.
- `Visualizer` wraps Three.js + camera-controls, enforces Z-up, renders aggregated meshes, and supports raycasting and ghost-mesh previews for manual placement.

### Manual placement API

The library exposes methods for deterministic, click-to-place workflows:

| Function | Purpose |
|----------|---------|
| `getOpenConnections(agg)` | List all unused connections across aggregated parts |
| `getValidPlacements(agg, partName)` | Collision-checked positions where a part can be placed |
| `placeFirstPartManually(agg, name, viz)` | Place the first part at the origin |
| `placePartManually(agg, parentId, connId, name, connBId, viz)` | Place a specific part at a specific connection |
| `removePartById(agg, partId, viz)` | Remove a part and restore parent connections |
| `setActivePartTypes(agg, names)` | Filter which part types are used during random growth |

The Visualizer also provides `addGhostMeshes(placements)`, `clearGhostMeshes()`, `highlightGhost(index)`, `unhighlightGhosts()`, `raycastParts(event)`, and `raycastGhosts(event)` for interactive placement previews.

## Demo app

The demo is a multi-screen React SPA using `react-router-dom`:

| Route | Screen | Description |
|-------|--------|-------------|
| `/` | Landing page | Full-screen gallery of available datasets with live Three.js thumbnails |
| `/build/:slug` | Build screen | Main workspace with right-sidebar part catalog and mode toggle |

### Build modes

| Mode | Controls | Behavior |
|------|----------|----------|
| **Random** | Slider (1–500 parts), per-part active toggle | Slider drives `setAggregationPartCount()`; inactive types are skipped |
| **Manual** | Click part in catalog → ghosts appear → click ghost to place | Ghost meshes at all valid placements; right-click removes parts |

Part count stays in sync between modes. Colors are editable per-part via inline color pickers.

### Architecture

- **`buildRuntime.ts`** — React-controlled, pure-function runtime (no DOM manipulation). Manages dataset loading, Visualizer lifecycle, and aggregation operations.
- **`buildState.ts`** — `useReducer` state: `BuildMode`, catalog, selected part, ghost hover, slider value.
- **`BuildScreen.tsx`** — wires state + runtime, handles pointer events (move → highlight, click → place, contextmenu → remove).
- **Old runtime** (`demoRuntime.ts`) is preserved for reference but no longer used by the active routes.

## Demo data

`availableSets` in [apps/demo/src/config/availableSets.ts](apps/demo/src/config/availableSets.ts) list example aggregations. Files live under [public/examples](public/examples); tests ensure referenced JSON parses.

## License

This project is licensed under MIT. See [LICENSE.txt](LICENSE.txt) for details.

## Contact

Questions or feedback: [hello@rogerwinkler.de](mailto:hello@rogerwinkler.de).
