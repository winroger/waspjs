# webwaspjs

<p align="center">
  <a href="https://www.npmjs.com/package/webwaspjs">
    <img src="https://img.shields.io/npm/v/webwaspjs.svg" alt="npm version">
  </a>
  <a href="https://www.npmjs.com/package/webwaspjs">
    <img src="https://img.shields.io/npm/dm/webwaspjs.svg" alt="npm downloads">
  </a>
  <a href="https://github.com/winroger/waspjs/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/winroger/waspjs/ci.yml?branch=main" alt="CI status">
  </a>
  <a href="https://github.com/winroger/waspjs/blob/main/LICENSE.txt">
    <img src="https://img.shields.io/github/license/winroger/waspjs.svg" alt="license">
  </a>
</p>

`webwaspjs` is a JavaScript library for loading and growing discrete aggregation systems in the browser.

## Install

```bash
npm install webwaspjs three
```

`three` is a required peer dependency and must be installed by the consuming application.

## Quick start

```js
import { createAggregationFromData } from 'webwaspjs';

const aggregation = createAggregationFromData(aggregationData);
const roundtripExport = aggregation.toData();
const lightweightRoundtripExport = aggregation.toData(false);
const fileExport = aggregation.toFileData();

console.log(Object.keys(aggregation.parts));
console.log(aggregation.rules.length);
console.log(JSON.stringify(roundtripExport));
console.log(JSON.stringify(lightweightRoundtripExport));
console.log(JSON.stringify(fileExport));
```

Main entry points:

- `createAggregationFromData(data)` to rebuild an aggregation from serialized data
- `aggregation.toData()` to export the full roundtrip/core aggregation data
- `aggregation.toData(false)` to export roundtrip/core data without per-instance aggregated geometry or colliders
- `aggregation.toFileData()` to export the compact placed-parts file format
- `Aggregation` for direct access to the core model
- `Visualizer` for simple browser rendering

### Placed geometry

`aggregation.toData()` includes placed instance geometry and colliders in assembly
coordinates, matching Python Wasp's inline geometry convention. Their placement
is baked into the exported vertices without changing the runtime meshes or base
parts. Importing inline geometry does not apply the Part transform a second time.
`aggregation.toData(false)` instead omits instance geometry and colliders; import
reconstructs them from the base parts and placement transforms. Viewer scene-parent
transforms are not included in these exports.

### Geometry ownership

`Part.copy()`, `Part.transform()`, lightweight `Part.fromData(data, basePart)`,
and `Collider.copy()` / `Collider.transform()` produce independent geometry
buffers, matching GH-Wasp's mesh duplication. Editing vertices, indices or normals
on a result does not alter its source or another instance. A geometry-bound BVH
cache is rebuilt lazily when needed. Material objects retain Three.js sharing
semantics; viewer scene clones and custom geometry metadata are outside this
ownership contract.

Each result allocates its own vertex-attribute and index buffers, including collider
meshes. This increases memory and copy work relative to shared geometry; no speed
or memory-neutrality guarantee is implied. Tests are in
[meshOwnership.test.js](src/tests/meshOwnership.test.js).

The comments in [utilities.js](src/core/utilities.js) identify each function's
GH utility/component counterpart or JavaScript-specific role, including Rhino
API adapters and known differences. Internal helpers are excluded from the
public package entry point.

### Connection frames

Connection planes use right-handed orthonormal axes: `X × Y = Z`. The public
constructor remains `new Plane(origin, xaxis, zaxis)`, deriving `Y = Z × X`.
`Plane.fromData()` reads GH `origin`/`xaxis`/`yaxis` data, with X/Y authoritative,
or X/Z-only data. `Connection.flip_pln` preserves X and reverses Y and Z,
matching GH-Wasp. Local Z is the connection normal; it can point in any direction.
The viewer's Z-up camera setting does not convert or alter these axes.

When X/Y/Z are present, a redundant Z parallel or opposite to `X × Y` is accepted.
Old WaspJS exports used the opposite normal; import now normalizes that normal
while preserving origin and the orthonormal X/Y frame. Input objects and stored
files are not rewritten. An unrelated Z, zero/collinear axes, or non-finite
coordinates throw an error. Unlike JS, GH's reader ignores redundant Z entirely.

`Plane.toData()` retains its existing X/Y/Z fields and emits the corrected normal.
**Older WaspJS readers can reverse Y when loading this corrected XYZ output.**
Update the receiving reader before exchanging new XYZ exports with an older app.
GH's X/Y reader accepts these exports. XY-only transport avoids that particular
old-reader Y reversal, but does not fix the old runtime's opposite normal.
No existing application or dependency is updated by this library change.

Regression evidence covers planar, tilted and oblique frames, connection
copy/flip, rigid transforms, docking, and mixed old/new construction paths in
[planeCompatibility.test.js](src/tests/planeCompatibility.test.js). Reference
results were executed using GH-Wasp 0.7.003 in Rhino; they do not establish parity
for general affine transforms, reflections, or every aggregation workflow.

### Part attributes

`Part.attributes` is an optional array of JSON values. The array and its nested values are copied when a part is constructed, copied, transformed, serialized, or deserialized. Placed parts retain their own attributes in both full and lightweight `Aggregation.toData()` exports. Older data without an `attributes` field loads with an empty array; a lightweight placed part can inherit attributes from its base part.

The original Python [Wasp Part implementation](https://github.com/ar0551/Wasp/blob/main/src/wasp/core/parts.py) omits attributes from `to_data()` and ignores them in `from_data()`. It can read the additional field in a `webwaspjs` export, but importing and exporting through Python Wasp will discard those attributes. Python Wasp attribute objects that contain Rhino geometry are outside this JSON data format.

## Development

Requirements:

- Node.js 18+
- npm 9+

Commands:

- `npm install`
- `npm run lint`
- `npm test`
- `npm run build`

## Project layout

```text
src/                    library source
src/tests/              vitest suite
src/tests/fixtures/     JSON fixtures used by tests
dist/                   build output
```

## Related repositories

- [Wasp Atas Explorer with demo showcases](https://github.com/Wasp-Framework/Wasp-Atas-Explorer)
- [Growing Collection of Wasp Datasets](https://github.com/Wasp-Framework/Wasp-Atlas)

## Credits

- Roger Winkler — [rogerwinkler.de](https://www.rogerwinkler.de)
- Andrea Rossi — [thecomputationalhive.com](https://thecomputationalhive.com/)

Based on the original [WASP](https://github.com/ar0551/Wasp) Grasshopper plug-in by Andrea Rossi.

## License

MIT. See [LICENSE.txt](LICENSE.txt).
