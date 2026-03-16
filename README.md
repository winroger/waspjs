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

**WASP Atlas** is a growing, open collection of discrete modular building systems designed with the Grasshopper plug-in [WASP](https://github.com/ar0551/Wasp). The web app is powered by [`webwaspjs`](https://www.npmjs.com/package/webwaspjs), a JavaScript port of WASP for discrete aggregations in the browser.

**[Explore the Atlas →](https://winroger.github.io/waspjs/)**

Want to add your own design? **[Submit here →](https://docs.google.com/forms/d/e/1FAIpQLScgPC3Vqh0p0fUfVR93iz_Zu8LHh6uFl_7-8dxACncJXgKX_Q/viewform)**

## Quickstart

```bash
npm install          # install all workspaces
npm run dev          # start demo (Vite)
npm run test         # run all tests
npm run build        # build library + demo
```

Use the library in your own project:

```bash
npm install webwaspjs
```

```js
import { Aggregation, Part, Rule, Connection, Collider, Visualizer } from 'webwaspjs';
```

## Structure

| Path | Description |
|------|-------------|
| [`packages/waspjs`](packages/waspjs) | Core library — published as `webwaspjs` (ESM + CJS) |
| [`apps/demo`](apps/demo) | React + Vite demo app (landing page, configurator) |
| [`public/examples`](public/examples) | Example aggregation datasets |

## Authors

- **Roger Winkler** — [rogerwinkler.de](https://www.rogerwinkler.de) · [hello@rogerwinkler.de](mailto:hello@rogerwinkler.de)
- **Andrea Rossi** — [thecomputationalhive.com](https://thecomputationalhive.com/) · [a.rossi.andrea@gmail.com](mailto:a.rossi.andrea@gmail.com)

Built upon the original [WASP](https://github.com/ar0551/Wasp) Grasshopper plug-in by Andrea Rossi. Also available on [Food4Rhino](https://www.food4rhino.com/en/app/wasp).

## License

MIT — see [LICENSE.txt](LICENSE.txt).
