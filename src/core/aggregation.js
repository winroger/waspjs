/**
 * WaspJS — aggregation growth, graph state and reconstruction.
 * Upstream module: src/wasp/core/aggregation.py; intentional differences documented below.
 */
import { PlaneToPlane, transformToData, distanceToMesh } from './utilities';
import { Collider } from './collider';
import { Part, AdvancedPart, PartCatalog } from './part';
import { Rule } from './rule';
import { Graph } from './graph.js';

function normalizeList(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'object') return Object.values(value);
    return [];
}

/** JS-specific guard for the measured mode/AdvancedPart subset. @internal */
function supportedMode(mode = 0) {
    const value = Number(mode);
    if (value !== 0 && value !== 1) throw new Error('Only aggregation modes 0 and 1 are implemented');
    return value;
}

/**
 * JS-specific placement helper. GH-Wasp difference: retain JS's Part-geometry
 * fallback for an empty simple collider, without a percentage shrink.
 * Explicit colliders remain authoritative. @internal
 */
function placementCollider(part) {
    return part.collider && (part.collider.geometry.length || part.collider.multiple)
        ? part.collider : new Collider([part.geo]);
}

function normalizeAggregatedParts(value, sequence = []) {
    if (!value) return [];
    if (typeof value !== 'object') throw new Error('Invalid aggregated_parts');
    if (Array.isArray(value)) {
        if (!sequence?.length) return value;
        const keyed = Object.fromEntries(value.map(part => [part.id, part]));
        if (Object.keys(keyed).length !== value.length) throw new Error('Duplicate part IDs');
        return normalizeAggregatedParts(keyed, sequence);
    }
    if (Array.isArray(sequence) && sequence.length > 0) {
        const keys = sequence.map(String);
        if (new Set(keys).size !== keys.length || keys.length !== Object.keys(value).length
            || keys.some(key => !Object.hasOwn(value, key))) {
            throw new Error('Invalid aggregated_parts_sequence: missing or duplicate part');
        }
        return keys.map(key => value[key]);
    }
    return Object.values(value);
}

function restorePart(partData, base_part = null) {
    if (partData['class_type'] === 'Part') {
        return Part.fromData(partData, base_part);
    }
    if (partData.class_type === 'AdvancedPart') return AdvancedPart.fromData(partData, base_part);

    throw new Error(`Unsupported part class_type: ${partData['class_type']}`);
}

function computeNextId(parts) {
    const numericIds = parts
        .map(part => part.id)
        .filter(id => typeof id === 'number' && Number.isFinite(id));

    if (numericIds.length === 0) {
        return parts.length;
    }

    return Math.max(...numericIds) + 1;
}

// GH __init__ builds this sequence graph when importing previous parts.
function sequenceGraph(parts) {
    const graph = new Graph();
    for (const part of parts) {
        graph.addNode(part.id);
        if (part.parent !== null) graph.addEdge(part.parent, part.id, part.conn_on_parent, part.conn_to_parent);
    }
    return graph;
}

// JS-specific import boundary: reject incomplete state instead of losing parts.
function validateState(aggregation) {
    const parts = aggregation.aggregated_parts;
    const byId = new Map();
    for (const part of parts) {
        if (!((typeof part.id === 'number' && Number.isSafeInteger(part.id))
            || (typeof part.id === 'string' && part.id.length > 0)) || byId.has(String(part.id))) {
            throw new Error('Missing, invalid or duplicate part ID');
        }
        byId.set(String(part.id), part);
        if (new Set(part.active_connections).size !== part.active_connections.length
            || part.active_connections.some(i => !Number.isInteger(i) || !part.connections[i])) {
            throw new Error(`Invalid active_connections for ${part.id}`);
        }
    }
    const occupied = new Set();
    const graph = aggregation.graph.graph_dict;
    for (const part of parts) {
        if (!Object.hasOwn(graph, part.id)) throw new Error(`Graph missing part ${part.id}`);
        if (new Set(part.children.map(String)).size !== part.children.length
            || part.children.some(id => byId.get(String(id))?.parent !== part.id)) {
            throw new Error(`Invalid children for ${part.id}`);
        }
        if (part.parent !== null) {
            const parent = byId.get(String(part.parent));
            const edge = graph[part.parent]?.[part.id];
            if (!parent || !parent.children.includes(part.id)
                || !Number.isInteger(part.conn_on_parent) || !parent.connections[part.conn_on_parent]
                || !Number.isInteger(part.conn_to_parent) || !part.connections[part.conn_to_parent]
                || !edge || edge.conn_start !== part.conn_on_parent || edge.conn_end !== part.conn_to_parent) {
                throw new Error(`Invalid parent/connection/graph for ${part.id}`);
            }
            for (const key of [`${part.parent}:${part.conn_on_parent}`, `${part.id}:${part.conn_to_parent}`]) {
                if (occupied.has(key)) throw new Error(`Connection occupied twice: ${key}`);
                occupied.add(key);
            }
        }
    }
    const checked = new Set();
    for (const part of parts) {
        let current = part;
        const path = new Set();
        while (current && !checked.has(current.id)) {
            if (path.has(current.id)) throw new Error('Cyclic part hierarchy');
            path.add(current.id);
            current = current.parent === null ? null : byId.get(String(current.parent));
        }
        for (const id of path) checked.add(id);
    }
    for (const [node, neighbours] of Object.entries(graph)) {
        if (!byId.has(node)) throw new Error(`Graph references unknown part ${node}`);
        for (const edge of Object.values(neighbours)) {
            if (!byId.get(String(edge.end))?.connections[edge.conn_end]
                || !byId.get(String(edge.start))?.connections[edge.conn_start]) {
                throw new Error('Graph references unknown part or connection');
            }
        }
    }
}

/**
 * Manages procedural aggregation of parts using connection rules and collision checks.
 */
export class Aggregation {
    /**
     * @param {string} _name
     * @param {Part[]} _parts
     * @param {Rule[]} _rules
     * @param {number|null} [_rnd_seed=null]
     * @param {0|1} [mode=0] Added after the existing seed argument.
     * @param {PartCatalog|null} [catalog=null] Remaining inventory; Mode 0 only, copied on input
     */
    constructor(_name, _parts, _rules, _rnd_seed = null, mode = 0, catalog = null) {
      this.name = _name;

      this.parts = {};
      _parts.forEach(part => {
          this.parts[part.name] = part;
      });

      this.rules = _rules;
      this.aggregated_parts = [];
      this.graph = new Graph();
      this.mode = supportedMode(mode);
      if (catalog !== null && !(catalog instanceof PartCatalog)) throw new Error('Expected a PartCatalog inventory');
      this.catalog = catalog === null ? null : catalog.copy();
      this._getCatalog();
      this.coll_check = true;
      this.removed_parts = [];
      this._extraData = {};

      // not implemented or used yet
      this.aggregation_queue = [];
      this.queue_values = [];
      this.queue_count = 0;

      // random seed
      this.rnd_seed = _rnd_seed === null ? Date.now() : _rnd_seed;
      this.randomFn = createRng(this.rnd_seed);

      /** @type {Set<string>|null} When non-null, only these part names may be placed randomly. */
      this.activePartTypes = null;

      /** Monotonically increasing counter for unique part IDs. */
      this._nextId = 0;
  }

    /**
     * Reconstruct Full/Light core data, validate placed state and restore the graph.
     * Supports Mode 0 and the additional-collider subset of Mode 1; catalogs require Mode 0.
     * Compact data needs loadAggregation() with external bases/rules. The random cursor
     * is not restored. Nonempty Fields/global constraints and unsupported modes throw.
     * @param {import('../types/index.js').AggregationData} data
     * @returns {Aggregation}
     * @throws {Error} Payload or placed state is invalid or outside the supported subset
     */
    static fromData(data) {
    if (data.aggregation_name !== undefined && data.name === undefined) {
        throw new Error('Compact data requires loadAggregation with external base parts');
    }
    const mode = supportedMode(data.mode ?? 0);
    if (data.field != null && (!Array.isArray(data.field) || data.field.length > 0)) {
        throw new Error('Field deserialization is not implemented');
    }
    if (data.coll_check != null && typeof data.coll_check !== 'boolean') throw new Error('Invalid coll_check');
    const d_name = data['name'];
        const d_parts = normalizeList(data['parts']).map(raw => restorePart(raw));

    const d_rules = normalizeList(data['rules']).map(rule => Rule.fromData(rule));

    const d_rnd_seed = data['rnd_seed'];

    if (data.global_constraints != null && (!Array.isArray(data.global_constraints) || data.global_constraints.length > 0)) {
        throw new Error('Global constraints deserialization is not implemented');
    }
    if (data.catalog != null && mode !== 0) {
        throw new Error('Inventory catalog is not implemented outside aggregation mode 0');
    }
    const catalog = data.catalog == null ? null : PartCatalog.fromData(data.catalog);
    const aggregation = new Aggregation(d_name, d_parts, d_rules, d_rnd_seed, mode, catalog);
    aggregation.coll_check = data.coll_check ?? true;
    const known = new Set(['object_type', 'name', 'parts', 'rules', 'rnd_seed', 'global_constraints',
        'catalog', 'mode', 'coll_check', 'field', 'graph', 'include_aggr_geo',
        'aggregated_parts', 'aggregated_parts_sequence']);
    aggregation._extraData = globalThis.structuredClone(Object.fromEntries(
        Object.entries(data).filter(([key]) => !known.has(key))));
    const aggregatedPartsData = normalizeAggregatedParts(
        data['aggregated_parts'],
        data['aggregated_parts_sequence']
    );

    const d_aggregated_parts = [];
    const d_aggregated_parts_data = [];
    for (const aggr_part_data of aggregatedPartsData) {
        let aggr_part = null;

        if (Object.prototype.hasOwnProperty.call(aggr_part_data, 'geometry')) {
            aggr_part = restorePart(aggr_part_data);
        } else {
            let base_part = null;
            for (const part of d_parts) {
                if (part.name === aggr_part_data['name']) {
                    base_part = part;
                    break;
                }
            }

            if (base_part !== null) {
                aggr_part = restorePart(aggr_part_data, base_part);
            }
        }

        if (aggr_part === null) throw new Error(`Missing base part for ${aggr_part_data.name}`);
        d_aggregated_parts.push(aggr_part);
        d_aggregated_parts_data.push(aggr_part_data);
    }

    aggregation.aggregated_parts = d_aggregated_parts;
    aggregation.aggregated_parts.forEach((part, index) => {
        const serializedActiveConnections = Array.isArray(d_aggregated_parts_data[index].active_connections)
            ? [...part.active_connections] : null;
        part.resetPart(aggregation.rules);
        if (Array.isArray(serializedActiveConnections)) {
            part.active_connections = [...serializedActiveConnections];
        }
    });
    // GH-Wasp difference: preserve occupancy instead of resetting used connections.
    const storedGraph = data.graph;
    if (storedGraph != null && (typeof storedGraph !== 'object' || Array.isArray(storedGraph))) {
        throw new Error('Graph must be an adjacency dictionary');
    }
    aggregation.graph = storedGraph && Object.keys(storedGraph).length
        ? Graph.fromData(storedGraph) : sequenceGraph(aggregation.aggregated_parts);
    validateState(aggregation);
    for (const part of aggregation.aggregated_parts) {
        if (part.parent === null) continue;
        const parent = aggregation.aggregated_parts.find(p => p.id === part.parent);
        parent.active_connections = parent.active_connections.filter(i => i !== part.conn_on_parent);
        part.active_connections = part.active_connections.filter(i => i !== part.conn_to_parent);
    }
    aggregation._nextId = computeNextId(aggregation.aggregated_parts);

    return aggregation;
  }

    /**
     * Serialize Full/Light core state with current catalog amounts and graph.
     * Light omits per-instance display geometry and primary colliders; matching bases
     * remain embedded. Already placed attributes/additional colliders are retained.
     * @param {boolean} [include_aggr_geo=true]
     * @returns {import('../types/index.js').AggregationData}
     */
    toData(include_aggr_geo = true) {
        const mode = supportedMode(this.mode);
        const aggregated_parts = Object.fromEntries(this.aggregated_parts.map(part =>
            [String(part.id), part.toData(include_aggr_geo, include_aggr_geo)]));
        const aggregated_parts_sequence = this.aggregated_parts.map(part => part.id);

        return {
            ...globalThis.structuredClone(this._extraData),
            object_type: 'Aggregation',
            name: this.name,
            parts: Object.values(this.parts).map(part => part.toData()),
            rules: this.rules.map(rule => rule.toData()),
            rnd_seed: this.rnd_seed,
            global_constraints: [],
            catalog: this._getCatalog()?.toData() ?? null,
            mode,
            coll_check: this.coll_check,
            field: null,
            // Legacy callers can supply placed parts directly; recover their graph
            // for export without mutating the aggregation during serialization.
            graph: (this.graph.getNodes().length ? this.graph : sequenceGraph(this.aggregated_parts)).toData(),
            include_aggr_geo,
            aggregated_parts,
            aggregated_parts_sequence
        };
    }

    /**
     * Serialize compact placed state requiring external base Parts and rules.
     * No graph, instance attributes, inventory or random cursor is carried in this format.
     * The compact loader accepts only unconstrained plain Parts with positive rigid transforms.
     * @returns {import('../types/index.js').AggregationFileData}
     * @throws {Error} An attached inventory catalog would be lost
     */
    toFileData() {
        if (this._getCatalog()) throw new Error('Compact format cannot preserve inventory catalog; use full/light core data');
        const parts = Object.fromEntries(this.aggregated_parts.map(part => [String(part.id), {
            name: part.name,
            active_connections: [...part.active_connections],
            parent: part.parent,
            children: [...part.children],
            transform: transformToData(part.transformation),
            is_constrained: part.is_constrained,
        }]));

        return {
            aggregation_name: this.name,
            parts
        };
    }

    /**
     * Return the live placed-Parts array, not base definitions or a snapshot.
     * @returns {Part[]}
     */
    getParts() {
        return this.aggregated_parts
    }

    /**
     * Return reusable base definitions in object-value order, distinct from placed Parts
     * and PartCatalog inventory. The array is new; its Part objects are live references.
     * JS-specific query: GH components read aggregation.parts.values() directly.
     * @returns {Part[]}
     */
    getBaseParts() {
        return Object.values(this.parts);
    }

    /**
     * Adjust toward a target count and update the supplied viewer after each edit.
     * A viewer is required when an edit succeeds. Growth can stop below the target;
     * inspect getParts().length for the actual count. This method resolves without a result.
     * @param {number} newCount Requested total number of placed Parts
     * @param {{addEntity: function(Part): void, removeEntity: function(Part): void}} waspVisualization
     * @returns {Promise<void>}
     */
    async modifyParts(newCount, waspVisualization) {
    let isCount = this.getParts().length;
    const difference = newCount - isCount;

    if (difference > 0) {
        for (let i = 0; i < difference; i++) {
            let added = this.addPartToAggregation();
            if (!added) {
                return;
            }
            const newPart = this.getParts()[this.getParts().length - 1];
            waspVisualization.addEntity(newPart);
            isCount++;
        }
    } else if (difference < 0) {
        for (let i = difference; i < 0; i++) {
            isCount--;
            let partToRemove = this.getParts()[isCount];
            waspVisualization.removeEntity(partToRemove);
            this.removePartFromAggregation(partToRemove.id);
        }
    }
  }

/**
 * JS-specific invariant: an attached catalog always governs placement, including
 * manual calls and previews. GH's random method uses a separate use_catalog flag.
 * Catalog state is remaining inventory; importing placed parts does not debit it again.
 * @internal
 * @returns {PartCatalog|null}
 */
_getCatalog() {
    if (this.catalog == null) return null;
    if (!(this.catalog instanceof PartCatalog)) throw new Error('Expected a PartCatalog inventory');
    if (this.mode !== 0) throw new Error('Inventory catalog is not implemented outside aggregation mode 0');
    if (this.catalog.parts.some(name => !Object.hasOwn(this.parts, name))) throw new Error('Unknown inventory Part name');
    return this.catalog;
}

/** JS-specific nonmutating inventory gate shared by previews and placements. @internal */
_catalogAllows(name) {
    return this._getCatalog()?.canConsume(name) ?? true;
}

/**
 * Try to add num Parts; an attached inventory catalog always governs placement.
 * GH counterpart: aggregate_rnd(num, use_catalog=True) when a catalog is present.
 * @param {number} num Number to add, not a target total
 * @returns {true|string} True on success; a message if growth stops short
 */
aggregate_rnd(num) {
    let added = 0;
    let loops = 0;
    while (added < num) {
            loops += 1;
            if (loops > num * 100) {
                    return `Could not place ${num - added} parts`;
            }

            if (this.aggregated_parts.length === 0) {
            if (this.addFirstPartToAggregation()) {
                            added += 1;
                    } else if (this._getCatalog()) {
                            return `Could not place ${num - added} parts`;
                    }
            } else {
                    if (this.addPartToAggregation()) {
                            added += 1;
                    } else {
                            return `Could not place ${num - added} parts`;
                    }
            }
    }

    return true;
}

/**
 * GH counterpart: aggregation.py::check_blocked_connections, standard geometry path.
 * Despite the upstream name, returns FREE connection indices. Compare each placed
 * connection origin with other Parts' display-mesh surfaces using strict distance
 * < tolerance. Collider, mode, active_connections and graph do not define this query.
 * Same-ID Parts are skipped, matching GH. Model units, no up-axis conversion.
 * Compatibility limitation: connections_only/custom_graph variants are not ported.
 * @param {Part} part Placed Part with the same ID convention as this aggregation
 * @param {boolean} [connectionsOnly=false] Reserved GH variant; true is rejected
 * @param {Graph|null} [customGraph=null] Reserved GH variant; non-null is rejected
 * @param {number} [tolerance=0.002] Model units; pinned GH global default
 * @returns {number[]} Free indices into part.connections, not Connection.id values
 */
checkBlockedConnections(part, connectionsOnly = false, customGraph = null, tolerance = 0.002) {
    if (connectionsOnly !== false || customGraph !== null) {
        throw new Error('Only the standard geometric blocked-connection query is implemented');
    }
    if (!Number.isFinite(tolerance) || tolerance < 0) throw new Error('Invalid connection tolerance');
    const others = this.aggregated_parts.filter(other => other.id !== part.id);
    return part.connections.flatMap((connection, index) => {
        const origin = connection.pln.origin;
        if (!origin.toArray().every(Number.isFinite)) throw new Error('Invalid connection origin');
        return others.some(other => distanceToMesh(origin, other.geo) < tolerance) ? [] : [index];
    });
}

/**
 * Append a randomly chosen seed Part, applying active type and inventory filters.
 * The seed bypasses collision checks. Consumes stock only when a Part is appended.
 * @returns {boolean} Whether a Part was added
 */
addFirstPartToAggregation() {
    supportedMode(this.mode);
    const catalog = this._getCatalog();
    const partKeys = this.activePartTypes
        ? Object.keys(this.parts).filter(k => this.activePartTypes.has(k))
        : Object.keys(this.parts);
    const eligible = catalog ? partKeys.filter(name => catalog.canConsume(name)) : partKeys;
    if (eligible.length === 0) return false;
    const name = catalog ? catalog.returnWeightedPart(this.randomFn, eligible) : randomChoice(this.randomFn, eligible);
    let first_part = this.parts[name];
    if (first_part !== null) {
            let first_part_trans = first_part.copy()
            first_part_trans.connections.forEach(conn => {
                    conn.generateRulesTable(this.rules);
            });

            catalog?.update(first_part_trans.name, -1);
            first_part_trans.id = this._nextId++;
            this.aggregated_parts.push(first_part_trans);
            this.graph.addNode(first_part_trans.id);
            return true;
    }
    return false;
}


/**
 * Try one random placement, or seed an empty aggregation.
 * Updates parenting, occupancy, graph and inventory on success; may stop without
 * placing when available rules, geometry or stock block progress.
 * @returns {boolean} Whether a Part was added
 */
addPartToAggregation() {
    supportedMode(this.mode);
    const catalog = this._getCatalog();
    const eligible = catalog ? catalog.parts.filter(name => catalog.canConsume(name)
        && (!this.activePartTypes || this.activePartTypes.has(name))) : null;
    if (catalog && eligible.length === 0) return false;

    if (this.aggregated_parts.length === 0) {
        return this.addFirstPartToAggregation();
    } else {
        let next_rule = null;
        let part_01 = null;
        let conn_01_id = -1;
        let next_rule_id = -1;
        let new_rule_attempts = 0;

        while (new_rule_attempts < 1000) { // ORIGINAL: 10000
            new_rule_attempts += 1;
            next_rule = null;
            const selectedName = catalog?.returnWeightedPart(this.randomFn, eligible);

            const part_01_idx = randomInt(this.randomFn, 0, this.aggregated_parts.length - 1);
            part_01 = this.aggregated_parts[part_01_idx];
            if (part_01.active_connections.length > 0) {
                conn_01_id = randomChoice(this.randomFn, part_01.active_connections);
                let conn_01 = part_01.connections[conn_01_id];
                if (conn_01.active_rules.length > 0) {
                    next_rule_id = randomChoice(this.randomFn, conn_01.active_rules);
                    next_rule = conn_01.rules_table[next_rule_id];
                }
            }

            if (next_rule !== null) {
                if (catalog && next_rule.partB !== selectedName) continue;
                // Skip if part type is not in the active set
                if (this.activePartTypes && !this.activePartTypes.has(next_rule.partB)) {
                    continue;
                }

                let next_part = this.parts[next_rule.partB];

                if (!next_part) {
                    console.error(`Part B with id ${next_rule.partB} not found in parts.`);
                    return false;
                }

                // NEW PART
                let startingPlane = next_part.connections[next_rule.connectionB].flip_pln;
                if (!startingPlane) {
                    console.error(`Starting plane not found for connection B with id ${next_rule.connectionB}.`);
                    return false;
                }

                // EXISTING PART
                let targetPlane = part_01.connections[conn_01_id].pln;
                if (!targetPlane) {
                    console.error(`Target plane not found for connection 01 with id ${conn_01_id}.`);
                    return false;
                }

                // CALC TRANSFORM
                let orientTransform = PlaneToPlane(startingPlane, targetPlane);
                if (!orientTransform) {
                    console.error(`Failed to calculate orientation transform.`);
                    return false;
                }

                // PERFORM TRANSFORM ON PART
                let next_part_trans = next_part.transform(orientTransform);
                if (!next_part_trans) {
                    console.error(`Failed to transform part.`);
                    return false;
                }

                if (this._checkCollision(next_part_trans)) {
                    continue; // Restart the loop if a collision is detected
                }

                // REST OF STUFF
                next_part_trans.resetPart(this.rules);
                next_part_trans.active_connections = next_part_trans.active_connections.filter(conn => conn !== next_rule.connectionB);
                catalog?.update(next_part_trans.name, -1);
                next_part_trans.id = this._nextId++;

                // parent-child tracking
                part_01.children.push(next_part_trans.id);
                next_part_trans.parent = part_01.id;
                next_part_trans.conn_on_parent = next_rule.connectionA;
                next_part_trans.conn_to_parent = next_rule.connectionB;

                // add part to aggregated_parts list
                this.aggregated_parts.push(next_part_trans);
                this.graph.addNode(next_part_trans.id);
                this.graph.addEdge(part_01.id, next_part_trans.id, conn_01_id, next_rule.connectionB);

                // remove connection from parent part's active connections
                part_01.active_connections = part_01.active_connections.filter(conn => conn !== conn_01_id);

                return true;
            }
        }

        console.error(`No valid rule found after ${new_rule_attempts} attempts.`);
        return false;
    }
}

/**
 * Remove a part and its dependent descendants, retaining unrelated branches.
 * GH-Wasp difference: GH remove_elements trims a sequence and resets every part;
 * this JS ID-based operation cleans parenting without reopening occupied slots.
 * @param {number|string} part_id
 * @returns {boolean} Whether the requested part existed. removed_parts lists results.
 */
removePartFromAggregation(part_id) {
    const catalog = this._getCatalog();
    const partToRemove = this.aggregated_parts.find(part => part.id === part_id);
    if (!partToRemove) return false;
    const removed = new Set([part_id]);
    // Follow parent links rather than trusting caller-maintained children arrays.
    let size;
    do {
        size = removed.size;
        for (const part of this.aggregated_parts) if (removed.has(part.parent)) removed.add(part.id);
    } while (size !== removed.size);
    const removedParts = this.aggregated_parts.filter(part => removed.has(part.id));
    // Validate all refunds before editing the model. Pre-existing imported Part
    // types outside the inventory are not counted/refunded; no history is inferred.
    const refunded = catalog?.copy();
    for (const part of removedParts) {
        if (refunded?.parts.includes(part.name)) refunded.update(part.name, 1);
    }
    this.removed_parts = removedParts;
    for (const part of this.removed_parts) {
        const parent = this.aggregated_parts.find(p => p.id === part.parent && !removed.has(p.id));
        if (parent) {
            parent.children = parent.children.filter(id => !removed.has(id));
            if (!parent.active_connections.includes(part.conn_on_parent)) parent.active_connections.push(part.conn_on_parent);
        }
        this.graph.removeNode(part.id);
    }
    for (let i = this.aggregated_parts.length - 1; i >= 0; i--) {
        if (removed.has(this.aggregated_parts[i].id)) this.aggregated_parts.splice(i, 1);
    }
    if (catalog) {
        catalog.dict = refunded.dict;
        catalog.parts_total = refunded.parts_total;
        catalog.is_empty = refunded.is_empty;
    }
    return true;
}

/**
 * Check an already placed candidate's primary collider and mode-1 additional
 * collider. Successful variant state belongs to this candidate only.
 * @param {Part} partTrans
 * @returns {boolean}
 */
_checkCollision(partTrans) {
    const mode = supportedMode(this.mode);
    if (partTrans instanceof AdvancedPart) partTrans._assertSupported();
    for (const existing of this.aggregated_parts) {
        if (existing instanceof AdvancedPart) existing._assertSupported();
    }
    // GH-Wasp difference: retain JS's surface-only placement contract, without
    // GH's additional center-overlap gate. coll_check=false bypasses primary
    // surface checks; mode-1 additional colliders are independent, as in GH.
    // Test every existing collider: JS dim is derived from display geometry and
    // is not a safe radius for off-center or larger explicit collider meshes.
    if (this.coll_check) {
        const parts = this.aggregated_parts.map(part => ({ collider: placementCollider(part) }));
        if (placementCollider(partTrans).checkCollisionsById(parts, parts.map((_, i) => i))) return true;
    }
    if (mode === 1 && partTrans instanceof AdvancedPart && partTrans.add_collider) {
        // GH aggregation.py::additional_collider_check. The candidate is already
        // placed. Share read-only meshes in a fresh probe, resetting valid state.
        const add = partTrans.add_collider;
        const probe = new Collider(add.geometry, add.multiple, add.checkAll, add.connections, []);
        if (probe.checkCollisionsWithParts(this.aggregated_parts)) return true;
        // GH-Wasp difference: update this candidate only, not its catalog base.
        add.validConnections = [...probe.validConnections];
    }
    return false;
}

/**
 * Place the first part in the aggregation by name (for manual mode).
 * @param {string} partName
 * @returns {{ success: boolean, part?: Part, error?: string }}
 */
placeFirstPart(partName) {
    supportedMode(this.mode);
    const inventory = this._getCatalog();
    if (this.aggregated_parts.length > 0) {
        return { success: false, error: 'Aggregation is not empty' };
    }
    const catalogPart = this.parts[partName];
    if (!catalogPart) {
        return { success: false, error: `Part "${partName}" not found in catalog` };
    }
    if (!this._catalogAllows(partName)) return { success: false, error: 'Part unavailable in inventory catalog' };
    const partCopy = catalogPart.copy();
    partCopy.connections.forEach(conn => conn.generateRulesTable(this.rules));
    inventory?.update(partName, -1);
    partCopy.id = this._nextId++;
    this.aggregated_parts.push(partCopy);
    this.graph.addNode(partCopy.id);
    return { success: true, part: partCopy };
}

/**
 * Place a specific part at a specific connection (deterministic, for manual mode).
 * Selects usable rules through active_rules, as GH aggregate_rnd does.
 * @param {number|string} parentPartId
 * @param {number} connectionId
 * @param {string} partName
 * @param {number} connectionBId
 * @returns {{ success: boolean, part?: Part, error?: string }}
 */
placePartAtConnection(parentPartId, connectionId, partName, connectionBId) {
    const inventory = this._getCatalog();
    const parentPart = this.aggregated_parts.find(p => p.id === parentPartId);
    if (!parentPart) return { success: false, error: 'Parent part not found' };
    if (!parentPart.active_connections.includes(connectionId)) {
        return { success: false, error: 'Connection is not active on parent' };
    }

    const conn = parentPart.connections[connectionId];
    const catalogPart = this.parts[partName];
    if (!catalogPart) return { success: false, error: `Part "${partName}" not found in catalog` };
    if (!this._catalogAllows(partName)) return { success: false, error: 'Part unavailable in inventory catalog' };

    const rule = conn.active_rules.map(i => conn.rules_table[i]).find(
        r => r && r.partB === partName && r.connectionB === connectionBId
    );
    if (!rule) return { success: false, error: 'No matching rule for this placement' };

    const startingPlane = catalogPart.connections[connectionBId].flip_pln;
    const targetPlane = parentPart.connections[connectionId].pln;
    const orientTransform = PlaneToPlane(startingPlane, targetPlane);
    if (!orientTransform) return { success: false, error: 'Transform computation failed' };

    const partTrans = catalogPart.transform(orientTransform);
    if (!partTrans) return { success: false, error: 'Part transform failed' };

    if (this._checkCollision(partTrans)) {
        return { success: false, error: 'Collision detected' };
    }

    partTrans.resetPart(this.rules);
    partTrans.active_connections = partTrans.active_connections.filter(c => c !== connectionBId);
    inventory?.update(partName, -1);
    partTrans.id = this._nextId++;

    parentPart.children.push(partTrans.id);
    partTrans.parent = parentPart.id;
    partTrans.conn_on_parent = connectionId;
    partTrans.conn_to_parent = connectionBId;

    this.aggregated_parts.push(partTrans);
    this.graph.addNode(partTrans.id);
    this.graph.addEdge(parentPart.id, partTrans.id, connectionId, connectionBId);
    parentPart.active_connections = parentPart.active_connections.filter(c => c !== connectionId);

    return { success: true, part: partTrans };
}

/**
 * Return all open (unused) connections across aggregated parts.
 * Each rules array contains usable entries selected by active_rules. Arrays are new;
 * Plane and Rule objects remain live references. Does not prune connection state.
 * @returns {Array<{partId: number|string, connectionId: number, plane: import('./plane.js').Plane, type: string, rules: Array}>}
 */
getOpenConnections() {
    return collectOpenConnections(this.aggregated_parts);
}

/**
 * Inspect active connection slots on one placed Part using exact ID matching.
 * JS-specific query: GH reads these fields directly, without this result shape.
 * Rules are selected by active_rules, as in getOpenConnections(). Result and rules
 * arrays are new; Plane and Rule objects remain live references. Does not prune slots.
 * @param {number|string} parentPartId
 * @returns {Array<{partId: number|string, connectionId: number, plane: import('./plane.js').Plane, type: string, rules: Array}>}
 */
getOpenConnectionsForPart(parentPartId) {
    const part = this.aggregated_parts.find(part => part.id === parentPartId);
    return collectOpenConnections(part ? [part] : []);
}

/**
 * Compute all valid placements for a given part type.
 * Returns positions where the part can be placed without collision.
 * Uses active_rules indices; ruleIndex refers to the complete rules_table.
 * @param {string} partName
 * @returns {Array<{parentPartId: number|string, connectionId: number, partName: string, connectionBId: number, ruleIndex: number, transform: import('three').Matrix4, transformedPart: Part}>}
 */
getValidPlacementsForPart(partName) {
    return collectValidPlacements(this, partName, this.aggregated_parts);
}

/**
 * Compute valid placements for a given part type, scoped to a single parent part.
 * Limits the search to that parent's connection slots.
 * @param {string} partName
 * @param {number|string} parentPartId
 * @returns {Array<{parentPartId: number|string, connectionId: number, partName: string, connectionBId: number, ruleIndex: number, transform: import('three').Matrix4, transformedPart: Part}>}
 */
getValidPlacementsAtParent(partName, parentPartId) {
    const parent = this.aggregated_parts.find(part => part.id === parentPartId);
    return collectValidPlacements(this, partName, parent ? [parent] : []);
}

/**
 * Compute valid placements for a given part type at a single connection.
 * Only checks rules for one connection slot.
 * @param {string} partName
 * @param {number|string} parentPartId
 * @param {number} connectionId
 * @returns {Array<{parentPartId: number|string, connectionId: number, partName: string, connectionBId: number, ruleIndex: number, transform: import('three').Matrix4, transformedPart: Part}>}
 */
getValidPlacementsAtConnection(partName, parentPartId, connectionId) {
    const parent = this.aggregated_parts.find(part => part.id === parentPartId);
    if (!parent || !parent.active_connections.includes(connectionId) || !parent.connections[connectionId]) return [];
    return collectValidPlacements(this, partName, [parent], [connectionId]);
}

/**
 * Set which part types are allowed for random aggregation.
 * Pass null or undefined to allow all parts.
 * @param {string[]|null} partNames
 * @returns {void}
 */
setActivePartTypes(partNames) {
    this.activePartTypes = partNames ? new Set(partNames) : null;
}
}


// ==================== Legacy package helpers ====================

/**
 * @deprecated Use Aggregation.fromData(data).
 * JS-specific helper: create an `Aggregation` instance from serialized data.
 * @param {import('../types/index.js').AggregationData} data
 * @returns {Aggregation}
 */
export function createAggregationFromData(data) {
  return Aggregation.fromData(data);
}

/**
 * @deprecated Use aggregation.getBaseParts().
 * JS-specific helper: return catalog/base parts from an aggregation.
 * @param {Aggregation} aggregation
 * @returns {import('../core/part.js').Part[]}
 */
export function getAggregationCatalogParts(aggregation) {
  return aggregation ? aggregation.getBaseParts() : [];
}

/**
 * @deprecated Use aggregation.getValidPlacementsAtParent(partName, parentPartId).
 * JS-specific helper: compute valid placements scoped to a single parent part.
 * Limits the search to that parent; no aggregation-wide scan of connection slots.
 * @param {Aggregation} aggregation
 * @param {string} partName
 * @param {number|string} parentPartId
 * @returns {Array<{parentPartId: number|string, connectionId: number, partName: string, connectionBId: number, ruleIndex: number, transform: import('three').Matrix4, transformedPart: import('../core/part.js').Part}>}
 */
export function getValidPlacementsAtParent(aggregation, partName, parentPartId) {
  if (!aggregation) return [];
  return aggregation.getValidPlacementsAtParent(partName, parentPartId);
}

/**
 * @deprecated Use aggregation.getValidPlacementsAtConnection(partName, parentPartId, connectionId).
 * JS-specific helper: compute valid placements at a single connection slot.
 * Evaluates rules for one connection.
 * @param {Aggregation} aggregation
 * @param {string} partName
 * @param {number|string} parentPartId
 * @param {number} connectionId
 * @returns {Array<{parentPartId: number|string, connectionId: number, partName: string, connectionBId: number, ruleIndex: number, transform: import('three').Matrix4, transformedPart: import('../core/part.js').Part}>}
 */
export function getValidPlacementsAtConnection(aggregation, partName, parentPartId, connectionId) {
  if (!aggregation) return [];
  return aggregation.getValidPlacementsAtConnection(partName, parentPartId, connectionId);
}

/**
 * @deprecated Use aggregation.getOpenConnectionsForPart(parentPartId).
 * JS-specific compatibility helper: inspect active slots and active rules on one Part.
 * Uses the same core query as Aggregation.getOpenConnections().
 * @param {Aggregation} aggregation
 * @param {number|string} parentPartId
 * @returns {Array<{partId: number|string, connectionId: number, plane: object, type: string, rules: Array}>}
 */
export function getOpenConnectionsForPart(aggregation, parentPartId) {
  return aggregation ? aggregation.getOpenConnectionsForPart(parentPartId) : [];
}

/**
 * @deprecated Use aggregation.setActivePartTypes(partNames).
 * JS-specific helper: set which part types are allowed for random aggregation.
 * Pass null to allow all parts.
 * @param {Aggregation} aggregation
 * @param {string[]|null} partNames
 * @returns {void}
 */
export function setActivePartTypes(aggregation, partNames) {
  if (!aggregation) return;
  aggregation.setActivePartTypes(partNames);
}

// Helper functions
/**
 * Project connection state without mutating it. Shared by global and scoped queries.
 * JS-specific inspection adapter; active_rules, not Rule.active, selects entries.
 * @internal
 * @param {Part[]} parts Placed Parts in query order
 * @returns {Array<{partId: number|string, connectionId: number, plane: import('./plane.js').Plane, type: string, rules: Array}>}
 */
function collectOpenConnections(parts) {
    const connections = [];
    for (const part of parts) {
        for (const connectionId of part.active_connections) {
            const connection = part.connections[connectionId];
            connections.push({
                partId: part.id,
                connectionId,
                plane: connection.pln,
                type: connection.type,
                rules: connection.active_rules.map(index => connection.rules_table[index]).filter(Boolean),
            });
        }
    }
    return connections;
}

/**
 * Enumerate candidates only in the supplied scope, preserving parent/slot/rule order.
 * Partial GH-Wasp core counterpart: Aggregation.compute_possible_children; JS also
 * filters a requested base Part and reports placement metadata. Existing supported
 * collision/inventory checks remain delegated to the Aggregation instance.
 * @internal
 * @param {Aggregation} aggregation
 * @param {string} partName
 * @param {Part[]} parents Placed Parts to inspect
 * @param {number[]} [connectionIds] Selected slots; omitted means each parent's active slots
 * @returns {Array<{parentPartId: number|string, connectionId: number, partName: string, connectionBId: number, ruleIndex: number, transform: import('three').Matrix4, transformedPart: Part}>}
 */
function collectValidPlacements(aggregation, partName, parents, connectionIds) {
    const basePart = aggregation.parts[partName];
    if (!basePart || !aggregation._catalogAllows(partName)) return [];
    const placements = [];
    for (const parent of parents) {
        for (const connectionId of connectionIds ?? parent.active_connections) {
            const connection = parent.connections[connectionId];
            for (const ruleIndex of connection.active_rules) {
                const rule = connection.rules_table[ruleIndex];
                if (!rule || rule.partB !== partName) continue;
                const startingPlane = basePart.connections[rule.connectionB]?.flip_pln;
                if (!startingPlane) continue;
                const transform = PlaneToPlane(startingPlane, connection.pln);
                if (!transform) continue;
                const transformedPart = basePart.transform(transform);
                if (!transformedPart) continue;
                if (!aggregation._checkCollision(transformedPart)) {
                    placements.push({
                        parentPartId: parent.id,
                        connectionId,
                        partName,
                        connectionBId: rule.connectionB,
                        ruleIndex,
                        transform,
                        transformedPart,
                    });
                }
            }
        }
    }
    return placements;
}

function randomChoice(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
}

function randomInt(rng, min, max) {
    return Math.floor(rng() * (max - min + 1)) + min;
}

function createRng(seed) {
    const normalizedSeed = (seed ?? Date.now()) >>> 0;
    return mulberry32(normalizedSeed);
}

function mulberry32(a) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
