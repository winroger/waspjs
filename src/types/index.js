/**
 * WaspJS — JSDoc transport and runtime shapes.
 * These comments are editor documentation, not generated TypeScript declarations
 * or a runtime schema validator.
 */
/**
 * @typedef {{x: number, y: number, z: number}} Vector3Like
 */

/**
 * Finite model-coordinate segment endpoints for collider line queries.
 * @typedef {{start: Vector3Like, end: Vector3Like}} SegmentData
 */

/**
 * @typedef {Object} TransformData
 * @property {number} M00
 * @property {number} M01
 * @property {number} M02
 * @property {number} M03
 * @property {number} M10
 * @property {number} M11
 * @property {number} M12
 * @property {number} M13
 * @property {number} M20
 * @property {number} M21
 * @property {number} M22
 * @property {number} M23
 * @property {number} M30
 * @property {number} M31
 * @property {number} M32
 * @property {number} M33
 */

/**
 * Serialized connection frame. X/Y is authoritative when present; alternatively
 * X/Z-only input is accepted. At least one of yaxis and zaxis is required.
 * @typedef {Object} PlaneData
 * @property {number[]} origin
 * @property {number[]} xaxis
 * @property {number[]} [yaxis]
 * @property {number[]} [zaxis]
 */

/**
 * @typedef {Object} ConnectionData
 * @property {PlaneData} plane
 * @property {string} type
 * @property {string} part
 * @property {number|string} id
 */

/**
 * @typedef {Object} RuleData
 * @property {string} part1
 * @property {number} conn1
 * @property {string} part2
 * @property {number} conn2
 * @property {boolean} active
 */

/**
 * Model-coordinate mesh transport, distinct from a runtime Three.js Mesh.
 * @typedef {Object} MeshData
 * @property {number[][]} vertices
 * @property {number[][]} faces Triangle or quad vertex indices.
 */

/**
 * @typedef {Object} ColliderData
 * @property {MeshData[]} geometry Serialized model-space meshes.
 * @property {boolean} multiple Alternative variants rather than a composite obstacle.
 * @property {boolean} check_all Enumerate all free variants when checking parts.
 * @property {ConnectionData[]} connections
 * @property {number[]} valid_connections Free geometry indices, not Connection.id values.
 */

/**
 * A typed GH transport record. Unsupported payloads may be retained statically.
 * @typedef {Object} AttributeValueData
 * @property {string} type
 * @property {unknown} value
 * @property {boolean} valid
 */

/**
 * @typedef {Object} AttributeData
 * @property {'Attribute'} class_type
 * @property {string} name
 * @property {AttributeValueData[]} values
 * @property {boolean} transformable
 */

/**
 * @typedef {Object} SmartAttributeData
 * @property {'SmartAttribute'} class_type
 * @property {string} name
 * @property {AttributeValueData[]} values
 * @property {boolean} transformable
 * @property {ConnectionData[]} connections Stored slot references; frames do not follow placement
 * @property {number[]} conn_mask 1 requires free, -1 blocked, 0 ignores a slot
 */

/**
 * @typedef {Object} PartData
 * @property {'Part'} class_type
 * @property {string} name
 * @property {number|string|null} id
 * @property {MeshData} [geometry]
 * @property {ConnectionData[]} connections
 * @property {number[]} active_connections
 * @property {ColliderData} [collider]
 * @property {TransformData} transform
 * @property {number} dim
 * @property {number|string|null} parent
 * @property {number|string|null} conn_on_parent
 * @property {number|string|null} conn_to_parent
 * @property {Array<number|string>} children
 * @property {unknown} field
 * @property {Array<unknown>} [attributes] Typed attributes or opaque JSON metadata
 */

/**
 * Supported AdvancedPart transport. Additional collider data is already placed;
 * nonempty local-constraint and hierarchy arrays are rejected.
 * @typedef {Omit<PartData, 'class_type'> & {class_type: 'AdvancedPart', add_collider: ColliderData|null, adjacency_const: [], sub_parts: []}} AdvancedPartData
 */

/**
 * @typedef {Object} GraphEdgeData
 * @property {number|string} start
 * @property {number|string} end
 * @property {number} conn_start
 * @property {number} conn_end
 */

/**
 * @typedef {Object} PartCatalogData
 * @property {string[]} parts Part names; distinct from reusable Part definitions
 * @property {number[]} amounts CURRENT remaining counts or weights in JS exports
 * @property {boolean} is_limited Limited counts take precedence over adaptive
 * @property {boolean} is_adaptive Unlimited weights use floating normalization
 */

/**
 * @typedef {Object} AggregationData
 * @property {'Aggregation'} [object_type]
 * @property {string} name
 * @property {Array<PartData|AdvancedPartData>} parts
 * @property {RuleData[]} rules
 * @property {number|null} rnd_seed
 * @property {0|1} [mode]
 * @property {boolean} [coll_check]
 * @property {null} [field]
 * @property {Record<string, Record<string, GraphEdgeData>>} [graph]
 * @property {boolean} [include_aggr_geo]
 * @property {Record<string, PartData|AdvancedPartData>|Array<PartData|AdvancedPartData>} [aggregated_parts]
 * @property {Array<number|string>} [aggregated_parts_sequence]
 * @property {Array<Object>} [global_constraints]
 * @property {PartCatalogData|null} [catalog] Remaining inventory, supported in Mode 0 only
 */

/**
 * @typedef {Object} AggregationFilePartData
 * @property {string} name
 * @property {number[]} active_connections
 * @property {number|string|null} parent
 * @property {Array<number|string>} children
 * @property {TransformData} transform
 * @property {boolean} is_constrained
 */

/**
 * @typedef {Object} AggregationFileData
 * @property {string} aggregation_name
 * @property {Record<string, AggregationFilePartData>} parts
 */

/**
 * Candidate returned by placement queries; not yet registered or charged to stock.
 * @typedef {Object} PlacementOption
 * @property {number|string} parentPartId
 * @property {number} connectionId
 * @property {string} partName
 * @property {number} connectionBId
 * @property {number} ruleIndex Index into the complete connection rules_table
 * @property {import('three').Matrix4} transform
 * @property {import('../core/part.js').Part} transformedPart Independent preview
 */

/**
 * Inspectable runtime references from returnPartData(), not JSON transport.
 * Compatibility limitation: active_connections and is_constrained are omitted.
 * @typedef {Object} RuntimePartData
 * @property {string} name
 * @property {number|string|null} id
 * @property {import('three').Mesh} geo
 * @property {import('../core/connection.js').Connection[]} connections
 * @property {import('three').Matrix4} transform
 * @property {import('../core/collider.js').Collider|null} collider
 * @property {import('three').Vector3} center
 * @property {number|string|null} parent
 * @property {Array<number|string>} children
 * @property {unknown[]} attributes Copied JSON; other object fields are live references
 * @property {import('../core/collider.js').Collider|null} [add_collider] AdvancedPart only
 */

export const types = {};
