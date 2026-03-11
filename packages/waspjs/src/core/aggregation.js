import { newPlaneToPlane, checkMeshesIntersection } from './utilities';
import { Part } from './part';
import { Rule } from './rule';

const colorMap = {
    "0": 0xF5F5DC,  // Beige
    "1": 0xDEB887,  // Burlywood
    "2": 0xD2B48C,  // Tan
    "3": 0xF5DEB3,  // Wheat
    "4": 0xFFE4C4,  // Bisque
};

/**
 * Manages procedural aggregation of parts using connection rules and collision checks.
 */
export class Aggregation {
    /**
     * @param {string} _name
     * @param {Part[]} _parts
     * @param {Rule[]} _rules
     * @param {number|null} _rnd_seed
     */
    constructor(_name, _parts, _rules, _rnd_seed = null) {
      this.name = _name;

      this.parts = {};
      _parts.forEach(part => {
          this.parts[part.name] = part;
      });

      this.rules = _rules;
      this.aggregated_parts = [];

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
     * Deserialize an aggregation from JSON-friendly data.
     */
    static fromData(data) {
    const d_name = data['name'];

    const normalizeList = value => {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        if (typeof value === 'object') return Object.values(value);
        return [];
    };

        const d_parts = normalizeList(data['parts']).map((part_data, idx) => {
            if (part_data['class_type'] === 'Part') {
                const newPart = Part.fromData(part_data);
                newPart.geo.material.color.setHex(colorMap[idx % 10] || colorMap[0]);
                return newPart;
            }
            throw new Error(`Unsupported part class_type: ${part_data['class_type']}`);
    });

    const d_rules = normalizeList(data['rules']).map(rule => Rule.fromData(rule));

    const d_rnd_seed = data['rnd_seed'];

    if (data['global_constraints'] && data['global_constraints'].length > 0) {
        throw new Error('Global constraints deserialization is not implemented');
    }
    if (data['catalog']) {
        throw new Error('Part catalog deserialization is not implemented');
    }

    const aggregation = new Aggregation(d_name, d_parts, d_rules, d_rnd_seed);

    // THIS CAN BE FIXED IN ORDER TO LOAD AGGREGATIONS FROM THE FILE AS INITAL STATE, NEEDS TO ADD
    // THE PARTS TO THE SCENE
    aggregation.aggregated_parts = [];
    //aggregation.graph = Graph.fromData(data['graph']);

    //aggregation.reset_rules(aggregation.rules);
    /*if (aggregation.field) {
      aggregation.recompute_aggregation_queue();
    }*/

    return aggregation;
  }

    getParts() {
        return this.aggregated_parts
    }

    /**
     * Adjust aggregation size to match target count, mutating the visualizer when provided.
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
     * Randomly grow the aggregation by the requested number of parts.
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

addFirstPartToAggregation() {
    const partKeys = this.activePartTypes
        ? Object.keys(this.parts).filter(k => this.activePartTypes.has(k))
        : Object.keys(this.parts);
    if (partKeys.length === 0) return false;
    let first_part = this.parts[randomChoice(this.randomFn, partKeys)];
    if (first_part !== null) {
            let first_part_trans = first_part.copy()
            first_part_trans.connections.forEach(conn => {
                    conn.generateRulesTable(this.rules);
            });

            first_part_trans.id = this._nextId++;
            this.aggregated_parts.push(first_part_trans);  
            return true;
    }
    return false;
}

addPartToAggregation() {

    if (this.aggregated_parts.length === 0) {
        this.addFirstPartToAggregation();
        return true;
    } else {
        let next_rule = null;
        let part_01 = null;
        let conn_01_id = -1;
        let next_rule_id = -1;
        let new_rule_attempts = 0;

        while (new_rule_attempts < 1000) { // ORIGINAL: 10000
            new_rule_attempts += 1;
            next_rule = null;

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
                let orientTransform = newPlaneToPlane(startingPlane, targetPlane);
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

                let collisionDetected = false;

                // Create a scaled-down version of next_part_trans
                const next_part_trans_collider_geo = next_part_trans.copy().collider.geometry[0];
                const next_part_trans_scale = next_part_trans.copy().geo;
                next_part_trans_scale.scale.set(0.99, 0.99, 0.99);

                for (let partToCheck of this.aggregated_parts) {
                    let part1mesh = null
                    if (partToCheck.collider.geometry[0] != undefined) {
                        part1mesh = partToCheck.collider.geometry[0];
                    }
                    else {
                        part1mesh = partToCheck.geo;
                    }

                    let part2mesh = null
                    if (next_part_trans_collider_geo != undefined) {
                        part2mesh = next_part_trans_collider_geo;
                    }
                    else {
                        part2mesh = next_part_trans_scale;
                    }
                    
                    part1mesh.updateMatrixWorld();
                    part2mesh.updateMatrixWorld();
                    const result = checkMeshesIntersection(part1mesh, part2mesh);
                    if (result) {
                        collisionDetected = true;
                        break;
                    }
                }

                if (collisionDetected) {
                    continue; // Restart the loop if a collision is detected
                }

                // REST OF STUFF
                next_part_trans.resetPart(this.rules);
                next_part_trans.active_connections = next_part_trans.active_connections.filter(conn => conn !== next_rule.connectionB);
                next_part_trans.id = this._nextId++;

                // parent-child tracking
                part_01.children.push(next_part_trans.id);
                next_part_trans.parent = part_01.id;
                next_part_trans.conn_on_parent = next_rule.connectionA;
                next_part_trans.conn_to_parent = next_rule.connectionB;

                // add part to aggregated_parts list
                this.aggregated_parts.push(next_part_trans);

                // remove connection from parent part's active connections
                part_01.active_connections = part_01.active_connections.filter(conn => conn !== conn_01_id);

                return true;
            }
        }

        console.error(`No valid rule found after ${new_rule_attempts} attempts.`);
        return false;
    }
}

removePartFromAggregation(part_id) {
    const partIndex = this.aggregated_parts.findIndex(part => part.id === part_id);
    if (partIndex !== -1) {
        const partToRemove = this.aggregated_parts[partIndex];

        // Remove part from parent's children
        if (partToRemove.parent !== null) {
            const parentPart = this.aggregated_parts.find(part => part.id === partToRemove.parent);
            if (parentPart) {
                parentPart.children = parentPart.children.filter(childId => childId !== partToRemove.id);
                parentPart.active_connections.push(partToRemove.conn_on_parent);
            }
        }

        // Remove part from aggregated_parts list
        this.aggregated_parts.splice(partIndex, 1);

        // Remove part's connections from active connections
        partToRemove.active_connections.forEach(conn_id => {
            const conn = partToRemove.connections[conn_id];
            const connectedPart = this.aggregated_parts.find(part => part.id === conn.connected_part_id);
            if (connectedPart) {
                connectedPart.active_connections = connectedPart.active_connections.filter(active_conn_id => active_conn_id !== conn.connected_conn_id);
            }
        });
        return true;
    } else {
        console.error("Error: Part not found");
        return false;
    }
    
}

/**
 * Check if a transformed part collides with any existing aggregated part.
 * @param {Part} partTrans
 * @returns {boolean}
 */
_checkCollision(partTrans) {
    const colliderGeo = partTrans.copy().collider.geometry[0];
    const scaledGeo = partTrans.copy().geo;
    scaledGeo.scale.set(0.99, 0.99, 0.99);

    for (const existing of this.aggregated_parts) {
        const part1mesh = existing.collider.geometry[0] != undefined
            ? existing.collider.geometry[0]
            : existing.geo;
        const part2mesh = colliderGeo != undefined
            ? colliderGeo
            : scaledGeo;
        part1mesh.updateMatrixWorld();
        part2mesh.updateMatrixWorld();
        if (checkMeshesIntersection(part1mesh, part2mesh)) {
            return true;
        }
    }
    return false;
}

/**
 * Place the first part in the aggregation by name (for manual mode).
 * @param {string} partName
 * @returns {{ success: boolean, part?: Part, error?: string }}
 */
placeFirstPart(partName) {
    if (this.aggregated_parts.length > 0) {
        return { success: false, error: 'Aggregation is not empty' };
    }
    const catalogPart = this.parts[partName];
    if (!catalogPart) {
        return { success: false, error: `Part "${partName}" not found in catalog` };
    }
    const partCopy = catalogPart.copy();
    partCopy.connections.forEach(conn => conn.generateRulesTable(this.rules));
    partCopy.id = this._nextId++;
    this.aggregated_parts.push(partCopy);
    return { success: true, part: partCopy };
}

/**
 * Place a specific part at a specific connection (deterministic, for manual mode).
 * @param {number} parentPartId
 * @param {number} connectionId
 * @param {string} partName
 * @param {number} connectionBId
 * @returns {{ success: boolean, part?: Part, error?: string }}
 */
placePartAtConnection(parentPartId, connectionId, partName, connectionBId) {
    const parentPart = this.aggregated_parts.find(p => p.id === parentPartId);
    if (!parentPart) return { success: false, error: 'Parent part not found' };
    if (!parentPart.active_connections.includes(connectionId)) {
        return { success: false, error: 'Connection is not active on parent' };
    }

    const conn = parentPart.connections[connectionId];
    const catalogPart = this.parts[partName];
    if (!catalogPart) return { success: false, error: `Part "${partName}" not found in catalog` };

    const rule = conn.rules_table.find(
        r => r.partB === partName && r.connectionB === connectionBId
    );
    if (!rule) return { success: false, error: 'No matching rule for this placement' };

    const startingPlane = catalogPart.connections[connectionBId].flip_pln;
    const targetPlane = parentPart.connections[connectionId].pln;
    const orientTransform = newPlaneToPlane(startingPlane, targetPlane);
    if (!orientTransform) return { success: false, error: 'Transform computation failed' };

    const partTrans = catalogPart.transform(orientTransform);
    if (!partTrans) return { success: false, error: 'Part transform failed' };

    if (this._checkCollision(partTrans)) {
        return { success: false, error: 'Collision detected' };
    }

    partTrans.resetPart(this.rules);
    partTrans.active_connections = partTrans.active_connections.filter(c => c !== connectionBId);
    partTrans.id = this._nextId++;

    parentPart.children.push(partTrans.id);
    partTrans.parent = parentPart.id;
    partTrans.conn_on_parent = connectionId;
    partTrans.conn_to_parent = connectionBId;

    this.aggregated_parts.push(partTrans);
    parentPart.active_connections = parentPart.active_connections.filter(c => c !== connectionId);

    return { success: true, part: partTrans };
}

/**
 * Return all open (unused) connections across aggregated parts.
 * @returns {Array<{partId: number, connectionId: number, plane: import('./plane.js').Plane, type: string, rules: Array}>}
 */
getOpenConnections() {
    const openConns = [];
    for (const part of this.aggregated_parts) {
        for (const connIdx of part.active_connections) {
            const conn = part.connections[connIdx];
            openConns.push({
                partId: part.id,
                connectionId: connIdx,
                plane: conn.pln,
                type: conn.type,
                rules: conn.rules_table,
            });
        }
    }
    return openConns;
}

/**
 * Compute all valid placements for a given part type.
 * Returns positions where the part can be placed without collision.
 * @param {string} partName
 * @returns {Array<{parentPartId: number, connectionId: number, partName: string, connectionBId: number, ruleIndex: number, transform: import('three').Matrix4, transformedPart: Part}>}
 */
getValidPlacementsForPart(partName) {
    const catalogPart = this.parts[partName];
    if (!catalogPart) return [];

    const placements = [];
    const openConns = this.getOpenConnections();

    for (const openConn of openConns) {
        for (let ruleIdx = 0; ruleIdx < openConn.rules.length; ruleIdx++) {
            const rule = openConn.rules[ruleIdx];
            if (rule.partB !== partName) continue;

            const startingPlane = catalogPart.connections[rule.connectionB]?.flip_pln;
            if (!startingPlane) continue;

            const targetPlane = openConn.plane;
            const orientTransform = newPlaneToPlane(startingPlane, targetPlane);
            if (!orientTransform) continue;

            const partTrans = catalogPart.transform(orientTransform);
            if (!partTrans) continue;

            if (!this._checkCollision(partTrans)) {
                placements.push({
                    parentPartId: openConn.partId,
                    connectionId: openConn.connectionId,
                    partName,
                    connectionBId: rule.connectionB,
                    ruleIndex: ruleIdx,
                    transform: orientTransform,
                    transformedPart: partTrans,
                });
            }
        }
    }

    return placements;
}

/**
 * Compute valid placements for a given part type, scoped to a single parent part.
 * Much cheaper than getValidPlacementsForPart when the aggregation is large.
 * @param {string} partName
 * @param {number} parentPartId
 * @returns {Array<{parentPartId: number, connectionId: number, partName: string, connectionBId: number, ruleIndex: number, transform: import('three').Matrix4, transformedPart: Part}>}
 */
getValidPlacementsAtParent(partName, parentPartId) {
    const catalogPart = this.parts[partName];
    if (!catalogPart) return [];

    const parentPart = this.aggregated_parts.find(p => p.id === parentPartId);
    if (!parentPart) return [];

    const placements = [];
    for (const connIdx of parentPart.active_connections) {
        const conn = parentPart.connections[connIdx];
        for (let ruleIdx = 0; ruleIdx < conn.rules_table.length; ruleIdx++) {
            const rule = conn.rules_table[ruleIdx];
            if (rule.partB !== partName) continue;

            const startingPlane = catalogPart.connections[rule.connectionB]?.flip_pln;
            if (!startingPlane) continue;

            const orientTransform = newPlaneToPlane(startingPlane, conn.pln);
            if (!orientTransform) continue;

            const partTrans = catalogPart.transform(orientTransform);
            if (!partTrans) continue;

            if (!this._checkCollision(partTrans)) {
                placements.push({
                    parentPartId,
                    connectionId: connIdx,
                    partName,
                    connectionBId: rule.connectionB,
                    ruleIndex: ruleIdx,
                    transform: orientTransform,
                    transformedPart: partTrans,
                });
            }
        }
    }
    return placements;
}

/**
 * Compute valid placements for a given part type at a single connection.
 * Cheapest option — only checks rules for one connection slot.
 * @param {string} partName
 * @param {number} parentPartId
 * @param {number} connectionId
 * @returns {Array<{parentPartId: number, connectionId: number, partName: string, connectionBId: number, ruleIndex: number, transform: import('three').Matrix4, transformedPart: Part}>}
 */
getValidPlacementsAtConnection(partName, parentPartId, connectionId) {
    const catalogPart = this.parts[partName];
    if (!catalogPart) return [];

    const parentPart = this.aggregated_parts.find(p => p.id === parentPartId);
    if (!parentPart) return [];

    if (!parentPart.active_connections.includes(connectionId)) return [];
    const conn = parentPart.connections[connectionId];
    if (!conn) return [];

    const placements = [];
    for (let ruleIdx = 0; ruleIdx < conn.rules_table.length; ruleIdx++) {
        const rule = conn.rules_table[ruleIdx];
        if (rule.partB !== partName) continue;

        const startingPlane = catalogPart.connections[rule.connectionB]?.flip_pln;
        if (!startingPlane) continue;

        const orientTransform = newPlaneToPlane(startingPlane, conn.pln);
        if (!orientTransform) continue;

        const partTrans = catalogPart.transform(orientTransform);
        if (!partTrans) continue;

        if (!this._checkCollision(partTrans)) {
            placements.push({
                parentPartId,
                connectionId,
                partName,
                connectionBId: rule.connectionB,
                ruleIndex: ruleIdx,
                transform: orientTransform,
                transformedPart: partTrans,
            });
        }
    }
    return placements;
}

/**
 * Set which part types are allowed for random aggregation.
 * Pass null or undefined to allow all parts.
 * @param {string[]|null} partNames
 */
setActivePartTypes(partNames) {
    this.activePartTypes = partNames ? new Set(partNames) : null;
}
}


// Helper functions
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
