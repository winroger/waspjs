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
            this.removePartFromAggregation(isCount);
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
    let first_part = this.parts[randomChoice(this.randomFn, Object.keys(this.parts))];
    if (first_part !== null) {
            let first_part_trans = first_part.copy()
            first_part_trans.connections.forEach(conn => {
                    conn.generateRulesTable(this.rules);
            });

            first_part_trans.id = 0;
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
        let part_01_id = -1;
        let conn_01_id = -1;
        let next_rule_id = -1;
        let new_rule_attempts = 0;

        while (new_rule_attempts < 1000) { // ORIGINAL: 10000
            new_rule_attempts += 1;
            next_rule = null;

            part_01_id = randomInt(this.randomFn, 0, this.aggregated_parts.length - 1);
            let part_01 = this.aggregated_parts[part_01_id];
            if (part_01.active_connections.length > 0) {
                conn_01_id = randomChoice(this.randomFn, part_01.active_connections);
                let conn_01 = part_01.connections[conn_01_id];
                if (conn_01.active_rules.length > 0) {
                    next_rule_id = randomChoice(this.randomFn, conn_01.active_rules);
                    next_rule = conn_01.rules_table[next_rule_id];
                }
            }

            if (next_rule !== null) {
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
                let targetPlane = this.aggregated_parts[part_01_id].connections[conn_01_id].pln;
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
                next_part_trans.id = this.aggregated_parts.length;

                // parent-child tracking
                this.aggregated_parts[part_01_id].children.push(next_part_trans.id);
                next_part_trans.parent = this.aggregated_parts[part_01_id].id;
                next_part_trans.conn_on_parent = next_rule.connectionA;
                next_part_trans.conn_to_parent = next_rule.connectionB;

                // add part to aggregated_parts list
                this.aggregated_parts.push(next_part_trans);

                // remove connection from parent part's active connections
                this.aggregated_parts[part_01_id].active_connections = this.aggregated_parts[part_01_id].active_connections.filter(conn => conn !== conn_01_id);

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
