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
 * @typedef {Object} ColliderData
 * @property {Array<{vertices: number[][], faces: number[][]}>} geometry Serialized model-space meshes.
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
 * @typedef {Object} PartData
 * @property {'Part'} class_type
 * @property {string} name
 * @property {number|string} id
 * @property {import('three').Mesh} [geometry]
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
 * @typedef {Object} GraphEdgeData
 * @property {number|string} start
 * @property {number|string} end
 * @property {number} conn_start
 * @property {number} conn_end
 */

/**
 * @typedef {Object} AggregationData
 * @property {'Aggregation'} [object_type]
 * @property {string} name
 * @property {PartData[]} parts
 * @property {RuleData[]} rules
 * @property {number|null} rnd_seed
 * @property {0} [mode]
 * @property {boolean} [coll_check]
 * @property {null} [field]
 * @property {Record<string, Record<string, GraphEdgeData>>} [graph]
 * @property {boolean} [include_aggr_geo]
 * @property {Record<string, PartData>|PartData[]} [aggregated_parts]
 * @property {Array<number|string>} [aggregated_parts_sequence]
 * @property {Array<Object>} [global_constraints]
 * @property {null|Object} [catalog]
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

export const types = {};
