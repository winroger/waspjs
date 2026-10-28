# WaspJS reference

Contracts for `webwaspjs` 0.3.9. Start with the [README](README.md) for installation
and an executable example. Version changes and migration instructions are in
[RELEASE_NOTES.md](RELEASE_NOTES.md).

## Package exports

Import from `webwaspjs` with ESM or `require('webwaspjs')` with CommonJS.
Package subpath imports are not exposed. Source JSDoc supplies editor information;
TypeScript declaration files and a runtime JSON-schema validator are not included.

| Export | Purpose |
| --- | --- |
| `Aggregation` | Construct, load, inspect and edit an assembly |
| `Part`, `AdvancedPart`, `Connection`, `Plane`, `Collider`, `Rule` | Parts and attachment model |
| `Graph` | Sequence topology and geometric contact-graph queries |
| `Attribute`, `SmartAttribute`, `getValidSmartAttributes` | Typed attributes and validity queries |
| `PartCatalog`, `createPartCatalog` | Inventory counts or selection weights |
| `generateRules` | Directed connection-rule generation |
| `loadAggregation` | Compact reconstruction with external base Parts and rules |
| `meshToData`, `meshFromData`, `transformToData`, `transformFromData`, `PlaneToPlane`, `checkMeshesIntersection` | Geometry and transport utilities |
| `Visualizer` | Browser-only Z-up viewer |
| `types` | Empty runtime object; JSDoc shapes are comments |

Core classes own model behavior. Operations provide host-independent workflows,
including rule generation, compact loading and SmartAttribute queries. Internal
geometry adapters are not part of the package exports.

## Aggregation interface

```js
new Aggregation(name, baseParts, rules, seed = null, mode = 0, catalog = null);
const aggregation = Aggregation.fromData(coreData);
```

`Aggregation.fromData()` accepts supported Full/Light core data and throws for
invalid or unsupported state. Instance methods require an Aggregation object.

| Method | Contract |
| --- | --- |
| `getParts()` | Live array of placed Parts |
| `getBaseParts()` | New array of reusable definitions, in object-value order; Part objects are live references |
| `getOpenConnections()` | Active slots across placed Parts |
| `getOpenConnectionsForPart(id)` | Active slots on one placed Part; unknown ID returns `[]` |
| `getValidPlacementsForPart(name)` | Candidates for a base Part across the assembly |
| `getValidPlacementsAtParent(name, parentId)` | Candidates at one parent's active slots |
| `getValidPlacementsAtConnection(name, parentId, connectionId)` | Candidates at one active slot |
| `placeFirstPart(name)` | Place a named seed in an empty assembly |
| `placePartAtConnection(parentId, connectionId, name, connectionBId)` | Apply an explicit attachment |
| `setActivePartTypes(names)` | Restrict random growth; `null`/`undefined` permits all base types |
| `aggregate_rnd(count)` | Attempt to add `count` additional Parts |
| `removePartFromAggregation(id)` | Remove a Part and its dependent descendants |
| `toData(includeGeometry = true)` | Export Full or Light core data |
| `toFileData()` | Export compact data requiring external bases and rules |

Base definitions, placed instances and PartCatalog inventory are separate objects.
Part IDs support numbers and strings and use exact matching. Connection indices
are numeric. Whole integer-string IDs in imported Part state are normalized to
numbers; identifiers such as `42-beam` keep their complete value.

Both connection queries return new result and rules arrays with live Plane and
Rule references. `active_connections` chooses slots; `active_rules` chooses rule
indices. A slot with no active rules can still appear. Inspection does not prune
state or perform a fresh collision test.

Placement queries preserve parent/slot/active-rule order and evaluate only their
requested scope. They return independent transformed candidate Parts and matrices,
with `parentPartId`, `connectionId`, `partName`, `connectionBId` and `ruleIndex`.
The rule index refers to the complete connection rule table. Previews do not
consume inventory. Confirm a candidate using its attachment identifiers; preview
objects are not registered Parts. The random type filter does not restrict explicit
placement queries.

Explicit placement returns `{success, part?, error?}`. Invalid or unsupported data
can also throw. The first seed bypasses the subsequent placement collision checks.
`aggregate_rnd()` returns `true` or a failure message when growth stops short;
`addPartToAggregation()` returns a boolean. Inspect the actual placed count.

Removal returns a boolean, records removed Parts in `removed_parts`, removes
incident graph edges and restores freed surviving-parent slots. Unrelated branches,
surviving IDs and the live placed-array reference are retained. IDs increase within
the instance; import computes the next ID from surviving numeric IDs. Deleted-ID
history is not serialized.

`modifyParts(target, viewer)` asynchronously adjusts toward a total count and
updates the supplied viewer after edits. It requires a viewer when an edit succeeds,
may stop below the target, and resolves without a count. Direct model operations
do not update viewers automatically.

## Reading and exporting data

Full `aggregation.toData()` includes placed display geometry and colliders in
assembly coordinates. Placement is baked into exported vertices without mutating
runtime or base meshes. Importing inline placed geometry does not apply the Part
transform again. Scene-parent transforms are outside the export contract.

Mesh imports use Float32 vertex buffers. Reloading transformed Full geometry can
round its coordinates to that precision; plane axes are also normalized on import.
Use model-appropriate tolerances for geometric roundtrip comparisons rather than
requiring byte-identical coordinates.

Light `aggregation.toData(false)` includes reusable definitions, transforms,
connections, graph, attributes and supported inventory. It omits per-instance
display geometry and primary colliders; import reconstructs them from the base
Part and placement transform. Additional colliders and instance attributes are
included in their placed coordinates in both variants.

The compact format is distinct. `loadAggregation(compactData, baseParts, rules,
seed = null, tolerance = 0.002)` reconstructs it using external bases/rules.
It supports unconstrained Parts with positive rigid transforms and unique matching
connection frames. Missing or ambiguous connections throw. Numeric IDs are sorted;
string IDs sort afterwards. It reconstructs the sequence graph but does not carry
instance attributes, inventory or a random cursor. Compact AdvancedPart loading
and exporting compact state with inventory are rejected.

Full/Light loading validates supported structure, graph and parenting references,
IDs, sequence and occupied slots. A missing or empty graph is reconstructed from
parenting. Invalid references, duplicate IDs and parent cycles throw. Additional
JSON metadata is copied through supported roundtrips. Loading does not perform a
complete geometric or engineering validation of an existing assembly.

## Parts and geometry ownership

```js
new Part(name, mesh, connections, collider = null, attributes,
    dim = null, id = null, field = null);
```

Construction retains the supplied mesh/collider and Connection objects. It assigns
the Part name to each Connection's `part` field and sequential IDs from zero.
Use separate Connection copies for independent Part definitions. `Part.fromData()`
constructs Connections without changing its input JSON.

`Part.copy()`, `Part.transform()`, Light `Part.fromData(data, basePart)` and Collider
copy/transform allocate independent geometry buffers. Editing vertices, indices
or normals on a result does not modify its source. Materials retain Three.js
sharing semantics. Viewer clones, custom geometry metadata and caller-owned
resource disposal have separate ownership requirements.

`Part.transform(matrix, transformSubParts = false, maintainParenting = false)`
returns a transformed copy. For successive placements, the recorded matrix is
`newTransform × previousTransform`. Supported parity concerns positive rigid
transforms; general reflection, shear and hierarchy transformation are not covered.
`Part.toData(includeGeometry = true, includeCollider = true)` has independent
geometry/collider flags; the second flag does not suppress attributes.

`Part.center` is the area-weighted display-mesh surface centroid, not a physical
mass or volume centroid. Indexed/non-indexed triangles include local mesh pose;
scene parents are excluded. Nonuniform scale changes surface-area weights. Quads
use the mesh importer's triangle split. Empty/zero-area triangles yield the origin.

## Part dimension

Omitted or `null` `dim` is the largest distance from the display surface centroid
to all primary collider vertices, including unused vertices and alternative meshes.
Additional colliders do not contribute. Nonfinite primary vertices are rejected
when computing an automatic radius. Explicit dimensions, including zero, and
imported dimensions are preserved.

Missing/empty primary colliders use the display bounding-sphere fallback with
maximum local scale. GH Wasp yields `None` without primary vertices; this finite
fallback is a JavaScript boundary. Dimensions are used by geometric Graph neighbor
filtering and do not replace collision validation.

## Connection frames and model units

Planes are right-handed and orthonormal: `X × Y = Z`.
`new Plane(origin, xaxis, zaxis)` derives Y from `Z × X`. Local Z is the attachment
normal and can point in any direction. `Connection.flip_pln` preserves X and
reverses Y/Z. Viewer camera up is independent of connection coordinates.

`Plane.fromData()` reads origin/X/Y with X/Y authoritative, or origin/X/Z.
A redundant Z parallel or opposite to `X × Y` is accepted and normalized; an
unrelated Z, nonfinite coordinates or zero/collinear axes throw. `Plane.toData()`
emits origin and canonical X/Y/Z. Inputs are not rewritten.

Coordinates and tolerances use model units; no automatic unit or Y-/Z-up conversion
occurs. Graph and occlusion defaults are `0.002`; choose tolerances appropriate to
the dataset. Transform utilities convert matrix storage conventions rather than
coordinate-system handedness.

## Rules and manual placement

```js
generateRules(parts, selfPart = true, selfConnection = true,
    useTypes = false, grammar = []);
new Rule(partA, connectionA, partB, connectionB, active = true);
```

Explicit null generator flags use the stated defaults. Disabling `selfPart`
excludes equal base-Part names. Disabling `selfConnection` excludes equal connection
IDs, including across different Part names. Type matching compares type values;
grammar entries such as `socket>plug` are directed type pairs. Valid grammar input
order and duplicates are retained. Type grammar is separate from Graph-Grammar
aggregation.

`Rule.fromData()` preserves both directed endpoints and normalizes valid integer
connection IDs to numbers. `Rule.active` is metadata: setting it false does not
remove an entry from selection. Control usable indices through
`Connection.active_rules`. Manual placement, candidate queries and random growth
use that state. Editing a connection-query result's rules array does not change
the underlying table.

## Attributes

`Part.attributes` is an optional copied JSON array. Construction also accepts
Attribute/SmartAttribute instances, immediately converted to transport records.
Opaque metadata without a `class_type` is retained without inferring geometry.

```js
new Attribute(name, typedValues, transformable);
new SmartAttribute(name, typedValues, transformable, connections, connectionMask);
```

`Attribute.fromData()`, `toData()`, `copy()` and `transform()` preserve typed records
and extra JSON fields. Nested/static values are independently copied.
`Attribute.fromData()` dispatches the SmartAttribute discriminator.

Declared transformable geometry follows positive rigid placement:

| Type | Payload |
| --- | --- |
| `Point` | `[x, y, z]` |
| `Line` | `{ from: [x, y, z], to: [x, y, z] }` |
| `Plane` | Origin/X/Y, optional redundant Z |
| `Mesh` | Vertex/face JSON |

Unsupported declared transformable types, invalid values or unsupported matrices
throw. Static dictionaries, colors, vectors, boxes and opaque geometry JSON are
copied without interpreting nested coordinates. Full/Light instance attributes
are already placed; import does not transform them twice. An omitted instance
attribute field inherits transformed base values; an explicit empty array stays empty.
InternalTransform and general RhinoCommon runtime objects are unsupported.

SmartAttribute transforms move transformable values; its stored Connection frames
stay at their definition coordinates. Connection IDs refer to indices on the
placed Part. `getValidSmartAttributes(aggregation, names, tolerance = 0.002)` returns
independent typed value groups nested by placed Part, then requested attribute name.
The first matching SmartAttribute wins even when invalid. Missing/invalid matches
add no group; duplicate requested names repeat groups.

A mask value `1` requires a free slot, `-1` a blocked slot and `0` ignores it.
Empty/shorter masks are allowed; unknown mask values or masks longer than the
attribute Connection list throw.

`aggregation.checkBlockedConnections(part, false, null, tolerance = 0.002)` returns
**free connection indices**. It checks strict distance `< tolerance` from each
connection origin to other display-mesh surfaces and skips equal-ID Parts.
It does not use active slots, colliders or the graph; an interior point away from
surfaces can be free. Empty queried meshes throw. `connectionsOnly=true` and custom
graphs are unsupported. Visibility and scene-parent transforms are excluded.

## Part catalogs

```js
new PartCatalog(names, amounts, isLimited = true, isAdaptive = false);
createPartCatalog(parts, amounts, limited = false, adaptive = false);
new Aggregation(name, baseParts, rules, seed, 0, catalog);
```

PartCatalog stores remaining counts or selection weights, separately from reusable
base definitions. Names are unique nonempty strings. Limited counts are nonnegative
safe integers; unlimited weights are finite and nonnegative. The factory uses
component defaults, accepts null flags, broadcasts one amount and rejects empty
Part input. An empty direct catalog is valid.

`dict` contains current quantities; `amounts` is a construction snapshot. Other
fields include `parts`, `parts_total`, `is_empty`, `is_limited` and `is_adaptive`.
`update(name, difference)` subtracts limited counts; fixed unlimited weights stay
constant. Adaptive unlimited updates apply the difference and rescale by
previous-total/new-total using floating arithmetic. Limited takes precedence.
Negative/unsafe results and zero denominators fail before mutation.

`returnRandomPart(randomFn = Math.random, allowedParts)` chooses uniformly among
positive entries; `returnWeightedPart` chooses proportionally. Draws are in `[0,1)`.
Neither consumes stock; exhaustion returns null without drawing. Sampling follows
`parts` order. `copy()` independently snapshots current stock and extra JSON.

An attached catalog governs Mode-0 random/manual placement and previews; Mode-1
inventory is rejected. Successful placements consume stock; previews do not.
Removal refunds registered types. Random filters intersect available inventory.
A base type absent from inventory is unavailable for new placement.

Full/Light exports use current quantities; loading preserves fractions/metadata
and does not debit imported instances again. Registered imported instances are
refundable, so callers must supply consistent remaining stock. Compact exports
with inventory throw.

## Collider checks

Direct checks, candidate queries and placements share a mesh-surface predicate.
All collider meshes contribute. `multiple=false` treats them as a composite;
`multiple=true` treats them as alternatives, where one free variant suffices.
`checkAll` controls enumeration of free variants. Associated-connection validity
uses free geometry indices; `checkCollisionsById()` does not change that list.
Its IDs are indices in the supplied Part array, not Part IDs.

`checkMeshesIntersection()` uses local model pose and private Float32/BVH data.
It excludes scene parents, render groups and draw ranges. It preserves source
buffers, indices, matrices and caller BVHs. Pose/replacement/versioned buffer edits
invalidate caches; direct position/index edits must set `needsUpdate=true`.
Private caches consume CPU memory. Face counts use BufferGeometry triangles.

Positive BVH triangle results are checked against face-normal and edge-cross-edge
separating axes using projections relative to one triangle vertex. This rejects
disjoint triangles when a nearly zero-length plane-clipping segment makes the
dependency report an intersection. The numerical allowance covers double
arithmetic roundoff; it is not a model-space clearance or collider shrink.

Collision means surface intersection, not occupied-volume containment. Coplanar
and degenerate triangle pairs and strict axis-aligned bounding contacts have
limited behavior; some rotated touching cases intersect. There is no universal
contact-is-allowed guarantee or general Rhino geometry parity.

An empty simple primary collider falls back to the unscaled display mesh; empty
alternative colliders are blocked. Primary placement checks do not use a separate
center-overlap gate or dimension-radius prefilter. `coll_check=false` bypasses
primary checks, not Mode-1 additional-collider checks.

`collider.checkIntersectionWithLine(line)` accepts a finite `THREE.Line3` or an
object with finite `start`/`end` XYZ points. It checks both triangle sides on every
collider mesh, independent of alternative flags. Empty colliders return false;
invalid endpoints throw when a mesh is queried. Covered edge/endpoint contacts
count; zero-length, coplanar and degenerate cases return false. Float32 precision
limits apply. `checkGlobalConstraints` is an unimplemented placeholder.

## AdvancedPart and supported modes

```js
new AdvancedPart(name, mesh, connections, primaryCollider, attributes,
    additionalCollider, [], dim, id, field);
new Aggregation(name, baseParts, rules, seed, 1);
```

AdvancedPart requires a primary Collider. Supports, subparts, adjacency and
orientation collections must be empty; recursive hierarchy is unsupported.
Mode 0 carries additional collider data without checking it. Mode 1 checks it
after primary checks, including with `coll_check=false`. The first seed bypasses
these placement checks. Modes 2/3, Fields and global constraints are unsupported.

Additional collider meshes/frames transform with the Part and have independent
copy buffers. Valid alternative indices do not remove/reopen Part connections.
Query/manual/random checks operate on independent candidates rather than base Parts.
Full/Light imports preserve placed additional collider data; an omitted field can
inherit its transformed base value, while explicit null clears it.

`AdvancedPart.transform(matrix, transformSubParts = false, subLevel = 0,
maintainParenting = false)` has a different third argument from Part.
Nonzero sublevels and recursive transforms throw. Its export flags have the same
geometry/primary-collider meanings as Part. Automatic dimensions use primary vertices.

## Graphs and random continuation

`aggregation.graph` is a directed sequence Graph carrying `start`, `end`,
`conn_start` and `conn_end`. Placement/removal and Full/Light state keep this graph.
`Graph.fromAggregation(aggregation, fullGraph = true, tolerance = 0.002,
filterByRules = false, customRules = [])` creates a separate geometric contact graph.
It uses Part center/dimension neighbor filtering, compares connection origins
without normals, and retains the first connection pair per directed Part pair.
Rule filtering is directed; empty custom rules use aggregation rules.
`fullGraph=false` returns the existing live sequence graph.

Graph supports `fromData`, `toData`, `addNode`, `addEdge`, `removeNode`, `countEdges`,
`getNodes`, `getEdges` and `getEdgesAttributes`. The last two accept `flatten=false`.
Transport and edge-attribute results copy JSON. Duplicate directed pairs keep the
existing edge. Attribute-driven graph export throws.

Random growth uses Mulberry32 with an unsigned 32-bit seed. The seed is serialized;
the RNG cursor and random Part-type filter are not. Loading restarts the seed,
not the previous draw position. Equal Python/JavaScript seeds do not imply equal
assemblies. Explicit placement supports deterministic continuation.

## Visualizer and host integration

`new Visualizer(container, sizingContainer = container)` accepts selectors or DOM
elements, requires a browser/WebGL and starts rendering/resize handling immediately.
Give its container an explicit size. It uses Z-up and is a basic display helper,
not an editor or picking framework.

`addEntity(part)` makes a scene clone sharing geometry/materials;
`removeEntity(part)` removes the named clone. Call `dispose()` on teardown to stop
the loop and release listeners, controls and renderer. Caller-owned materials and
geometry remain the caller's disposal responsibility.

Importing WaspJS installs `three-mesh-bvh`'s raycast adapter on
`THREE.Mesh.prototype.raycast`. Applications with their own adapter must account
for that shared Three.js prototype. Collision acceleration uses separate private
geometry caches.

## Grasshopper exchange boundaries

The reference target is GH Wasp 0.7.003 for the supported subset. It is not a promise
of full RhinoCommon, Grasshopper UI or general affine-transform parity.

- GH's plane reader uses X/Y and ignores redundant Z; WaspJS validates redundant Z.
- GH's Rule reader can duplicate the first endpoint. Directed rule exchange through
  that reader is therefore limited.
- GH's catalog writer can export initial quantities rather than current stock;
  its reader truncates fractional amounts. For a current GH stock snapshot use
  `catalog.copy().to_data()`. WaspJS cannot infer missing inventory history.
- GH's state reader can reset occupancy and retain string graph keys; trimming can
  leave stale child references. Cross-runtime state continuation needs explicit tests.
- Typed attribute records are the interoperable form. Untyped metadata is a JS
  extension; arbitrary Rhino objects/typed values are not losslessly interchangeable.

Use dataset-specific roundtrips to verify the producer, consumer, units and intended
feature scope. DisCo formats and integrations are outside the supported contract.
