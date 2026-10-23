# WaspJS release notes

## 0.3.9 — 23 October 2026

This release aligns the supported JavaScript core more closely with GH Wasp
0.7.003 and adds attributes, graphs, inventory and limited AdvancedPart support.
It includes **breaking API and behavior changes despite the patch version number**.
Application authors should review the migration steps before upgrading.

The comparison baseline is the published npm package **`webwaspjs 0.3.8`**, released
29 September 2026, with source commit `d94a9c40b51dfe80fff828745d050faf1a65aa52`.

### New features

The published package's 21 runtime exports become 23: eight additions and six removals.

| Added export | Purpose |
| --- | --- |
| `AdvancedPart` | Parts with an additional collider; limited Mode-1 checks |
| `Attribute` | Typed named attribute values, copying and rigid transformations |
| `SmartAttribute` | Attributes with connection masks |
| `getValidSmartAttributes` | Query valid typed value groups for placed Parts |
| `Graph` | Sequence topology and geometric contact graphs |
| `PartCatalog` | Limited inventory and proportional/adaptive weights |
| `createPartCatalog` | Catalog construction with component defaults and amount broadcast |
| `loadAggregation` | Compact reconstruction with external base Parts and rules |

`Aggregation` also exposes `getBaseParts()` and `getOpenConnectionsForPart(id)`.
These inspect reusable definitions and placed-Part slots, respectively. Existing
scoped placement methods stay on the class.

Mode-0 inventory governs manual placement, random growth and previews. Successful
placements consume quantities; removing registered Parts and descendants refunds
them. Previews do not consume stock. Full/Light data carries remaining quantities.
Mode-1 inventory is unsupported.

Graph state is maintained during placement/removal and preserved during Full/Light
exchange. `Graph.fromAggregation()` can compute a separate geometric contact graph.
Typed Point/Line/Plane/Mesh attributes follow supported positive rigid placement;
opaque metadata is copied without inferring coordinate semantics.

### Breaking API changes: aggregation helpers

The six standalone aggregation functions exported by 0.3.8 are removed. Import
`Aggregation` and call its static/instance methods:

| 0.3.8 function | 0.3.9 replacement |
| --- | --- |
| `createAggregationFromData(data)` | `Aggregation.fromData(data)` |
| `getAggregationCatalogParts(aggregation)` | `aggregation.getBaseParts()` |
| `getValidPlacementsAtParent(aggregation, name, parentId)` | `aggregation.getValidPlacementsAtParent(name, parentId)` |
| `getValidPlacementsAtConnection(aggregation, name, parentId, connectionId)` | `aggregation.getValidPlacementsAtConnection(name, parentId, connectionId)` |
| `getOpenConnectionsForPart(aggregation, parentId)` | `aggregation.getOpenConnectionsForPart(parentId)` |
| `setActivePartTypes(aggregation, names)` | `aggregation.setActivePartTypes(names)` |

```js
// 0.3.8
import { createAggregationFromData, getOpenConnectionsForPart } from 'webwaspjs';
const assembly = createAggregationFromData(data);
const slots = getOpenConnectionsForPart(assembly, parentId);
```

```js
// 0.3.9
import { Aggregation } from 'webwaspjs';
const assembly = Aggregation.fromData(data);
const slots = assembly.getOpenConnectionsForPart(parentId);
```

There are no helper aliases or silent null-aggregation guards. Ensure an instance
exists before calling its methods. The per-Part slot query returns only rules
selected by `active_rules`, rather than the full live rule-table array. Result
arrays are independent; Plane and Rule objects remain live references.
`getBaseParts()` returns definitions, not placed instances or inventory quantities.

For direct source consumers, the publicApi module and aggregation operations
wrapper are absent, and Utilities does not re-export `generateRules`. Use package-root
imports; rule generation remains a real Operation. These source-path changes do
not require an additional wrapper layer.

### Breaking behavior changes: connections and rules

- Connection frames are right-handed: `X × Y = Z`. The public Plane constructor
  still takes origin/X/Z, but its Y derivation and serialized normal are corrected.
  Import prioritizes X/Y when present and validates redundant Z.
- 0.3.8 readers can reverse Y when reading corrected XYZ output. Upgrade receiving
  applications before exchanging new exports. Do not compensate by rotating the
  viewer or applying an arbitrary global Y-/Z-up conversion.
- Part construction assigns its name and sequential IDs to supplied Connection
  objects in place. Do not reuse the same Connection object across independent
  base Part definitions.
- `generateRules` defaults `selfConnection` to **true**, rather than false. Pass
  an explicit value to choose the intended policy. With false, equal connection
  IDs are excluded even across differently named Parts. Explicit null flags use
  the component defaults.
- Manual placement and candidate queries honor `Connection.active_rules`.
  `Rule.active` remains metadata and does not disable selection by itself.
  Keep `ruleIndex` references to the complete rule table.

Validate representative directed connections, permitted rotations and forbidden
attachments. Product/engineering compatibility still needs authored rules.

### Bug fixes: geometry, copying and export

- Full aggregation export writes placed mesh and collider vertices in assembly
  coordinates. Inline placed geometry is not transformed twice on import. Light
  data reconstructs geometry from base Parts and stored transforms.
- Successive Part transforms record `new × previous` rather than `previous × new`.
  Recheck chained transformations and regenerate exports whose placement history
  depended on the previous behavior.
- Part/Collider copies and transformed Parts own independent geometry buffers.
  Vertex/index edits no longer change siblings or base definitions. Materials keep
  Three.js sharing semantics. Independent buffers increase memory/copy cost.
- Part centers use the area-weighted display surface centroid rather than a rough
  bounds center. Omitted/null `dim` computes distance to all primary collider
  vertices; the 0.3.8 constructor default was `1`. Pass an explicit radius if that
  value is intentional. Imported explicit dimensions are preserved.
- Collider checks share one surface-intersection implementation across direct,
  manual, query and random paths. Composite meshes and alternative colliders are
  handled consistently. Empty simple colliders fall back to the unscaled display
  mesh rather than a 0.99-scaled mesh. Previously accepted/rejected contacts can differ.
- Collision caches preserve source index/vertex buffers and caller BVHs.
  `facesCount` counts triangles correctly. Finite line intersection checks work
  without a nonexistent Mesh method.

A triangle-surface test is not a solid-volume containment or structural-validity
proof. Check contact/clearance cases important to the application. Do not apply
an automatic coordinate repair to every saved file: native GH data and old inline
exports can have different origins. Use trusted source data and explicit roundtrips.

### State, IDs and import validation

- Full/Light state preserves graph, supported occupancy, current inventory,
  `coll_check` and extra metadata. Missing graphs can be reconstructed from parenting.
- Removing a Part removes dependent descendants, cleans graph references and frees
  surviving-parent slots; deleting only one array entry is not equivalent.
- IDs such as `42-beam` remain complete strings instead of being truncated by
  numeric-prefix parsing. Update UI picking, object lookup and persistence to use
  exact IDs. Whole integer strings can still normalize to numbers on import.
- Invalid parent/graph references, duplicate IDs, parent cycles, missing Parts,
  unsupported modes, nonempty Fields and unsupported constraints fail explicitly.
  In 0.3.8, some unsupported fields/modes were ignored. Show clear incompatibility
  messages; do not strip model semantics merely to make a file load.
- Typed transformable attributes follow placement and retain placed Full/Light
  values; static metadata is independently copied. Invalid/unsupported declared
  transformations throw. Dictionaries containing coordinates are not automatically
  interpreted as geometry.

Mode 0 is the main supported scope. Mode 1 is limited to additional-collider checks.
Modes 2/3, field-driven aggregation, Graph-Grammar aggregation, general constraints,
recursive hierarchies and InternalTransform are outside this release's scope.

### Packaging and runtime

- Node.js 18+ and Three.js `^0.169.0` remain the supported requirements.
- ESM and CommonJS are supplied. TypeScript declarations are not included.
- REFERENCE.md and these release notes are included in the npm archive. Prepack
  builds fresh bundles. Bundler metadata preserves the documented import side effect
  that installs the shared Three.js raycast adapter.
- Browser rendering remains a consumer concern; Visualizer requires DOM/WebGL.
  Importing the model in Node does not create a renderer.

### Application migration checklist

1. Pin the intended `webwaspjs` release and supported Three.js version; use matching
   documentation. Replace the six standalone helper imports with class calls.
2. Check representative Part definitions, ownership of Connection objects, rules,
   rotated attachments and exact ID handling. Choose explicit rule-generation flags.
3. Load/export/reload Full and Light data. Verify placed geometry, transformed
   attributes, active slots, parenting and graph; avoid applying placement twice.
4. Preserve supported inventory and AdvancedPart data. Reject unsupported feature
   combinations visibly. Test actual placed counts when growth stops below a target.
5. Check collision/contact behavior, copy isolation and memory use on real models.
6. If using inventory, test exhaustion and deletion refunds. Do not confuse a UI
   product catalog with core PartCatalog stock.
7. Exercise manual placement, random growth, removal, save/reload and browser picking
   in the application before adopting the package in production.

A serialized seed does not restore the random cursor, and equal GH/JS seeds do not
produce identical sequences. Compact data requires external bases/rules and carries
less state; use Full/Light for inventory and placed attributes. Current GH readers
also have rule-endpoint, occupancy and fractional-inventory limitations described
in the [reference](REFERENCE.md#grasshopper-exchange-boundaries).
