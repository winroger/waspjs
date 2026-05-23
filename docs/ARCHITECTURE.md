# webwaspjs Architecture

## Overview

`webwaspjs` is a browser-oriented runtime for discrete aggregation systems built on top of Three.js.

The package currently provides:

- domain objects for parts, connections, planes, rules, colliders, and aggregations
- one supported reconstruction entry point for serialized aggregation data
- geometry, transform, rule-generation, and collision utilities
- a lightweight `Visualizer` for scene rendering in browser environments
- a small public helper layer for common aggregation queries and placement workflows

The package is intentionally narrower than the `Wasp-Atlas-Explorer` application. The library owns the aggregation model and placement engine. App-specific presentation and UI orchestration should live in the Explorer repo.

## Source Layout

```text
src/
├─ index.js
├─ core/
│  ├─ aggregation.js
│  ├─ collider.js
│  ├─ connection.js
│  ├─ part.js
│  ├─ plane.js
│  ├─ publicApi.js
│  ├─ rule.js
│  ├─ utilities.js
│  └─ visualizer.js
└─ types/
   └─ index.js
```

Tests live in `tests/`. Example fixtures used by tests live in `examples/`.

## Public Package Surface

The entry point is [src/index.js](/Users/rogerwinkler/Documents/GitHub/waspjs/src/index.js:1).

It exports:

- core classes:
  - `Aggregation`
  - `Collider`
  - `Connection`
  - `Part`
  - `Plane`
  - `Rule`
- `Visualizer`
- core utilities from `src/core/utilities.js`
- aggregation-facing helper functions from `src/core/publicApi.js`
- JSDoc typedefs from `src/types/index.js`

There is currently one supported input format: serialized aggregation data.
The official convenience entry point for that is `createAggregationFromData()`.

## Architectural Layers

### 1. Domain Model Layer

The domain model describes the aggregation system itself.

Core classes:

- `Plane`
  - coordinate frame with `origin`, `xaxis`, `yaxis`, `zaxis`
  - supports serialization and transforms

- `Connection`
  - attachment point on a part
  - stores a plane, a type, a part-name reference, and an id
  - builds rule tables against a rule set

- `Rule`
  - directed connection compatibility relation between two parts
  - small, data-oriented, and serializable

- `Collider`
  - wrapper around collision meshes
  - supports serialization, cloning, transformation, and overlap checks

- `Part`
  - reusable catalog element and placed aggregation node representation
  - stores geometry, connections, collider, transform, hierarchy references, and metadata
  - can be copied and transformed into placed instances

- `Aggregation`
  - owns catalog parts and rules
  - stores placed parts in `aggregated_parts`
  - implements growth, manual placement, removal, filtering, and deserialization

### 2. Utility Layer

[src/core/utilities.js](/Users/rogerwinkler/Documents/GitHub/waspjs/src/core/utilities.js:1) contains shared low-level helpers:

- `checkMeshesIntersection`
  - BVH-backed collision check using `three-mesh-bvh`
- `meshToData` / `meshFromData`
  - serialize and rebuild Three.js meshes
- `transformToData` / `transformFromData`
  - serialize and rebuild `THREE.Matrix4`
- `PlaneToPlane`
  - compute transforms between connection planes
- `generateRules`
  - derive rule sets from connection definitions

This file is the main mathematical and serialization support layer for the package.

### 3. Reconstruction Layer

Reconstruction is handled directly by:

- `Aggregation.fromData()`
- `createAggregationFromData()`

`createAggregationFromData()` is a thin public API wrapper around the static class method.

This keeps the public loading contract narrow: one input shape, one reconstruction path.

### 4. Browser Runtime Layer

The browser runtime is [src/core/visualizer.js](/Users/rogerwinkler/Documents/GitHub/waspjs/src/core/visualizer.js:1).

`Visualizer` currently owns:

- scene creation
- camera creation
- renderer lifecycle
- `camera-controls`
- animation loop
- resize handling
- scene insertion and removal of part meshes

This is a browser-only layer. It assumes:

- a DOM
- WebGL availability
- a concrete container element

It is appropriate for:

- demos
- editors
- interactive viewers

It is not appropriate as-is for:

- Node-only execution
- SSR usage
- headless scene management

### 5. Public Helper Layer

[src/core/publicApi.js](/Users/rogerwinkler/Documents/GitHub/waspjs/src/core/publicApi.js:1) is now an aggregation-facing convenience layer only.

It currently exposes:

- `createAggregationFromData`
- `getAggregationCatalogParts`
- `getValidPlacementsAtParent`
- `getValidPlacementsAtConnection`
- `getOpenConnectionsForPart`
- `setActivePartTypes`

These helpers are thin wrappers over `Aggregation` methods. They no longer own app-specific concerns like coloring, visual framing, or manual scene mutation.

## Runtime Data Model

### Catalog State

An `Aggregation` starts with:

- `name`
- `parts`
  - object keyed by part name
  - catalog parts, not placed scene instances
- `rules`
- `rnd_seed`
- `randomFn`
- `activePartTypes`

### Placement State

Placed state lives in:

- `aggregated_parts`

Each placed `Part` may carry:

- `id`
- transformed `geo`
- transformed `connections`
- transformed `collider`
- `parent`
- `conn_on_parent`
- `conn_to_parent`
- `children`
- `active_connections`

The same `Part` class is used for both:

- catalog parts
- placed instances

That keeps the model compact, but it also means there is no strict type boundary between immutable part definitions and placed runtime state.

## Core Flows

### Flow 1: Rebuild Aggregation From Serialized Data

1. Consumer calls `createAggregationFromData()` or `Aggregation.fromData()`.
2. `Aggregation.fromData()` normalizes incoming `parts` and `rules`.
3. Each part is reconstructed with `Part.fromData()`.
4. Each rule is reconstructed with `Rule.fromData()`.
5. A live `Aggregation` instance is created.
6. `aggregated_parts` starts empty unless placement is built later through runtime methods.

Current state:

- catalog part reconstruction is implemented
- rule reconstruction is implemented
- string ids are preserved during deserialization
- full replay of serialized placed-state is still intentionally incomplete

### Flow 2: Random Aggregation Growth

1. `Aggregation.addFirstPartToAggregation()` places an initial part when the aggregation is empty.
2. `Aggregation.addPartToAggregation()`:
   - selects a placed part
   - selects one of its active connections
   - resolves valid rules
   - transforms the target catalog part into place
   - runs collision checks
   - updates hierarchy and connection state
3. `modifyParts()` repeats this to grow or shrink the model toward a target count.

This flow depends on:

- connection rule tables
- `PlaneToPlane()`
- `Part.transform()`
- mesh collision checks

### Flow 3: Manual / Deterministic Placement

1. Consumer queries:
   - `getOpenConnectionsForPart`
   - `getValidPlacementsAtParent`
   - `getValidPlacementsAtConnection`
2. Consumer selects one valid placement.
3. Consumer calls the corresponding `Aggregation` placement method.
4. An external viewer or app layer updates the scene.

This flow is still library-owned at the aggregation level, but the UI behavior around previews, hover state, and placement confirmation belongs in the app.

## Rendering Strategy

### Scene Entity Mapping

`Visualizer.addEntity(part)` clones `part.geo` and names the mesh as:

- `${part.name}_${part.id}`

`Visualizer.removeEntity(part)` depends on that naming convention to map scene objects back to aggregation parts.

Implication:

- scene bookkeeping currently depends on `name + id` string encoding
- renderer/entity coordination is simple, but not strongly typed

## Typing and Serialization

[src/types/index.js](/Users/rogerwinkler/Documents/GitHub/waspjs/src/types/index.js:1) provides JSDoc typedefs for:

- `TransformData`
- `PlaneData`
- `ConnectionData`
- `RuleData`
- `ColliderData`
- `PartData`
- `AggregationData`

The package currently relies on:

- runtime JavaScript objects
- JSDoc typedefs for editor support
- tests for contract validation

It does not currently provide generated TypeScript declarations.

## Package Boundary vs Explorer Boundary

### Belongs In `webwaspjs`

These concerns are package-owned:

- aggregation domain model
- serialization and reconstruction of aggregation data
- rule generation
- collision logic
- random growth and deterministic placement logic
- minimal scene rendering for placed parts

### Belongs In `Wasp-Atlas-Explorer`

These concerns are app-owned:

- dataset selection and loading UX
- part color policy and dataset color configuration
- target-count UI behavior
- framing behavior chosen for the app layout
- click/hover/manual-placement interaction orchestration
- viewer overlays and ghost-selection UX

That split is already reflected in the Explorer repo through local adapters such as `src/lib/waspAdapters.ts`.

### Remaining Mixed Area

The main remaining mixed boundary is `Visualizer` itself.

What is still generic enough to keep in the package:

- renderer setup
- camera and controls
- add/remove part entities
- resize and disposal lifecycle

What already moved to the Explorer repo:

- pointer-event raycasting
- ghost-preview mesh management
- ghost highlight behavior

Those behaviors now live beside the build-screen runtime rather than inside the package class.

## Current State Summary

### Stable / Implemented

- core classes and serialization model
- single supported aggregation import path
- random aggregation growth
- deterministic/manual placement queries
- collision checks in placement workflows
- browser rendering through `Visualizer`
- tests for public API creation, serialization, utilities, manual placement, and example fixtures

### Partially Implemented

- full restoration of placed aggregation state from serialized data
- stricter type-level separation between catalog parts and placed parts
- deciding whether the minimal browser viewer should remain in the package long-term

### Explicitly Unimplemented

- `global_constraints` deserialization
- `catalog` deserialization in `Aggregation.fromData()`
- full attribute system on `Part`
- field/constrained behavior beyond placeholders

## Test Coverage

Current test suites:

- [tests/demoExamples.test.js](/Users/rogerwinkler/Documents/GitHub/waspjs/tests/demoExamples.test.js:1)
  - example fixture integrity
- [tests/publicApi.test.js](/Users/rogerwinkler/Documents/GitHub/waspjs/tests/publicApi.test.js:1)
  - public API reconstruction flow
- [tests/manualPlacement.test.js](/Users/rogerwinkler/Documents/GitHub/waspjs/tests/manualPlacement.test.js:1)
  - placement, open connections, valid placements, filtering, removal
- [tests/serialization.test.js](/Users/rogerwinkler/Documents/GitHub/waspjs/tests/serialization.test.js:1)
  - mesh/matrix/rule serialization and id preservation
- [tests/utilities.test.js](/Users/rogerwinkler/Documents/GitHub/waspjs/tests/utilities.test.js:1)
  - transforms, rule generation, and collider bounds logic

Current gaps:

- no direct automated tests for `Visualizer`
- limited tests around browser lifecycle behavior
- no coverage for explicitly unimplemented deserialization branches

## Known Design Tradeoffs

### Single `Part` Class for Catalog and Instances

Pros:

- simple mental model
- fewer conversion steps

Cons:

- catalog and placed-instance concerns share one mutable structure
- harder to enforce invariants around placement state

### Browser Runtime Inside the Main Package

Pros:

- easy to build demos and editors
- one package is enough for common usage

Cons:

- browser concerns live next to headless domain logic
- the package still carries DOM/WebGL lifecycle even after interaction helpers moved out

### Thin Public Helper Layer

Pros:

- easy package onboarding
- small surface area over the core classes

Cons:

- still duplicates some direct `Aggregation` methods conceptually
- can grow into a second API shape if not kept narrow

## Recommended Next Steps

### Short Term

- keep the package on the single aggregation import path only
- add direct lifecycle tests for `Visualizer.dispose()` and resize handling
- avoid reintroducing color or dataset policy into the package

### Medium Term

- decide whether the remaining minimal `Visualizer` should stay here or move to a viewer-specific package/app layer
- separate catalog-part and placed-part concepts more explicitly

### Long Term

- provide generated TypeScript declarations
- either finish or intentionally remove currently stubbed features:
  - `global_constraints`
  - `catalog` deserialization
  - attributes
  - field-based behaviors

## Practical Mental Model

For maintenance, the package can be understood as:

1. `Plane`, `Connection`, `Rule`, `Collider`, `Part`
   - the building blocks
2. `Aggregation`
   - the placement engine and state container
3. `utilities.js`
   - math, transform, collision, and serialization helpers
4. `createAggregationFromData()`
   - the public convenience entry point for reconstruction
5. `Visualizer`
   - browser viewer/runtime
6. `publicApi.js`
   - thin convenience wrappers over the aggregation engine

That is the package’s current architecture and boundary state.
