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
- Demo: [apps/demo](apps/demo) is a Vite app that loads example aggregations from [public/examples](public/examples) via [apps/demo/static/js/config.js](apps/demo/static/js/config.js).

## Quickstart

```bash
npm install
npm run dev            # start demo (Vite)
npm run test           # vitest unit tests for the library
npm run build          # build library + demo
```

Node 18+ is required (CI and builds run on Node 20).

Install the library directly in your own project:

```bash
npm install webwaspjs
```

**TypeScript:** Currently ships JavaScript only (no bundled d.ts). Use `// @ts-check` or your own ambient types if needed.

## Core concepts

- `Aggregation` grows assemblies using connection `Rule`s and collision checks.
- `Part` stores geometry, connection planes, and colliders; active connections reset per rule set.
- `Connection` defines a plane + type on a part; `generateRulesTable` maps rules to active connections.
- `Plane` keeps orthonormal axes and applies transforms; `newPlaneToPlane` computes part placement transforms.
- `Collider` can be single or per-connection; intersection uses `three-mesh-bvh` for speed.
- `Visualizer` wraps Three.js + camera-controls, enforces Z-up, and renders aggregated meshes.

## Demo data

`availableSets` in [apps/demo/static/js/config.js](apps/demo/static/js/config.js) list example aggregations. Files live under [public/examples](public/examples); tests ensure referenced JSON parses.

## License

This project is licensed under MIT. See [LICENSE.txt](LICENSE.txt) for details.

## Contact

Questions or feedback: [hello@rogerwinkler.de](mailto:hello@rogerwinkler.de).
