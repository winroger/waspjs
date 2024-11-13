import * as THREE from 'three';
import { newPlaneToPlane } from './utilities';
import { checkMeshesIntersection } from './utilities';

export class Aggregation {
  constructor(_name, _parts, _rules, _rnd_seed = null, ) {
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
  }

  getParts() {
    return this.aggregated_parts
  }

  aggregate_rnd(num) {
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
                let index = 1;
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