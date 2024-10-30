import * as THREE from 'three';
import { newPlaneToPlane } from './utilities';
import { checkMeshesIntersection } from './utilCollisionDetect';

export class Aggregation {
  constructor(_name, _parts, _rules, _rnd_seed = null, ) {
      // basic parameters
      this.name = _name;

      this.parts = {};
      _parts.forEach(part => {
          this.parts[part.name] = part;
      });

      this.rules = _rules;
      this.aggregated_parts = [];


      // aggregation queue, storing sorted possible next states in the form (part, f_val)
      this.aggregation_queue = [];
      this.queue_values = [];
      this.queue_count = 0;

      // random seed
      this.rnd_seed = _rnd_seed === null ? Date.now() : _rnd_seed;

  }

  static fromData(data) {
    const d_name = data.aggregation_name;

    const d_parts = Object.keys(data.parts).map(key => {
        const partData = data.parts[key];
        if (partData.class_type === 'Part') {
            return Part.fromData(partData);
        } else if (partData.class_type === 'AdvancedPart') {
            return AdvancedPart.fromData(partData);
        }
        return null;
    }).filter(part => part !== null);

    const d_rules = data.rules ? data.rules.map(ruleData => Rule.fromData(ruleData)) : [];
    const d_mode = data.mode ? parseInt(data.mode, 10) : 0;
    const d_coll_check = data.coll_check || false;

    const d_field = data.field ? data.field.map(fieldData => Field.fromData(fieldData)) : [];

    const d_global_constraints = data.global_constraints ? data.global_constraints.map(constData => {
        if (constData.type === 'plane') {
            return PlaneConstraint.fromData(constData);
        } else if (constData.type === 'mesh_collider') {
            return MeshConstraint.fromData(constData);
        }
        return null;
    }).filter(constraint => constraint !== null) : [];

    const d_rnd_seed = data.rnd_seed || null;
    const d_catalog = data.catalog ? PartCatalog.fromData(data.catalog) : null;

    const aggregation = new Aggregation(d_name, d_parts, d_rules, d_mode, [], d_coll_check, d_field, d_global_constraints, d_rnd_seed, d_catalog);

    // Assuming the "aggregated_parts_sequence" and "aggregated_parts" are present in your actual data structure
    const d_aggregated_parts = data.aggregated_parts_sequence ? data.aggregated_parts_sequence.map(p_id => {
        const aggrPartData = data.aggregated_parts[String(p_id)];
        if (aggrPartData.class_type === 'Part') {
            return Part.fromData(aggrPartData);
        } else if (aggrPartData.class_type === 'AdvancedPart') {
            return AdvancedPart.fromData(aggrPartData);
        }
        return null;
    }).filter(part => part !== null) : [];

    aggregation.aggregatedParts = d_aggregated_parts;

    // Assuming the "graph" field is present in your actual data structure
    aggregation.graph = data.graph ? Graph.fromData(data.graph) : null;

    aggregation.resetRules(aggregation.rules);

    if (aggregation.field !== null) {
        aggregation.recomputeAggregationQueue();
    }

    return aggregation;
}


  randomSeed(seed) {
    this.rnd_seed = seed;
    Math.seedrandom(seed);
  }

  getParts() {
    return this.aggregated_parts
  }

  aggregate_rnd(num) {
    let added  = 0;
    let loops = 0;
    while (added < num) {
        loops += 1;
        if (loops > num * 1000) {
            return `Could not place ${num - added} parts`;
        }
  
        // if no part is present in the aggregation, add first random part
        if (this.aggregated_parts.length === 0) {
            let first_part = this.parts[randomChoice(Object.keys(this.parts))];
            console.log("First Part: ", first_part)
            if (first_part !== null) {
                let first_part_trans = first_part.copy()
                first_part_trans.connections.forEach(conn => {
                    conn.generateRulesTable(this.rules);
                });
  
                first_part_trans.id = 0;
                this.aggregated_parts.push(first_part_trans);
                added += 1;
            }
        } else {
            //console.log("PLACING PART NR. ", this.aggregated_parts.length)
            let next_rule = null;
            let part_01_id = -1;
            let conn_01_id = -1;
            let next_rule_id = -1;
            let new_rule_attempts = 0;
  
            while (new_rule_attempts < 10000 ) { // ORIGINAL: 10000
                //console.log("new_rule_attempts: ", new_rule_attempts)   

                new_rule_attempts += 1;
                next_rule = null;
  
                part_01_id = randomInt(0, this.aggregated_parts.length - 1);
                let part_01 = this.aggregated_parts[part_01_id];
                if (part_01.active_connections.length > 0) {
                    conn_01_id = randomChoice(part_01.active_connections);
                    let conn_01 = part_01.connections[conn_01_id];
                    if (conn_01.active_rules.length > 0) {
                        next_rule_id = randomChoice(conn_01.active_rules);
                        next_rule = conn_01.rules_table[next_rule_id];
                        break;
                    }
                }
            }
            //console.log("next_rule: ", next_rule)
  
            if (next_rule !== null) {
              
                let next_part = this.parts[next_rule.partB];


                // NEW PART
                let startingPlane = next_part.connections[next_rule.connectionB].flip_pln

                // EXISTING PART
                let targetPlane = this.aggregated_parts[part_01_id].connections[conn_01_id].pln

                // CALC TRANSFORM
                let orientTransform = newPlaneToPlane(startingPlane, targetPlane);
                //console.log("orientTransform: ", orientTransform.elements)

                // PERSFORM TRANFORM ON PART
                let next_part_trans = next_part.transform(orientTransform);

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

                added += 1;
            
            } else {

                return `Could not place ${num - added} parts`;
            }
        }
    }
  }

aggregate_rnd_ctrl(num) {
    let added = 0;
    let loops = 0;
    while (added < num) {
        loops += 1;
        if (loops > num * 100) {
            return `Could not place ${num - added} parts`;
        }

        if (this.aggregated_parts.length === 0) {
            let first_part = this.parts[randomChoice(Object.keys(this.parts))];
            const identityMatrix = new THREE.Matrix4().identity();
            if (first_part !== null) {
                let first_part_trans = first_part.copy()
                first_part_trans.connections.forEach(conn => {
                    conn.generateRulesTable(this.rules);
                });

                first_part_trans.id = 0;
                this.aggregated_parts.push(first_part_trans);  
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
}

addPartToAggregation() {
    let next_rule = null;
    let part_01_id = -1;
    let conn_01_id = -1;
    let next_rule_id = -1;
    let new_rule_attempts = 0;

    while (new_rule_attempts < 1000) { // ORIGINAL: 10000
        new_rule_attempts += 1;
        next_rule = null;

        part_01_id = randomInt(0, this.aggregated_parts.length - 1);
        let part_01 = this.aggregated_parts[part_01_id];
        if (part_01.active_connections.length > 0) {
            conn_01_id = randomChoice(part_01.active_connections);
            let conn_01 = part_01.connections[conn_01_id];
            if (conn_01.active_rules.length > 0) {
                next_rule_id = randomChoice(conn_01.active_rules);
                next_rule = conn_01.rules_table[next_rule_id];
            }
        }

        if (next_rule !== null) {
            //console.log("next_rule: ", next_rule);
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
            const next_part_trans_scale = next_part_trans.copy().geo;
            next_part_trans_scale.scale.set(0.99, 0.99, 0.99);

            for (let partToCheck of this.aggregated_parts) {
                let index = 1;
                //console.log(partToCheck.geo)
                //console.log(partToCheck.collider.geometry)
                let part1mesh = null
                if (partToCheck.collider.geometry[0] != undefined) {
                    part1mesh = partToCheck.collider.geometry[0];
                }
                else {
                    part1mesh = partToCheck.geo;
                }
                const part2mesh = next_part_trans_scale;
                part1mesh.updateMatrixWorld();
                part2mesh.updateMatrixWorld();
                const result = checkMeshesIntersection(part1mesh, part2mesh);
                if (result) {
                    collisionDetected = true;
                    break;
                } else {
                    index++;
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
            //console.log("new part has parent with id: ", this.aggregated_parts[part_01_id].id)
            //console.log("next Rule: ", next_rule)
            next_part_trans.conn_on_parent = next_rule.connectionA;
            next_part_trans.conn_to_parent = next_rule.connectionB;

            // add part to aggregated_parts list
            this.aggregated_parts.push(next_part_trans);
            //console.log("Added part to aggregation: ", next_part_trans);

            // remove connection from parent part's active connections
            this.aggregated_parts[part_01_id].active_connections = this.aggregated_parts[part_01_id].active_connections.filter(conn => conn !== conn_01_id);

            return true; // Successfully added part, exit the loop
        }
    }

    console.error(`No valid rule found after ${new_rule_attempts} attempts.`);
    return false;
}

removePartFromAggregation(part_id) {
    //console.log("Removing Part with id: ", part_id);
    const partIndex = this.aggregated_parts.findIndex(part => part.id === part_id);
    if (partIndex !== -1) {
        const partToRemove = this.aggregated_parts[partIndex];
        //console.log("Part to remove: ", partToRemove);

        // Remove part from parent's children
        if (partToRemove.parent !== null) {
            const parentPart = this.aggregated_parts.find(part => part.id === partToRemove.parent);
            //console.log("Found parent part: ", parentPart);
            if (parentPart) {
                parentPart.children = parentPart.children.filter(childId => childId !== partToRemove.id);
                // Restore parent's active connections
                parentPart.active_connections.push(partToRemove.conn_on_parent);
                //console.log("Restored the active connection:")
            }
        }

        // Remove part from aggregated_parts list
        this.aggregated_parts.splice(partIndex, 1);

        // Remove part's connections from active connections
        partToRemove.active_connections.forEach(conn_id => {
            const conn = partToRemove.connections[conn_id];
            const connectedPart = this.aggregated_parts.find(part => part.id === conn.connected_part_id);
            //console.log("Found connected part: ", connectedPart);
            if (connectedPart) {
                //console.log(`Removed active connection ${connectedPart.active_connections} connectedPart:`, connectedPart);
                connectedPart.active_connections = connectedPart.active_connections.filter(active_conn_id => active_conn_id !== conn.connected_conn_id);
            }
        });

        return true;
    } else {
        console.log("Error: Part not found");
        return false;
    }
}
}


// Helper functions
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}