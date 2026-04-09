<div style="width: 100%; height: auto; margin: 0 auto; display: flex; align-items: center; justify-content: center;">
    <img src="./public/graphics/banner.svg" alt="WASP Atlas Banner" style="width: 100%; height: auto;">
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

This monorepo contains two closely connected projects:

1. **webwaspjs**: a JavaScript port of the Grasshopper Plugin WASP for discrete aggregation in the browser.
2. **Wasp Atlas**: a web app that showcases a collection of modular building systems and runs on top of `webwaspjs`.

Wasp Atlas is based on datasets authored with the original Grasshopper plug-in [WASP](https://github.com/ar0551/Wasp).

**Explore the live app:** [https://www.wasp-atlas.net/](https://www.wasp-atlas.net/)

## Repository sitemap

```text
waspjs/
├─ apps/
│  ├─ README.md
│  └─ demo/
│     ├─ src/
│     │  ├─ components/      # UI modules (navbar, catalog, controls, modal)
│     │  ├─ pages/           # route-level screens (landing, datasets, build, legal)
│     │  ├─ config/          # available dataset metadata
│     │  ├─ state/           # build state/store utilities
│     │  ├─ lib/             # demo runtime + aggregation services
│     │  └─ styles/          # global, layout, component and responsive styles
│     ├─ index.html
│     ├─ vite.config.js
│     └─ vitest.config.ts
├─ packages/
│  ├─ README.md
│  └─ waspjs/
│     ├─ src/
│     │  ├─ core/            # aggregation + geometric core
│     │  ├─ importers/       # input conversion helpers
│     │  ├─ types/           # type and API shape exports
│     │  └─ index.js         # package entry point
│     ├─ tests/              # library test suite
│     ├─ examples/           # package-level sample input data
│     └─ tsup.config.js
├─ public/
│  ├─ examples/              # app-consumed datasets (config.json + aggregation.json)
│  ├─ graphics/
│  └─ assets/
├─ eslint.config.js
├─ vite.config.js
├─ vitest.config.js
└─ package.json
```

## Quickstart

### Prerequisites

- Node.js 18+ (Node.js 20 recommended)
- npm 9+

### Install and run

```bash
npm install
npm run dev
```

The development server starts the demo app from `apps/demo`.

## Dataset source and submissions

Demo datasets are fetched from [Wasp-Framework/Wasp-Atlas](https://github.com/Wasp-Framework/Wasp-Atlas), where the dataset files are maintained.

New datasets can be submitted through the form linked on the landing page of [https://www.wasp-atlas.net/](https://www.wasp-atlas.net/).

## Using webwaspjs in your own project

Install from npm:

```bash
npm install webwaspjs
```

Example import:

```js
import {
    Aggregation,
    Part,
    Rule,
    Connection,
    Collider,
    Visualizer,
} from 'webwaspjs';
```

## Technology stack

- Monorepo: npm workspaces
- Library build: tsup (ESM + CJS output)
- Demo app: React + Vite
- Tests: Vitest
- Lint/format: ESLint + Prettier
- Geometry/rendering ecosystem: Three.js-based runtime components inside `webwaspjs`

## Authors and credits

- **Roger Winkler** — [rogerwinkler.de](https://www.rogerwinkler.de) · [hello@rogerwinkler.de](mailto:hello@rogerwinkler.de)
- **Andrea Rossi** — [thecomputationalhive.com](https://thecomputationalhive.com/) · [a.rossi.andrea@gmail.com](mailto:a.rossi.andrea@gmail.com)

This project builds upon the original [WASP](https://github.com/ar0551/Wasp) Grasshopper plug-in by Andrea Rossi (also on [Food4Rhino](https://www.food4rhino.com/en/app/wasp)).

## License

MIT — see [LICENSE.txt](LICENSE.txt).
