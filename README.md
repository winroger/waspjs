# WaspJS

[![npm version](https://img.shields.io/npm/v/webwaspjs.svg)](https://www.npmjs.com/package/webwaspjs)
[![CI](https://img.shields.io/github/actions/workflow/status/winroger/waspjs/ci.yml?branch=main)](https://github.com/winroger/waspjs/actions/workflows/ci.yml)

`webwaspjs` is a JavaScript port of the [Wasp](https://github.com/ar0551/Wasp)
core for discrete assemblies. Define reusable mesh Parts, attach connection
frames, generate rules and grow an assembly. Load supported Grasshopper-Wasp
JSON, inspect the connection graph, or render the result with Three.js.

## Install

```sh
npm install webwaspjs three@^0.169.0
```

Three.js is a required peer dependency. The current package supports the
`^0.169.0` range; installing an unrelated newer Three.js release is not covered.
Use a bundler such as Vite for browser applications. ESM and CommonJS entry points
are available; generated TypeScript declarations are not included.

The documentation on `main` describes the current source and can include changes
not yet published to npm. Use the Git tag matching your installed package version
when checking an older release.

## Build a small assembly

This example creates one reusable block with two opposing connection frames,
places a seed and adds another block using a valid placement query:

```js
import * as THREE from 'three';
import { Aggregation, Collider, Connection, Part, Plane, generateRules } from 'webwaspjs';

const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
const connections = [-1, 1].map(side => new Connection(
  new Plane(
    new THREE.Vector3(side * 0.5, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(side, 0, 0),
  ),
  'end',
  'Block',
  0, // Part assigns sequential connection IDs.
));
const block = new Part('Block', mesh, connections, new Collider([mesh]));
const rules = generateRules([block]);
const aggregation = new Aggregation('Blocks', [block], rules, 42);

const seed = aggregation.placeFirstPart('Block');
if (!seed.success) throw new Error(seed.error);
const option = aggregation.getValidPlacementsForPart('Block')[0];
if (option) {
  const placed = aggregation.placePartAtConnection(
    option.parentPartId, option.connectionId, option.partName, option.connectionBId,
  );
  if (!placed.success) throw new Error(placed.error);
}
console.log(aggregation.getParts().length);
const saved = aggregation.toData(); // Full core JSON, ready for JSON.stringify().
```

Coordinates and tolerances use your model units; no automatic scaling occurs.
Connections use right-handed frames. The `Plane` constructor takes **origin,
X-axis, Z-axis**. Local Z is the connection normal, independent of camera up.
Part construction assigns owners/IDs to the supplied Connection objects in place;
use separate connections for independent base Parts.

For random growth, call `aggregation.aggregate_rnd(10)` to try to add ten more
Parts. Check the returned `true`/failure message and actual placed count; stock,
rules and collisions can prevent reaching the requested number.

## Load and save Grasshopper-Wasp data

```js
import { createAggregationFromData } from 'webwaspjs';

// aggregationData is parsed Full/Light core JSON from a supported Wasp export.
const assembly = createAggregationFromData(aggregationData);
const full = assembly.toData();
const light = assembly.toData(false);
```

Full and Light exports preserve the supported core state. The separate compact
`toFileData()` format needs external base Parts/rules when loaded and carries less
state. See [data formats and usage](REFERENCE.md#reading-and-exporting-data).

## Render in a browser

Give the container an explicit size, then create the viewer after it exists:

```html
<div id="wasp-viewer" style="width: 100%; height: 480px"></div>
```

```js
import { Visualizer } from 'webwaspjs';

const viewer = new Visualizer('#wasp-viewer');
for (const part of assembly.getParts()) viewer.addEntity(part);
// Add/remove viewer entities after subsequent model edits.
// Call viewer.dispose() when the view is unmounted.
```

The viewer uses Z-up, DOM and WebGL. Core construction/serialization also work in
Node.js; constructing `Visualizer` requires a browser. Picking, previews, UI and
application state belong to the consuming application.

## Supported scope and compatibility

The current source targets GH-Wasp **0.7.003**, with tested subsets rather than
complete Rhino/Grasshopper parity:

- Mode 0 aggregation, directed rules, deterministic/manual and random placement.
- Parts, connections, primary colliders and sequence/full-graph queries.
- Typed Attributes, SmartAttribute validity and Mode-0 PartCatalog inventory.
- Limited AdvancedPart support for additional colliders in Mode 1.

Fields, field-driven growth, Graph-Grammar aggregation, global/local constraint
systems and recursive Part hierarchies are outside this scope. Unsupported payloads
are rejected rather than treated as fully supported. Collision checks test mesh
surfaces, not general solid-volume containment. Equal Python/JS seeds do not imply
the same random sequence, and loading does not restore an RNG cursor.

When upgrading older consumers, review the [reference guide](REFERENCE.md), especially
[connection frames](REFERENCE.md#connection-frames), [Part dimensions](REFERENCE.md#part-dimension)
and [inventory exchange](REFERENCE.md#part-catalogs). Corrected XYZ connection exports
can be read differently by older WaspJS readers. Imported explicit dimensions stay
unchanged. GH's catalog writer/reader can lose current stock or fractional weights.

## Reference and development

The [reference guide](REFERENCE.md) documents public exports, geometry/ownership conventions,
data formats and compatibility limits. Import public APIs from `webwaspjs`;
package subpath imports are not exposed.

For source development and release checks, see
[CONTRIBUTING.md](https://github.com/winroger/waspjs/blob/main/CONTRIBUTING.md).
Report reproducible issues in the [issue tracker](https://github.com/winroger/waspjs/issues).

## Related projects

- [Wasp Atlas Explorer](https://github.com/Wasp-Framework/Wasp-Atlas-Explorer)
- [Wasp Atlas Collection](https://github.com/Wasp-Framework/Wasp-Atlas-Collection)

## Credits and license

Roger Winkler — [rogerwinkler.de](https://www.rogerwinkler.de).
Based on [Wasp](https://github.com/ar0551/Wasp) by Andrea Rossi —
[thecomputationalhive.com](https://thecomputationalhive.com/).

MIT. See [LICENSE.txt](LICENSE.txt). Existing source provenance and license notices
are retained; the upstream Wasp project has its own license.
