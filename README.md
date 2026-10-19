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
- `Graph` for directed aggregation topology and geometric connection queries
- `loadAggregation(data, baseParts, rules, seed)` for the separate compact Save/Load format

### Placed geometry

`aggregation.toData()` includes placed instance geometry and colliders in assembly
coordinates, matching Python Wasp's inline geometry convention. Their placement
is baked into the exported vertices without changing the runtime meshes or base
parts. Importing inline geometry does not apply the Part transform a second time.
`aggregation.toData(false)` instead omits instance geometry and colliders; import
reconstructs them from the base parts and placement transforms. Viewer scene-parent
transforms are not included in these exports.

### Part center

`Part.center` is the area-weighted centroid of the mesh surface, matching the
measured GH-Wasp cases. It is not a volume or physical mass centroid. Indexed and
non-indexed triangles include the local mesh placement and exclude scene-parent
transforms; nonuniform scale changes the surface-area weights. Quad JSON uses the
existing triangle split in `meshFromData`; planar quads are covered by the tests.
Empty and zero-area triangle meshes return the origin, as in the measured Rhino
cases. This change preserves the existing `dim` behavior and adds no dependency.
The calculation makes one pass over triangles whenever a Part is constructed.

### Connection assignment

Constructing a `Part` assigns its name to every supplied Connection's `part` field
and assigns consecutive IDs starting at zero, replacing previous values as GH-Wasp
does. The constructor retains those Connection objects and mutates them in place.
Use separate Connection copies when creating independent parts; reusing the same
object for another part changes the owner seen by the first part too.
`Part.fromData()` creates new Connection objects, so its input JSON is unchanged.

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

The comments in utilities and operations identify each function's
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

`Part.attributes` remains an optional JSON array. Construction also accepts explicit
`Attribute` instances, converted to data immediately; existing callers keep the
same array/object shape. Nested values are copied during construction, copying,
transformation, serialization and import.

```js
import { Attribute } from 'webwaspjs';
const marker = new Attribute('marker', [
  { type: 'Point', value: [1, 2, 3], valid: true },
], true);
const moved = marker.transform(placementMatrix);
```

`Attribute.values` uses GH's typed JSON records rather than Rhino runtime objects.
`Attribute.fromData()`, `toData()`, `copy()` and `transform()` preserve extra JSON
fields. Copies of static data are independent too; GH itself can share those values.
Opaque JSON metadata without `class_type` is retained without inferred geometry.

Declared `class_type: 'Attribute'` with `transformable: true` follows a Part's
placement for these valid typed values:

| Value type | Supported payload |
| --- | --- |
| `Point` | `[x, y, z]` |
| `Line` | `{ from: [x, y, z], to: [x, y, z] }` |
| `Plane` | GH origin/X/Y frame; optional redundant Z follows the plane contract |
| `Mesh` | Vertex/face JSON; transformed vertices retain face topology |

The measured scope is positive rigid transforms in model units. Other transforms,
invalid values and unsupported declared transformable types raise errors. Static
values, including dictionaries, colors, vectors, boxes and opaque Rhino JSON, are
copied unchanged. Coordinates nested in dictionaries are not interpreted.

Placed attributes are included in both full and lightweight core exports and are
already transformed; importing them does not apply placement twice. When a legacy
lightweight instance omits attributes, JS reconstructs them from its base Part and
stored transform. An explicit empty array stays empty. GH's measured reader does
not perform that fallback.

GH-Wasp 0.7.003 serializes Attribute/SmartAttribute data and reads their `class_type`.
The previous README statement that Python always discarded attributes was stale.
Untyped JSON metadata is a JS extension and is not automatically a valid GH
attribute. Unknown/invalid typed values can be normalized to null by GH's reader.
In the measured IronPython host, native JSON dumping of Color channels also fails
on `.NET Byte` values; the test capture adapter normalizes those scalars and records
that native failure separately. A lossless arbitrary GH attribute roundtrip is not
promised.

**SmartAttribute validity and InternalTransform are deferred.** Static payloads can
remain JSON, but declared transformable unsupported classes are rejected rather
than silently kept in the wrong location. Full support for all RhinoCommon geometry
and geometric SmartAttribute masks is outside this first slice. Comparison evidence
is in [attributes.test.js](src/tests/attributes.test.js).

### Rules and manual placement

The implementation of `generateRules` lives in
[operations/generateRules.js](src/operations/generateRules.js), reflecting its
GH-component origin. The public import remains `import { generateRules } from
'webwaspjs'`. The previous utilities-module export forwards to this same function.

`generateRules(parts, selfPart = true, selfConnection = true, useTypes = false,
grammar = [])` follows the measured GH-Wasp Rules Generator component. Explicit
`null` flags use those defaults too. **The previous `selfConnection` default was
`false`; pass it explicitly to retain that choice.** With `selfConnection=false`,
equal connection IDs are excluded even between differently named parts. Type
grammar entries such as `x>y` are directed; input order and duplicate entries are
retained. Only valid grammar inputs are covered by the comparison.

`new Rule(partA, connectionA, partB, connectionB, active = true)` accepts an optional
fifth flag; four-argument calls keep their behavior. `Rule.fromData()` retains both
directed endpoints and converts valid integer connection IDs, including numeric
strings, to numbers. Invalid-input validation is outside this contract.

As in the measured GH core, `Rule.active` is stored metadata: setting it to
`false` does **not** disable the rule. `Connection.active_rules` lists usable
indices into `rules_table`. Manual placement and its candidate queries now honor
that list, matching the existing random-growth selection. Candidate `ruleIndex`
values refer to the complete table. `getOpenConnections().rules` returns a new
array containing only usable entries; edit `active_rules` to control availability.

The pinned GH-Wasp 0.7.003 `Rule.from_data()` incorrectly reads both endpoints from
the first endpoint. WaspJS deliberately keeps the second endpoint correct.
Consequently, Rule JSON imported through that GH reader can lose its direction;
these tests do not establish bidirectional Rule-JSON interoperability.

[ghRulesComparison.test.js](src/tests/ghRulesComparison.test.js) compares generator
output and forced placements against results executed in Rhino. The measured
scope covers connection frames, meshes/colliders and parent/connection state for
small rigid placements. It does not establish random-sequence, graph, constraint
or general collision parity. Existing BVH construction can reorder collider
triangles while building its cache, so geometry comparisons ignore face-list
order while preserving vertices and triangle winding.

### Aggregation state and graphs

`aggregation.graph` is a `Graph`. Manual and random growth add nodes and directed
edges carrying `start`, `end`, `conn_start` and `conn_end`, matching GH's sequence
graph. It is preserved in full and lightweight core exports. Legacy data with a
missing or empty graph reconstructs it from parenting; inconsistent nonempty
graphs, duplicate IDs, missing parts, cycles and invalid references raise errors.
`aggregated_parts_sequence` controls import order. Additional top-level JSON
metadata and graph-edge metadata are copied through core roundtrips.

`Graph.fromAggregation(aggregation)` computes a separate full graph by comparing
connection origins, including additional contacts. The optional arguments are
`fullGraph=true, tolerance=0.002, filterByRules=false, customRules=[]`. Tolerance
uses model units and defaults to the measured GH global value; no unit conversion
occurs. The GH algorithm uses `Part.center` and `dim` to find neighbours, compares
origins without checking normals, and retains the first connection pair per
directed part pair. Filtering uses directed rules; empty custom rules fall back
to the aggregation's rules. This method does not replace the sequence graph.
With `fullGraph=false`, it returns the existing live `aggregation.graph`.

`Graph.fromData()` / `toData()` use GH's adjacency dictionary. `addNode`, `addEdge`,
`removeNode`, `countEdges`, `getNodes`, `getEdges` and `getEdgesAttributes` provide
the corresponding core operations. The last two queries support `flatten=false`
for grouping by node. Import, export and edge-attribute queries copy JSON objects.
Duplicate directed pairs keep the existing edge. Attribute-driven graph export
is unimplemented upstream and raises an explicit error here.

`removePartFromAggregation(id)` now removes the selected part and all dependent
descendants. It retains unrelated branches, stable remaining IDs and the live
parts-array reference, removes incident graph edges and restores only connections
freed on surviving parents. It returns a boolean and exposes removed Parts in
`aggregation.removed_parts`. IDs increase within the live instance; after core
import the next ID is computed from the maximum surviving numeric ID. Deleted-ID
history is not serialized. Whole integer-string IDs become numbers; identifiers
such as `42-beam` retain their complete string value.

Core loading preserves explicitly closed free connections and excludes occupied
parent/child slots. Rule tables and `active_rules` are regenerated because the GH
transport does not serialize their transient pruning. Mode `0` is supported;
nonzero modes, nonempty Fields, global constraints and catalogs are rejected.
The `coll_check` flag is retained and actually controls collision checks.

**Known GH-reader differences:** the measured GH reader resets connection
occupancy, duplicates Rule endpoints and leaves JSON graph keys as strings,
which can make integer-ID deletion miss nodes. GH trimming also leaves stale
child references. WaspJS retains consistent state instead of reproducing these
defects. Geometry/graph exchange tests do not imply a complete native GH state
roundtrip or identical behaviour after arbitrary edits.

### Compact loading and random continuation

The compact `toFileData()` format requires external base parts and rules:

```js
import { loadAggregation } from 'webwaspjs';
const aggregation = loadAggregation(compactData, baseParts, rules, 42);
```

This operation corresponds to GH's Load Aggregation component without file/UI
handling. Numeric IDs are sorted as GH does; string IDs are a JS extension and
sort after them. The format has no connection-index fields, graph, instance
attributes or RNG cursor. JS recovers unique parent/child connection indices from
matching frames and then reconstructs the sequence graph. Missing or ambiguous
connections raise errors. This initial operation supports positive rigid
transforms and unconstrained Parts; reflected/scaled transforms are explicitly
rejected. Full/light core import remains the path for explicit connection data.
Passing compact data to `Aggregation.fromData()` raises an explanatory error.

The existing Mulberry32 generator and unsigned 32-bit seed mapping are unchanged.
The seed is serialized; the random cursor and JS-only part-type filter are not.
Import restarts that seed and does not resume its previous draw position.
Deterministic placement can continue from imported state. Equal seeds do not
promise equal GH/JS assemblies or identical random continuation across import.

See [aggregationState.test.js](src/tests/aggregationState.test.js) for the measured
GH comparisons and JS invariants. DisCo integrations and formats are excluded.

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
src/core/               domain classes, utilities and host adapters
src/operations/         host-independent domain operations
src/tests/              vitest suite
src/tests/fixtures/     JSON fixtures used by tests
dist/                   build output
```

Core classes and operations form the public API through `src/index.js`.
Operations implement domain workflows and reuse core behavior; additional domain
logic from GH components belongs here, with its source documented in comments.
A component that only calls an existing core method does not need a new operation.
Utilities provide shared technical helpers and host adapters. The existing
`src/core/publicApi.js` convenience wrappers retain their current location.
Future changes follow the repository's [instructions](AGENTS.md).

## Related repositories

- [Wasp Atas Explorer with demo showcases](https://github.com/Wasp-Framework/Wasp-Atas-Explorer)
- [Growing Collection of Wasp Datasets](https://github.com/Wasp-Framework/Wasp-Atlas)

## Credits

- Roger Winkler — [rogerwinkler.de](https://www.rogerwinkler.de)
- Andrea Rossi — [thecomputationalhive.com](https://thecomputationalhive.com/)

Based on the original [WASP](https://github.com/ar0551/Wasp) Grasshopper plug-in by Andrea Rossi.

## License

MIT. See [LICENSE.txt](LICENSE.txt).
