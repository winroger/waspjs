/**
 * WaspJS — Part, AdvancedPart and PartCatalog classes.
 * Upstream module: src/wasp/core/parts.py
 */
import { copyMesh, meshAreaCentroid, meshFromData, meshToData, transformFromData, transformToData } from "./utilities";
import { Connection } from "./connection"; 
import { Collider } from "./collider"; 
import * as THREE from 'three';
import { copyAttributes, transformAttributes } from './attributes.js';

function parsePossiblyNumericId(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    if (typeof value === 'number' && !Number.isNaN(value)) {
        return value;
    }

    if (typeof value === 'string') {
        // As GH's int-or-original fallback: do not truncate IDs like "42-beam".
        return /^[+-]?\d+$/.test(value) ? Number(value) : value;
    }

    return value;
}

// Base Part
/**
 * Represents a single placeable part with geometry, connections, and collider.
 */
export class Part {
    /**
     * Assign owners and sequential IDs to the supplied Connection objects,
     * retaining their references as GH Part.__init__ does.
     * @param {string} name
     * @param {THREE.Mesh} geometry
     * @param {Connection[]} connections
     * @param {Collider} collider
     * @param {Array<unknown>} [attributes] JSON values associated with the part
     * @param {number|null} dim
     * @param {number|string|null} id
     * @param {unknown} field
     */
    constructor(name, geometry, connections, collider = null, attributes, dim = 1, id = null , field = null) {
        this.name = name;
        this.id = id;
        this.geo = geometry;
        this.field = field;

        this.connections = [];
        this.active_connections = [];

        let count = 0;
        for (let conn of connections) {
            conn.part = this.name;
            conn.id = count;
            this.active_connections.push(count);
            this.connections.push(conn)
            count++;
        }

        this.transformation = new THREE.Matrix4().identity();

        const { center, dim: computedDim } = computeCenterAndDim(geometry, collider);
        this.center = center;
        this.collider = collider;
        this.dim = dim !== null ? dim : computedDim;

        this.parent = null;
        this.conn_on_parent = null;
        this.conn_to_parent = null;
        this.children = [];

        this.attributes = copyAttributes(attributes);

        this.is_constrained = false;
    }

    // create class from data dictionary
    static fromData(data, base_part = null) {
        if (data.class_type === 'AdvancedPart') return AdvancedPart.fromData(data, base_part);
        let p_name = data['name'];
        let p_transform = data['transform']
            ? transformFromData(data['transform'])
            : new THREE.Matrix4().identity();
        let p_geometry = null;
        if (Object.prototype.hasOwnProperty.call(data, 'geometry')) {
            p_geometry = meshFromData(data['geometry']);
        } else if (base_part !== null) {
            p_geometry = copyMesh(base_part.geo);
            p_geometry.applyMatrix4(p_transform);
        } else {
            return null;
        }
        let p_connections = data['connections'].map(c_data => Connection.fromData(c_data));
        let p_collider = null;
        if (Object.prototype.hasOwnProperty.call(data, 'collider') && data['collider']) {
            p_collider = Collider.fromData(data['collider']);
        } else if (base_part !== null && base_part.collider !== null) {
            p_collider = base_part.collider.transform(p_transform);
        } else {
            p_collider = new Collider([], false, false, [], []);
        }
        // Inline instance attributes already contain placement, including Light.
        // GH-Wasp difference: recover missing legacy attributes from the base.
        let p_attributes = data['attributes'] ?? (base_part
            ? transformAttributes(base_part.attributes, p_transform) : []);
        let p_dim = parseFloat(data['dim']);

        let p_id = parsePossiblyNumericId(data['id']);
        let p_field = data['field'];

        let part = new Part(p_name, p_geometry, p_connections, p_collider,  p_attributes, p_dim, p_id, p_field);
        part.transformation = p_transform;
        part.parent = parsePossiblyNumericId(data['parent']);
        part.conn_on_parent = parsePossiblyNumericId(data['conn_on_parent']);
        part.conn_to_parent = parsePossiblyNumericId(data['conn_to_parent']);
        if (Array.isArray(data['active_connections'])) {
            part.active_connections = data['active_connections'].map(parsePossiblyNumericId);
        }

        for (let child_data of data['children'] || []) {
            part.children.push(parsePossiblyNumericId(child_data));
        }

        return part;
    }

    // return the data dictionary representing the part
    toData(include_geo = true, include_collider = true) {
        const data = {
            'class_type': 'Part',
            'name': this.name,
            'id': this.id,
            'field': this.field,
            'connections': this.connections.map(conn => conn.toData()),
            'active_connections': [...this.active_connections],
            'transform': transformToData(this.transformation),
            'dim': this.dim,
            'parent': this.parent,
            'conn_on_parent': this.conn_on_parent,
            'conn_to_parent': this.conn_to_parent,
            'children': [...this.children]
        };

        data['attributes'] = copyAttributes(this.attributes);

        if (include_geo) {
            data['geometry'] = meshToData(this.geo);
        }
        if (include_collider) {
            data['collider'] = this.collider.toData();
        }

        return data;
    }

    // reset the part and connections according to new provided aggregation rules
    resetPart(rules) {
        let count = 0;
        this.active_connections = [];
        for (let conn of this.connections) {
            conn.generateRulesTable(rules);
            this.active_connections.push(count);
            count++;
        }
    }

    // return a dictionary containing all part data
    returnPartData() {
        return {
            'name': this.name,
            'id': this.id,
            'geo': this.geo,
            'connections': this.connections,
            'transform': this.transformation,
            'collider': this.collider,
            'center': this.center,
            'parent': this.parent,
            'children': this.children,
            'attributes': copyAttributes(this.attributes)
        };
    }

    /**
     * Return a transformed copy without changing the source Part or input matrix.
     * Geometry already contains the previous placement. With column vectors,
     * the stored placement is new transform * previous placement, as in GH-Wasp.
     * @param {THREE.Matrix4} trans Transform to apply after the current placement
     * @param {boolean} [_transform_sub_parts=false] Reserved for base Part compatibility
     * @param {boolean} [maintain_parenting=false] Preserve hierarchy references
     * @returns {Part}
     */
    transform(trans, _transform_sub_parts = false, maintain_parenting = false) {
        let geo_trans = copyMesh(this.geo)
        geo_trans.applyMatrix4(trans);

        let collider_trans = this.collider.transform(trans);

        let connections_trans = []
        for (let conn of this.connections) {
            let conn_trans = conn.transform(trans)
            connections_trans.push(conn_trans)
        }

        let part_trans = new Part(this.name, geo_trans, connections_trans, collider_trans,
            transformAttributes(this.attributes, trans), this.dim, this.id, this.field)
        
        part_trans.transformation.copy(trans).multiply(this.transformation)

        if (maintain_parenting) {
            part_trans.parent = this.parent;
            part_trans.conn_on_parent = this.conn_on_parent;
            part_trans.conn_to_parent = this.conn_to_parent;
            part_trans.children = [...this.children];
        }
        return part_trans
    }

    /**
     * Return a copy with independent mesh buffers, matching GH Mesh.Duplicate.
     * Materials remain shared; attributes and connection frames are copied.
     * @param {boolean} [maintain_parenting=false] Preserve hierarchy references
     * @returns {Part}
     */
    copy(maintain_parenting = false) {
        let geo_copy = copyMesh(this.geo);

        let collider_copy = this.collider.copy();

        let connections_copy = this.connections.map(conn => conn.copy());

        let part_copy = new Part(this.name, geo_copy, connections_copy, collider_copy, this.attributes, this.dim, this.id, this.field);
        part_copy.transformation.copy(this.transformation);

        if (maintain_parenting) {
            part_copy.parent = this.parent;
            part_copy.conn_on_parent = this.conn_on_parent;
            part_copy.conn_to_parent = this.conn_to_parent;
            part_copy.children = [...this.children];
        }

        return part_copy;
    }

    // return transformed center point of the part
    transformCenter(trans) {
        const centerTrans = this.center.clone();
        centerTrans.applyMatrix4(trans);
        return centerTrans;
    }

    // return transformed collider
    transformCollider(trans) {
        return this.collider.transform(trans);
    }

    assignId(id) {
        this.id = id;
    }
}

// ==================== AdvancedPart ====================

/**
 * Part with additional fabrication/free-space colliders, in model coordinates.
 * Compatibility limitation: supports, adjacency/orientation constraints and
 * sub-parts are rejected until their separately tested counterparts exist.
 */
export class AdvancedPart extends Part {
    /**
     * Positional order follows GH AdvancedPart; the inherited JS dim calculation
     * remains in use when dim=null. Connections follow the Part ownership contract.
     * @param {string} name
     * @param {THREE.Mesh} geometry
     * @param {Connection[]} connections
     * @param {Collider} collider
     * @param {Array<unknown>} [attributes=[]]
     * @param {Collider|null} [additionalCollider=null]
     * @param {unknown[]} [supports=[]] Empty only.
     * @param {number|null} [dim=null]
     * @param {number|string|null} [id=null]
     * @param {unknown} [field=null]
     * @param {unknown[]} [subParts=[]] Empty only.
     * @param {unknown[]} [adjacencyConstraints=[]] Empty only.
     * @param {unknown[]} [orientationConstraints=[]] Empty only.
     */
    constructor(name, geometry, connections, collider, attributes = [], additionalCollider = null,
        supports = [], dim = null, id = null, field = null, subParts = [],
        adjacencyConstraints = [], orientationConstraints = []) {
        assertAdvancedCollections({ supports, sub_parts: subParts, adjacency_const: adjacencyConstraints,
            orientation_const: orientationConstraints });
        if (!(collider instanceof Collider)) throw new Error('AdvancedPart requires a primary Collider');
        if (additionalCollider !== null && !(additionalCollider instanceof Collider)) {
            throw new Error('AdvancedPart add_collider must be a Collider or null');
        }
        super(name, geometry, connections, collider, attributes, dim, id, field);
        this.add_collider = additionalCollider;
        this.supports = supports;
        this.adjacency_const = adjacencyConstraints;
        this.orientation_const = orientationConstraints;
        this.sub_parts = subParts;
        this.hierarchy_level = 0;
        this.is_constrained = additionalCollider !== null;
        this._extraData = {};
    }

    /** Validate the implemented subset, including mutable runtime lists. @internal */
    _assertSupported() {
        assertAdvancedCollections(this);
        if (this.add_collider !== null && !(this.add_collider instanceof Collider)) {
            throw new Error('AdvancedPart add_collider must be a Collider or null');
        }
    }

    /**
     * Read inline placed data or recover omitted primary geometry from a base.
     * Explicit additional collider data is already placed and is never moved again.
     * @param {import('../types/index.js').AdvancedPartData} data
     * @param {AdvancedPart|null} [basePart=null]
     * @returns {AdvancedPart|null}
     */
    static fromData(data, basePart = null) {
        assertAdvancedCollections(data);
        if (basePart instanceof AdvancedPart) basePart._assertSupported();
        if (data.class_type !== 'AdvancedPart') throw new Error('Expected AdvancedPart class_type');
        if (!Object.hasOwn(data, 'geometry') && !(basePart instanceof AdvancedPart)) {
            throw new Error('AdvancedPart light import requires an AdvancedPart base');
        }
        if (!data.collider && !basePart) throw new Error('AdvancedPart import requires primary collider data or a base');
        const part = Part.fromData({ ...data, class_type: 'Part' }, basePart);
        if (!part) return null;
        // GH-Wasp difference: like primary geometry, omitted legacy additional
        // geometry can be recovered once from a base. Explicit null clears it.
        const additional = Object.hasOwn(data, 'add_collider')
            ? (data.add_collider === null ? null : Collider.fromData(data.add_collider))
            : (basePart?.add_collider?.transform(part.transformation, true, true) ?? null);
        const result = advancedFromPart(part, additional);
        const known = new Set(['class_type', 'name', 'id', 'geometry', 'field', 'connections',
            'active_connections', 'collider', 'transform', 'dim', 'parent', 'conn_on_parent',
            'conn_to_parent', 'children', 'attributes', 'add_collider', 'supports',
            'sub_parts', 'adjacency_const', 'orientation_const', 'hierarchy_level']);
        result._extraData = globalThis.structuredClone(Object.fromEntries(
            Object.entries(data).filter(([key]) => !known.has(key))));
        return result;
    }

    /**
     * Export the GH discriminator and additional collider even in JS Light data.
     * The two flags retain Part.toData's JS meanings: geometry and primary collider.
     * @param {boolean} [include_geo=true]
     * @param {boolean} [include_collider=true]
     * @returns {import('../types/index.js').AdvancedPartData}
     */
    toData(include_geo = true, include_collider = true) {
        this._assertSupported();
        return { ...globalThis.structuredClone(this._extraData), ...super.toData(include_geo, include_collider),
            class_type: 'AdvancedPart', add_collider: this.add_collider?.toData() ?? null,
            adjacency_const: [], sub_parts: [] };
    }

    /** @returns {Object} Live part data including the additional collider. */
    returnPartData() {
        this._assertSupported();
        return { ...super.returnPartData(), add_collider: this.add_collider };
    }

    /**
     * Move independent Part buffers and additional meshes/connections once.
     * GH parameter order includes sub_level before maintain_parenting.
     * @param {THREE.Matrix4} trans
     * @param {boolean} [transform_sub_parts=false] Hierarchy is not implemented.
     * @param {number} [sub_level=0] Hierarchy is not implemented.
     * @param {boolean} [maintain_parenting=false]
     * @returns {AdvancedPart}
     */
    transform(trans, transform_sub_parts = false, sub_level = 0, maintain_parenting = false) {
        this._assertSupported();
        if (transform_sub_parts || sub_level !== 0) throw new Error('AdvancedPart sub-part transforms are not implemented');
        const result = advancedFromPart(super.transform(trans, false, maintain_parenting),
            this.add_collider?.transform(trans, true, true) ?? null);
        result.is_constrained = true; // GH marks even an otherwise empty transformed AdvancedPart.
        result._extraData = globalThis.structuredClone(this._extraData);
        return result;
    }

    /**
     * Copy all Part and additional collider buffers independently.
     * @param {boolean} [maintain_parenting=false]
     * @returns {AdvancedPart}
     */
    copy(maintain_parenting = false) {
        this._assertSupported();
        const result = advancedFromPart(super.copy(maintain_parenting), this.add_collider?.copy() ?? null);
        result.is_constrained = true;
        result._extraData = globalThis.structuredClone(this._extraData);
        return result;
    }
}

/** JS-specific guard against silently ineffective, not-yet-ported constraints. @internal */
function assertAdvancedCollections(value) {
    for (const key of ['supports', 'sub_parts', 'adjacency_const', 'orientation_const']) {
        if (value[key] !== undefined && (!Array.isArray(value[key]) || value[key].length)) {
            throw new Error(`AdvancedPart ${key} is not implemented; only an empty array is supported`);
        }
    }
    if (value.hierarchy_level != null && value.hierarchy_level !== 0) {
        throw new Error('AdvancedPart hierarchy is not implemented');
    }
}

/** Reuse Part reconstruction/copy/transform without duplicating its geometry logic. @internal */
function advancedFromPart(part, additional) {
    const result = new AdvancedPart(part.name, part.geo, part.connections, part.collider,
        part.attributes, additional, [], part.dim, part.id, part.field);
    result.transformation.copy(part.transformation);
    result.parent = part.parent;
    result.conn_on_parent = part.conn_on_parent;
    result.conn_to_parent = part.conn_to_parent;
    result.children = [...part.children];
    result.active_connections = [...part.active_connections];
    return result;
}

// Use the GH-style surface centroid while retaining the existing size calculation.
function computeCenterAndDim(mesh, collider) {
    const defaultResult = { center: new THREE.Vector3(), dim: 1 };
    if (!mesh || !mesh.geometry) {
        return defaultResult;
    }

    if (typeof mesh.updateMatrix === 'function') {
        mesh.updateMatrix();
    }

    const geom = mesh.geometry;
    if (!geom.boundingBox) {
        geom.computeBoundingBox();
    }
    if (!geom.boundingSphere) {
        geom.computeBoundingSphere();
    }

    const center = meshAreaCentroid(mesh);

    const radius = geom.boundingSphere ? geom.boundingSphere.radius * Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z) : null;
    const boxSize = geom.boundingBox ? geom.boundingBox.getSize(new THREE.Vector3()).length() / 2 : null;
    const dim = radius ?? boxSize ?? (collider && collider.geometry?.length ? collider.geometry.length : defaultResult.dim);

    return { center, dim };
}

// ==================== PartCatalog ====================

/**
 * GH counterpart: src/wasp/core/parts.py::PartCatalog.
 * Named remaining counts (limited) or weights (unlimited). This is independent of
 * the Aggregation.parts dictionary of reusable Part definitions.
 */
export class PartCatalog {
    /**
     * Core defaults match GH's class; its component uses limited=false instead.
     * @param {string[]} parts Unique Part names, in sampling/export order
     * @param {number[]} amounts Nonnegative counts or weights
     * @param {boolean} [isLimited=true]
     * @param {boolean} [isAdaptive=false] Used only when unlimited
     */
    constructor(parts, amounts, isLimited = true, isAdaptive = false) {
        if (!Array.isArray(parts) || !Array.isArray(amounts) || parts.length !== amounts.length
            || parts.some(name => typeof name !== 'string' || name.length === 0)
            || new Set(parts).size !== parts.length) throw new Error('Invalid PartCatalog names or amounts');
        this.parts = [...parts];
        this.amounts = [...amounts];
        this.is_limited = isLimited;
        this.is_adaptive = isAdaptive;
        this.dict = Object.fromEntries(parts.map((name, i) => [name, amounts[i]]));
        this._extraData = {};
        this._refresh();
    }

    /**
     * GH-Wasp difference: preserve fractional weights rather than GH reader int().
     * @param {import('../types/index.js').PartCatalogData} data
     * @returns {PartCatalog}
     */
    static fromData(data) {
        if (typeof data.is_limited !== 'boolean' || typeof data.is_adaptive !== 'boolean') {
            throw new Error('PartCatalog requires boolean is_limited/is_adaptive flags');
        }
        const catalog = new PartCatalog(data.parts, data.amounts, data.is_limited, data.is_adaptive);
        catalog._extraData = globalThis.structuredClone(Object.fromEntries(Object.entries(data)
            .filter(([key]) => !['parts', 'amounts', 'is_limited', 'is_adaptive'].includes(key))));
        return catalog;
    }

    /**
     * GH-Wasp difference: export CURRENT amounts, avoiding GH's stale initial list.
     * Shape is unchanged; readers that cast weights to int can still lose fractions.
     * @returns {import('../types/index.js').PartCatalogData}
     */
    toData() {
        this._validate();
        return { ...globalThis.structuredClone(this._extraData), parts: [...this.parts],
            amounts: this.parts.map(name => this.dict[name]),
            is_limited: this.is_limited, is_adaptive: this.is_adaptive };
    }

    /**
     * Uniform choice among positive entries; GH uses the Python global RNG.
     * JS-specific RNG/filter arguments allow aggregation-local randomness and filters.
     * @param {function():number} [randomFn=Math.random] Draw in [0,1)
     * @param {string[]} [allowedParts=this.parts]
     * @returns {string|null}
     */
    returnRandomPart(randomFn = Math.random, allowedParts = this.parts) {
        const choices = this._choices(allowedParts);
        return choices.length ? choices[Math.floor(catalogDraw(randomFn) * choices.length)] : null;
    }

    /**
     * Weighted choice among positive entries in Part-list order. No stock is debited.
     * JS ordering/RNG sequences are not Python dictionary/MT19937 sequences.
     * @param {function():number} [randomFn=Math.random]
     * @param {string[]} [allowedParts=this.parts] JS active-type restriction
     * @returns {string|null}
     */
    returnWeightedPart(randomFn = Math.random, allowedParts = this.parts) {
        const choices = this._choices(allowedParts);
        if (!choices.length) return null;
        let amount = catalogDraw(randomFn) * choices.reduce((sum, name) => sum + this.dict[name], 0);
        for (const name of choices) {
            if (amount < this.dict[name]) return name;
            amount -= this.dict[name];
        }
        return choices[choices.length - 1]; // Absorb floating arithmetic at the upper boundary.
    }

    /**
     * Update current stock. Limited wins over adaptive, matching GH.
     * Adaptive uses floating normalization, matching GH floating-valued inputs;
     * Python-2 integer-division truncation is deliberately not reproduced.
     * Invalid/negative results and zero adaptive denominators fail before mutation.
     * @param {string} partName
     * @param {number} difference Signed count/weight change
     */
    update(partName, difference) {
        this._validate();
        if (!this.parts.includes(partName) || !Number.isFinite(difference)
            || (this.is_limited && !Number.isSafeInteger(difference))) throw new Error('Invalid PartCatalog update');
        if (!this.is_limited && !this.is_adaptive) return;
        const next = { ...this.dict, [partName]: this.dict[partName] + difference };
        if (!this.is_limited) {
            const total = this.parts.reduce((sum, name) => sum + next[name], 0);
            if (total <= 0) throw new Error('Invalid adaptive catalog denominator');
            for (const name of this.parts) next[name] = next[name] * this.parts_total / total;
        }
        this._validate(next);
        this.dict = next;
        this._refresh();
    }

    /** Current-state copy, as GH; JS also owns the name list and extra JSON. @returns {PartCatalog} */
    copy() {
        return PartCatalog.fromData(this.toData());
    }

    /**
     * JS-specific inventory gate for one Part placement, without consuming stock.
     * Adaptive updates that would produce negative weights or division by zero are unavailable.
     * @param {string} partName
     * @returns {boolean}
     */
    canConsume(partName) {
        this._validate();
        const amount = Object.hasOwn(this.dict, partName) ? this.dict[partName] : 0;
        return amount > 0 && ((!this.is_limited && !this.is_adaptive)
            || (amount >= 1 && (this.is_limited || this.parts_total > 1)));
    }

    /** JS-specific validation of mutable public state; not a GH method. @internal */
    _validate(stock = this.dict) {
        if (typeof this.is_limited !== 'boolean' || typeof this.is_adaptive !== 'boolean'
            || !Array.isArray(this.parts) || new Set(this.parts).size !== this.parts.length
            || this.parts.some(name => typeof name !== 'string' || !name)
            || this.parts.some(name => !Object.hasOwn(stock, name) || !Number.isFinite(stock[name]) || stock[name] < 0
                || (this.is_limited && !Number.isSafeInteger(stock[name])))) throw new Error('Invalid PartCatalog stock or flags');
        const total = this.parts.reduce((sum, name) => sum + stock[name], 0);
        if (!Number.isFinite(total) || (this.is_limited && !Number.isSafeInteger(total))) throw new Error('Invalid PartCatalog total');
    }

    /** JS-specific derived-state refresh; zero stock is empty immediately. @internal */
    _refresh() {
        this._validate();
        this.parts_total = this.parts.reduce((sum, name) => sum + this.dict[name], 0);
        this.is_empty = this.parts_total === 0;
    }

    /** JS-specific conditional sampling; filtering does not change physical stock. @internal */
    _choices(allowedParts) {
        this._refresh();
        return this.parts.filter(name => allowedParts.includes(name) && this.dict[name] > 0);
    }
}

/** JS-specific RNG validation for PartCatalog draws. @internal */
function catalogDraw(randomFn) {
    const value = randomFn();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('Catalog RNG must return a number in [0,1)');
    return value;
}
