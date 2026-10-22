# WaspJS reference

Detailed contracts for the current source. Start with the [README](README.md) for
installation and a complete example. Source changes described here may be newer
than the published npm package; use documentation matching your installed version.

All runtime exports come from `webwaspjs` (ESM) or `require('webwaspjs')` (CommonJS).
Package subpath imports are not exposed. Source JSDoc provides editor information;
no `.d.ts` declarations or runtime schema validator are shipped.

## Package exports

| Export | Purpose |
| --- | --- |
| `Aggregation` | Construct or reconstruct Full/Light core state and query/edit assemblies |
| `Part`, `AdvancedPart`, `Connection`, `Plane`, `Collider`, `Rule` | Core model classes; AdvancedPart has a limited supported subset |
| `Graph` | Sequence topology and geometric full-graph queries |
| `Attribute`, `SmartAttribute`, `getValidSmartAttributes` | Typed attribute data and geometric validity query |
| `PartCatalog`, `createPartCatalog` | Counts/weights and GH-component catalog defaults |
| `generateRules` | Directed compatibility-rule generation |
| `loadAggregation` | Compact Save/Load reconstruction with external base Parts and rules |
| Six legacy aggregation helper functions | Deprecated compatibility delegates; use the class methods below |
| `meshToData`, `meshFromData`, `transformToData`, `transformFromData`, `PlaneToPlane`, `checkMeshesIntersection` | Public geometry/transport utilities |
| `Visualizer` | Minimal browser-only Z-up viewer |
| `types` | Legacy empty runtime object; JSDoc typedefs are comments, not values |

## Source organization

`src/index.js` is the single public package entry point. Core classes own model
behavior, including aggregation inspection and placement queries. `src/operations/`
contains host-independent domain workflows such as rule generation and compact
loading; it does not mirror class methods. Applications import from the package
root rather than internal source paths.

## Aggregation methods and legacy helpers

Use the class methods as the primary aggregation interface. The existing root-level
functions remain callable as deprecated delegates defined beside the core class;
there is no separate aggregation operations or forwarding module.

| Deprecated package function | Preferred call |
| --- | --- |
| `createAggregationFromData(data)` | `Aggregation.fromData(data)` |
| `getAggregationCatalogParts(aggregation)` | `aggregation.getBaseParts()` |
| `getValidPlacementsAtParent(aggregation, name, parentId)` | `aggregation.getValidPlacementsAtParent(name, parentId)` |
| `getValidPlacementsAtConnection(aggregation, name, parentId, connectionId)` | `aggregation.getValidPlacementsAtConnection(name, parentId, connectionId)` |
| `getOpenConnectionsForPart(aggregation, parentId)` | `aggregation.getOpenConnectionsForPart(parentId)` |
| `setActivePartTypes(aggregation, names)` | `aggregation.setActivePartTypes(names)` |

The legacy functions retain their null/undefined-aggregation guards: query helpers
return `[]`, the setter does nothing. Construction still delegates to `fromData`
and can throw for invalid/unsupported data. No helper removal version is scheduled.
The internal source path `src/operations/aggregation.js` was removed; source consumers
must use the package root or core module.

**Behavior correction:** the legacy per-Part connection helper now returns only
rules selected by `active_rules`, matching both core connection queries. It no
longer exposes the complete live `rules_table` array. To inspect every declared
entry deliberately, read the Part's Connection `rules_table` itself; modifying a
query result's rules array no longer edits that table.

## Placement and viewer workflow

`placeFirstPart(name)` and `placePartAtConnection(parentId, connectionIndex,
partName, targetConnectionIndex)` return `{success, part?, error?}`. Invalid or
unsupported model data can still throw; the result object is not a universal
exception boundary. Placement queries return independent candidate Parts and do
not consume inventory. Use their `parentPartId`, `connectionId`, `partName` and
`connectionBId` when confirming a placement; query `transform`/`transformedPart`
are previews, not newly registered Parts.

`aggregate_rnd(num)` adds up to **num additional Parts**, including the seed of an
empty aggregation. It returns `true` or a failure message when it stops short.
Inspect `getParts().length` for the actual result. `addPartToAggregation()` returns
a boolean. These model operations do not update a viewer automatically.

`getParts()` returns the live placed array. `getBaseParts()` returns a new array
of reusable definitions in object-value order, with live Part references; it does
not return placed instances or PartCatalog inventory. `getOpenConnections()` and
`getOpenConnectionsForPart(id)` share the same active-rule projection. Result and
rules arrays are new, but their Plane and Rule objects remain live references.
Slots with no active rules can still be listed; inspecting does not prune state.
Connection indices are numeric; Part IDs can be numbers or strings and use exact
matching. An unknown Part ID returns `[]`.

The three placement queries (whole aggregation, parent and connection) share one
candidate evaluator. Scoped queries enumerate only their requested slots; they do
not construct all candidates and filter afterwards. Parent/slot/active-rule order,
original rule indices, supported collision checks and inventory checks are retained.
The random-growth Part-type filter is separate from explicit placement queries.

`modifyParts(target, viewer)` is asynchronous and updates a supplied viewer during
edits; it requires that viewer when an edit succeeds. It may stop below the target
and resolves without a count. Core-only consumers should use direct placement or
growth methods and read actual state.

`Visualizer(container, sizingContainer = container)` accepts CSS selectors or DOM
elements, creates its renderer and starts animation/resize handling immediately.
Give the container an explicit size. `addEntity(part)` clones the scene object but
shares geometry/materials; `removeEntity(part)` removes its named scene clone.
Call `dispose()` on teardown to release the loop, listener, controls and renderer;
caller-owned geometry/material disposal remains the application's responsibility.
The viewer is not a picking, editor, hover or interaction framework.

Importing the package installs the existing `three-mesh-bvh` raycast adapter on
`THREE.Mesh.prototype.raycast`. Collision queries themselves use private geometry
caches. Applications providing a custom mesh raycast should account for that
shared Three.js prototype setup.

## Reading and exporting data

Use `Aggregation.fromData(coreData)` for Full/Light core JSON. Full export
`aggregation.toData()` includes placed geometry. Light export
`aggregation.toData(false)` omits per-instance display geometry/primary colliders
but includes reusable definitions, transforms, graph, attributes and supported
inventory. Both are standalone core payloads for the supported subset.

`aggregation.toFileData()` is a separate **compact** format. It needs external
base Parts and rules when loaded with `loadAggregation()`. It does not preserve
instance attributes, graph, inventory or a random cursor; attached inventory
therefore makes compact export throw. Prefer Full/Light for state exchange.

## Placed geometry

`aggregation.toData()` includes placed instance geometry and colliders in assembly
coordinates, matching Python Wasp's inline geometry convention. Their placement
is baked into the exported vertices without changing the runtime meshes or base
parts. Importing inline geometry does not apply the Part transform a second time.
`aggregation.toData(false)` instead omits instance geometry and primary colliders; import
reconstructs them from the base parts and placement transforms. Viewer scene-parent
transforms are not included in these exports.

## Part center

`Part.center` is the area-weighted centroid of the mesh surface, matching the
measured GH-Wasp cases. It is not a volume or physical mass centroid. Indexed and
non-indexed triangles include the local mesh placement and exclude scene-parent
transforms; nonuniform scale changes the surface-area weights. Quad JSON uses the
existing triangle split in `meshFromData`; planar quads are covered by the tests.
Empty and zero-area triangle meshes return the origin, as in the measured Rhino
cases. Dimension calculation is described separately below; no dependency is added.
The calculation makes one pass over triangles whenever a Part is constructed.

## Part dimension

Omitted or `null` `dim` now computes the largest distance from the surface centroid
of the display mesh to **all primary collider vertices**, matching the measured
GH Part constructor. All meshes/alternative variants contribute, including unused
vertices on directly constructed meshes; an additional collider does not contribute.
Local model placement is included, scene parents excluded. Vertex/pose/bounds data
are not changed. The same rule applies to Part and the supported AdvancedPart.

**The previous Base-Part constructor default was `1`.** Pass `1` explicitly if
that radius is intentional. Explicit values (including `0`) and imported dimensions
remain unchanged through copy, rigid transforms and full/light data. The existing
maximum-scale display bounding-sphere fallback remains for missing/empty primary
colliders; GH instead yields `None` when there are no primary vertices. This finite
fallback is a JS compatibility boundary, not GH parity. Nonfinite primary vertices
are rejected when an automatic radius is requested.

`Graph.fromAggregation` uses these dimensions in its neighbor filter. The native
counterexample in [partDimension.test.js](https://github.com/winroger/waspjs/blob/main/src/tests/partDimension.test.js) now
retains two directed edges previously excluded by the JS default. Existing stored
models with explicit small dimensions are not silently repaired or migrated.

## Connection assignment

Constructing a `Part` assigns its name to every supplied Connection's `part` field
and assigns consecutive IDs starting at zero, replacing previous values as GH-Wasp
does. The constructor retains those Connection objects and mutates them in place.
Use separate Connection copies when creating independent parts; reusing the same
object for another part changes the owner seen by the first part too.
`Part.fromData()` creates new Connection objects, so its input JSON is unchanged.

## Geometry ownership

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
[meshOwnership.test.js](https://github.com/winroger/waspjs/blob/main/src/tests/meshOwnership.test.js).

Comments in utilities and operations identify each function's
GH utility/component counterpart or JavaScript-specific role, including Rhino
API adapters and known differences. Internal helpers are excluded from the
public package entry point.

## Connection frames

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
[planeCompatibility.test.js](https://github.com/winroger/waspjs/blob/main/src/tests/planeCompatibility.test.js). Reference
results were executed using GH-Wasp 0.7.003 in Rhino; they do not establish parity
for general affine transforms, reflections, or every aggregation workflow.

## Part attributes

`Part.attributes` remains an optional JSON array. Construction also accepts explicit
`Attribute`/`SmartAttribute` instances, converted to data immediately; existing callers keep the
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
Untyped JSON metadata is a JS extension and is not automatically a valid GH
attribute. Unknown/invalid typed values can be normalized to null by GH's reader.
In the measured IronPython host, native JSON dumping of Color channels also fails
on `.NET Byte` values; the test capture adapter normalizes those scalars and records
that native failure separately. A lossless arbitrary GH attribute roundtrip is not
promised.

InternalTransform and general RhinoCommon geometry remain outside the supported
contract. Comparison evidence for normal Attributes is in
[attributes.test.js](https://github.com/winroger/waspjs/blob/main/src/tests/attributes.test.js).

## Smart attributes

`SmartAttribute` lives next to `Attribute` in the same core module, matching GH.
It accepts typed JSON values and runtime `Connection` objects or connection data:

```js
import { SmartAttribute, getValidSmartAttributes } from 'webwaspjs';
const finish = new SmartAttribute('finish', [
  { type: 'String', value: 'cap', valid: true },
], false, [part.connections[0]], [1]);
// Supply finish as a Part attribute before placing that Part.
const valuesByPart = getValidSmartAttributes(aggregation, ['finish']);
```

`Attribute.fromData()` dispatches `class_type: 'SmartAttribute'`. `copy()` and
`transform()` retain the class, mask, connection references and unknown JSON fields.
As in GH, transforming a SmartAttribute moves its transformable **values**, while
its stored Connection frames stay in their original coordinates. Their IDs refer
to slots on the placed Part; the geometric query uses that Part's placed frames.
JS deliberately copies values, connections and masks independently instead of
reproducing GH's shared mutable state. Part attributes retain their JSON-array API.

`Aggregation.checkBlockedConnections(part, false, null, tolerance = 0.002)`
corresponds to GH's standard geometric query. Despite its name it returns
**free connection indices**. A slot is blocked when the distance from its origin
to another Part's display-mesh surface is strictly **less than** the tolerance.
Equal-ID Parts are skipped. Neither active connections, colliders, aggregation
mode nor the stored graph determines this result. A point inside a closed mesh
can remain free if it is far from the surface. Coordinates stay in model units;
there is no Rhino/Three.js up-axis conversion. The default matches the measured
GH global tolerance; pass the appropriate value for another document/unit setup.

`getValidSmartAttributes(aggregation, ids, tolerance = 0.002)` is the host-independent
counterpart of GH's Get Valid Smart Attributes component. `ids` contains attribute
names. Output is a nested array: one row per placed Part, containing the typed
value arrays of valid matching attributes in requested-name order. Missing/invalid
matches add no group. First matching SmartAttribute wins even if invalid;
duplicate requested names repeat its values. Results are independent snapshots.

A mask entry `1` requires a free slot, `-1` a blocked slot, `0` ignores it. The
stored attribute Connection ID is compared with the returned **Part array index**,
matching GH even when IDs are noncontiguous. Empty and shorter masks are allowed;
unknown mask values and masks longer than the attribute connection list raise
errors instead of GH's silent ignores or later IndexError. Values and geometry
follow the same measured rigid-transform support as normal Attributes.

Only the standard surface query is implemented: `connectionsOnly=true` and a
non-null `customGraph` raise errors. Empty queried meshes also raise errors;
GH's measured invalid closest point otherwise produces false blocking. Tests
cover small triangle/planar-quad surfaces and strict tolerance cases; general
degenerate/nonplanar meshes and arbitrary Float32 boundary parity remain unproven.
Direct buffer edits must set `needsUpdate`, as for collision queries. Scene-parent
transforms and rendering visibility do not affect model geometry.

[smartAttributes.test.js](https://github.com/winroger/waspjs/blob/main/src/tests/smartAttributes.test.js) compares actual GH
Core/component-domain measurements, Part transforms, full/light state and copy
ownership. Genuine JS-to-GH Part reads cover placed/chained full/light exports.
Grasshopper UI/DataTree integration, Fields, further Constraints and InternalTransform
are excluded; no installed application is updated by this library feature.

## Part catalogs

`PartCatalog` is defined beside Part and AdvancedPart in `src/core/part.js`, as in
GH's module. It stores remaining counts or selection weights, independently of
`Aggregation.parts` (the reusable Part definitions).

```js
import { PartCatalog, Aggregation, createPartCatalog } from 'webwaspjs';
const inventory = new PartCatalog(['A', 'B'], [5, 3]); // limited=true, adaptive=false
const aggregation = new Aggregation('example', baseParts, rules, 42, 0, inventory);
aggregation.aggregate_rnd(4);
console.log(aggregation.catalog.toData()); // CURRENT remaining quantities
// GH Parts Catalog component defaults: unlimited proportional weights.
const proportions = createPartCatalog(baseParts, [3]); // broadcast to each type
```

`new PartCatalog(names, amounts, isLimited = true, isAdaptive = false)` follows the
GH core defaults. `createPartCatalog(parts, amounts, limited = false,
adaptive = false)` implements the GH component's different defaults, null flags
and single-amount broadcast. Names must be unique nonempty strings; limited counts
are nonnegative safe integers, unlimited weights finite nonnegative numbers.
An empty core catalog is valid; an empty component input is rejected.

`dict`, `parts_total`, `is_empty`, `parts`, `amounts`, `is_limited` and `is_adaptive`
use GH's field names. Inspect `dict` for current stock; `amounts` is the constructor
snapshot. Change stock with `update(name, difference)`. Limited catalogs subtract
counts; unlimited fixed catalogs leave weights unchanged. Unlimited adaptive
catalogs use GH's floating-input normalization: apply the difference, then rescale
each weight by previous-total / new-total. Limited takes precedence over adaptive.
Negative results, overflow and zero denominators fail before mutation. JS does not
emulate Python-2 integer-division truncation; adaptive behavior is matched against
actual GH floating-valued inputs. Unsafe adaptive placements are unavailable.

`returnRandomPart(randomFn = Math.random)` selects a positive entry uniformly;
`returnWeightedPart(randomFn = Math.random)` selects proportionally. Neither
consumes stock. Draws must be in `[0,1)`; exhaustion returns `null` without drawing.
Sampling follows `parts` order. Optional second `allowedParts` arguments restrict
choices without changing physical stock. JS RNG/order are deliberately distinct
from Python's global generator/dictionary order. `copy()` owns current stock,
name arrays and extra JSON independently. Zero stock is empty immediately.

Inventory is an optional **sixth** Aggregation constructor argument, after seed
and mode. The aggregation copies it. This first integration supports **mode 0**;
mode 1 plus inventory is explicitly rejected, without expanding Constraint scope.
**An attached catalog always governs JS growth, manual placements and previews.**
GH core's separate `aggregate_rnd(..., use_catalog=True)` flag is not needed in JS;
the GH component also enables catalog use when one is supplied. Previews do not
debit stock. Only successful placements do; removed Parts/descendants refund
registered types. Random `activePartTypes` filters are intersected with available
stock. A Part absent from the inventory is unavailable for new placement even if
it exists among the base definitions. `getAggregationCatalogParts` still returns
base Parts, not inventory quantities.

`toData()` uses GH's four-field catalog shape, with **current** amounts.
`fromData()` preserves fractions and extra metadata. JS full/light aggregation
roundtrips preserve the remaining stock without debiting imported instances again.
Imported quantities are authoritative; no initial-vs-remaining heuristic is used.
Registered imported Parts are treated as refundable inventory; previous types
outside the catalog are not debited/refunded. Callers must supply consistent state.
The compact format has no inventory: exporting it with an attached catalog throws;
use full/light core data. RNG cursor restoration remains outside the existing contract.

**Native exchange limitations:** the measured GH writer exports its unchanged
initial `amounts` even after stock is spent, so its roundtrip can replenish inventory.
GH→JS reads retain exactly those supplied quantities. For current GH stock, export
`catalog.copy().to_data()` (the copy snapshots `dict`). GH's reader also casts every
amount to int; it truncates fractional adaptive weights from JS. Integer limited
catalogs and their current quantities were verified through actual JS→GH reads;
lossless fractional-weight exchange with that GH reader is not claimed.

[partCatalog.test.js](https://github.com/winroger/waspjs/blob/main/src/tests/partCatalog.test.js) compares native catalog models,
controlled weight intervals, mode-0 growth, exhaustion and refund behavior, plus
JS state continuation and explicit differences. No Fields, additional Constraints,
Graph-Grammar, application dependencies or schema are introduced by this feature.

## Rules and manual placement

The implementation of `generateRules` lives in
[operations/generateRules.js](https://github.com/winroger/waspjs/blob/main/src/operations/generateRules.js), reflecting its
GH-component origin. The public import remains `import { generateRules } from
'webwaspjs'`. The former direct-source utilities re-export has been removed;
source consumers should import from the package root or the operations module.

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

[ghRulesComparison.test.js](https://github.com/winroger/waspjs/blob/main/src/tests/ghRulesComparison.test.js) compares generator
output and forced placements against results executed in Rhino. The measured
scope covers connection frames, meshes/colliders and parent/connection state for
small rigid placements. It does not establish random-sequence, graph, constraint
or general collision parity. Geometry comparisons ignore face-list order while
preserving vertices and triangle winding. The collision adapter described below
now builds private acceleration data and preserves the source index order.

## Collider checks

Direct `Collider` checks, placement queries, manual placement and random growth
now share the same mesh-surface predicate. All collider meshes on both sides are
considered. With `multiple=false` they form a composite obstacle; with
`multiple=true` they are alternatives and any free variant suffices. `checkAll`
controls enumeration of free variants, not whether all variants must be free.
`checkCollisionsWithParts()` updates `validConnections` with free geometry indices
when connections are associated; `checkCollisionsById()` leaves that list intact.
Its `ids` are indices into the supplied parts array, not Part IDs.

`checkMeshesIntersection()` uses local mesh placement in model coordinates and
excludes scene-parent transforms and render groups/draw ranges. It caches private
Float32 positions, indices and a BVH without changing source buffers, matrices or
existing BVH caches. Pose/geometry replacement and versioned attribute edits
invalidate that cache; mark directly edited position/index attributes
`needsUpdate=true`. Acceleration data consumes additional CPU memory per queried
mesh. `facesCount` counts BufferGeometry triangles; an imported quad has already
been triangulated and therefore counts as two.

This checks surface intersections, not occupied volume. Strict bounding intervals
and omission of coplanar/degenerate triangle pairs match the stable measured GH
cases, including ordinary axis-aligned face/edge/point contacts and complete
containment. Some rotated contacts still intersect; there is no universal
touching-is-allowed rule. One native precision-boundary case changes after repeated
GH queries, and one tilted coplanar GH case changes when argument order is reversed.
JS deliberately keeps deterministic, symmetric decisions in those cases. See
[collider.test.js](https://github.com/winroger/waspjs/blob/main/src/tests/collider.test.js) for the actual reference and limits.

Placement retains two JS differences: an empty simple collider falls back to the
unscaled Part mesh, and no separate GH center-overlap gate is added. Explicit
empty alternative colliders remain blocked. There is no longer a `0.99` shrink.
`coll_check=false` bypasses primary placement collision checks. All existing colliders are
tested without GH's `center`/`dim` radius prefilter. Automatic dimensions now bound
primary collider vertices; explicit/imported sizes can still be smaller. The limited AdvancedPart
extension is described below; general Rhino/constraint parity is not implied.

## Collider line checks

`collider.checkIntersectionWithLine(line)` accepts a `THREE.Line3` or an object
with finite `{start: {x,y,z}, end: {x,y,z}}` points in model coordinates. It tests a
**finite segment**, both triangle sides and every collider mesh, regardless of
alternative-variant flags. It no longer requires a nonexistent `Mesh.intersectsLine`
patch. Invalid endpoints throw when a mesh is queried; an empty collider returns
`false`. Measured endpoint/edge/vertex contacts count. Zero-length, coplanar and
degenerate-triangle cases return `false` in the covered native cases.

The internal adapter uses the shared private model-space geometry, including local
pose and marked buffer edits, without changing caller matrices, indices, buffers
or external BVH caches. Scene parents, render groups/draw ranges and visibility
are excluded. It scans triangles and stops at the first hit; this adds no new BVH
or dependency. Float32 precision and double-roundoff endpoint limits remain; no
universal tolerance/contact or general Rhino geometry parity is promised.
[colliderLine.test.js](https://github.com/winroger/waspjs/blob/main/src/tests/colliderLine.test.js) contains the native cases.
This does not implement Supports or other constraints; `checkGlobalConstraints`
remains a reserved placeholder.

## AdvancedPart and additional colliders

`AdvancedPart` is exported alongside `Part` from `src/core/part.js` and the package
entry point. Its constructor order follows GH's core:

```js
new AdvancedPart(name, mesh, connections, primaryCollider, attributes,
    additionalCollider, [], dim, id, field);
new Aggregation(name, baseParts, rules, seed, 1);
```

The empty array is the unsupported Support slot. Sub-parts, Adjacency and
Orientation lists must also be empty; nonempty or malformed payloads fail
explicitly. No automatic GH-component collider construction is included.
Mode is an optional **fifth** Aggregation argument, preserving the existing fourth
seed argument. Mode `0` ignores additional constraints; mode `1` checks additional
colliders after the primary check, including when `coll_check=false`. Modes `2/3`,
Fields and global constraints remain unsupported. Inventory catalogs are supported
only in mode `0`, as described under [Part catalogs](#part-catalogs).

The additional collider is transformed with the part, including its Connection
frames. Its free variants are geometry indices and do not remove or reopen Part
connections. Query, manual and random placement compute validity on independent
candidates and leave the catalog unchanged. GH writes this cache onto its base
Part during queries; JS deliberately retains its independent-candidate contract.
The first seed bypasses additional checks, as in the measured GH core.

`Part.fromData()` dispatches `class_type: 'AdvancedPart'`; the class's own
`fromData()` and aggregation imports preserve it. Full/light core exports retain
already placed `add_collider` data. Omitted primary buffers are recovered from the
matching AdvancedPart base, without transforming inline additional data again.
A missing legacy `add_collider` can inherit a transformed base copy; explicit null
clears it. Unknown AdvancedPart JSON metadata and explicit connection occupancy
survive JS roundtrips. The separate compact loader rejects AdvancedPart; use core
full/light data for this subset.

`transform(matrix, transformSubParts=false, subLevel=0, maintainParenting=false)`
uses GH's AdvancedPart argument order, which differs from Part's third parenting
argument. Hierarchy transforms remain rejected. `toData(includeGeometry,
includePrimaryCollider)` keeps the existing JS Part flags; GH's second export
flag instead controls attributes. Automatic `dim` uses the same primary-collider
vertex-distance calculation as Part; imported explicit values are retained.
See [Part dimension](#part-dimension) for defaults and the empty-collider boundary.

[advancedPart.test.js](https://github.com/winroger/waspjs/blob/main/src/tests/advancedPart.test.js) contains executed GH
comparisons, supported modes, native reader limits and ownership checks.

## Aggregation state and graphs

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
transport does not serialize their transient pruning. Modes `0` and the limited
additional-collider subset of `1` are supported; modes `2/3`, nonempty Fields,
global constraints and mode-1 catalogs are rejected. Mode-0 catalogs are supported
as described under [Part catalogs](#part-catalogs). The `coll_check` flag controls
primary collision checks; mode-1 additional colliders are checked independently.

**Known GH-reader differences:** the measured GH reader resets connection
occupancy, duplicates Rule endpoints and leaves JSON graph keys as strings,
which can make integer-ID deletion miss nodes. GH trimming also leaves stale
child references. WaspJS retains consistent state instead of reproducing these
defects. Geometry/graph exchange tests do not imply a complete native GH state
roundtrip or identical behaviour after arbitrary edits.

## Compact loading and random continuation

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

See [aggregationState.test.js](https://github.com/winroger/waspjs/blob/main/src/tests/aggregationState.test.js) for the measured
GH comparisons and JS invariants. DisCo integrations and formats are excluded.
