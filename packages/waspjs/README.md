# webwaspjs (library)

JavaScript port of the WASP Grasshopper core for discrete aggregation.

## Structure
- `src/`: Aggregation/Part/Rule/Connection/Plane/Collider/Visualizer plus utilities and importers.
- `tests/`: Vitest unit tests (run from repo root).
- `dist/`: build output (tsup, ESM + CJS).

## Build & test
- `npm run build` (workspace root or here) – tsup build to `dist/`.
- `npm run test` / `npm run test:watch` (root) – vitest over `packages/waspjs/tests`.
- `npm run lint` (root) – eslint on `src` + `tests`.

## Usage
Import from the package entry:
```js
import { Aggregation, Part, Rule, Connection, Collider, Visualizer, generateRules } from 'webwaspjs';
```

## Concepts
- Aggregation grows parts via rules, placing parts with `newPlaneToPlane` transforms and BVH collision checks.
- Parts hold geometry, connections, collider, parent/child links; `resetPart` refreshes active connections per ruleset.
- Connection stores a plane + type; `generateRulesTable` maps applicable rules.
- Utilities cover mesh serialization (`meshToData`/`meshFromData`) and matrix helpers (`transformToData`/`transformFromData`).

## Notes
- Coordinate system: Z-up (Visualizer sets `camera.up` to Z).
- Collision: `three-mesh-bvh` accelerated; prefer colliders over render meshes for performance.
