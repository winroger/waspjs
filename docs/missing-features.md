# Missing Features vs Original WASP (ext_Wasp-master)

Reference: ext_Wasp-master/src/wasp/core and related modules.

## Major gaps
- **Advanced parts & constraints**: No `AdvancedPart`, adjacency/orientation constraints, supports, or additional colliders. Constraints (`Plane_Constraint`, `Mesh_Constraint`, adjacency) are referenced but not implemented in JS.
- **Fields**: Field-driven aggregation queues and priority logic are missing (original supports single/multiple fields and recompute queues).
- **Aggregation graph**: No graph structure tracking edges/parent-child in a reusable graph object; current JS has minimal parent/child but no graph export/import.
- **Catalogs/limited parts**: Part catalog for counts/limits is absent; removal reinsertion into catalog not handled.
- **Aggregation modes/queues**: Original supports modes with aggregation queues, sorted next states, and guided growth; JS only random placement with capped attempts.
- **Determinism/seed handling**: Seeded RNG is wired in original; JS uses Date.now without consistent seeding and no queue recompute.
- **Global constraints**: Plane and mesh constraints with hard/soft/required flags are not applied during placement in JS.
- **Collision fidelity**: Original uses multiple colliders, validConnections mapping, connection-specific colliders; JS uses first collider/geo and simple BVH intersection with a shrink hack.
- **Serialization completeness**: JS drops aggregated parts on load and omits graph; missing advanced types and constraints in fromData/toData.
- **Rule fidelity**: JS Rule.fromData returns POJOs; no ToString, validation, or grammar utilities beyond basic generation.
- **Attributes**: Part attributes and attribute-based rules are stubs/missing.

## Secondary gaps
- **Geometry utilities**: Plane/yaxis/zaxis mapping and tolerance handling differ; no global tolerance config.
- **Supports & orientation**: No support-line checks or orientation constraints for advanced parts.
- **Adjacency/exclusion**: No directional adjacency constraint checks.
- **Multiple fields**: No handling of multiple named fields and queue recompute.
- **Mesh constraint softness**: Soft vs hard constraint checks not implemented.

## Suggested restoration order
1) **Data model parity**: Implement `AdvancedPart`, constraints, catalog, graph; fix Rule/Part fromData/toData to keep instances and aggregated parts.
2) **Deterministic core**: Seeded RNG, queue-based aggregation modes, graph updates, catalog limits.
3) **Constraints & collisions**: Apply plane/mesh/adjacency constraints during placement; support per-connection colliders and validConnections; configurable tolerance/clearance.
4) **Fields & guidance**: Field influences for queue scoring and recompute.
5) **Rules/attributes**: Validation and attribute-aware rules; grammar parity.
6) **Serialization & load**: Full round-trip including aggregated parts, graph, constraints, catalog.
