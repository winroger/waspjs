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
 * @typedef {Object} PlaneData
 * @property {number[]} origin
 * @property {number[]} xaxis
 * @property {number[]} yaxis
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
 * @property {Array<import('three').Mesh>} geometry
 * @property {boolean} multiple
 * @property {boolean} check_all
 * @property {ConnectionData[]} connections
 * @property {number[]} valid_connections
 */

/**
 * @typedef {Object} PartData
 * @property {'Part'} class_type
 * @property {string} name
 * @property {number|string} id
 * @property {import('three').Mesh} geometry
 * @property {ConnectionData[]} connections
 * @property {number[]} active_connections
 * @property {ColliderData} collider
 * @property {TransformData} transform
 * @property {number} dim
 * @property {number|string|null} parent
 * @property {number|string|null} conn_on_parent
 * @property {number|string|null} conn_to_parent
 * @property {Array<number|string>} children
 * @property {unknown} field
 */

/**
 * @typedef {Object} AggregationData
 * @property {string} name
 * @property {PartData[]} parts
 * @property {RuleData[]} rules
 * @property {number|null} rnd_seed
 * @property {Array<Object>} [global_constraints]
 * @property {Object} [catalog]
 */

export const types = {};