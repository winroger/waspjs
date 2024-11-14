import * as THREE from 'three';
import { newPlaneToPlane } from './utilities';
import { checkMeshesIntersection } from './utilities';
import { Part } from './waspPart';
import { Rule } from './waspRules';

const colorMap = {
    "0": 0xF5F5DC,  // Beige
    "1": 0xDEB887,  // Burlywood
    "2": 0xD2B48C,  // Tan
    "3": 0xF5DEB3,  // Wheat
    "4": 0xFFE4C4,  // Bisque
};

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

  static fromData(data) {
    const d_name = data['name'];

    const d_parts = data['parts'].map(part_data => {
      let newPart;
      if (part_data['class_type'] === 'Part') {
        newPart = Part.fromData(part_data);
      } else if (part_data['class_type'] === 'AdvancedPart') {
        newPart = AdvancedPart.fromData(part_data);
      } else {
        return null;
      }
      newPart.geo.material.color.setHex(colorMap[data['parts'].indexOf(part_data) % 10] || colorMap[0]);
      return newPart;
    }).filter(part => part !== null);

    const d_rules = data['rules'].map(rule => new Rule().fromData(rule));
    const d_mode = parseInt(data['mode']);
    const d_coll_check = data['coll_check'];
    //const d_field = data['field'] ? data['field'].map(field_data => Field.fromData(field_data)) : [];

    const d_global_constraints = data['global_constraints'].map(const_data => {
      if (const_data['type'] === 'plane') {
        return Plane_Constraint.fromData(const_data);
      } else if (const_data['type'] === 'mesh_collider') {
        return Mesh_Constraint.fromData(const_data);
      }
      return null;
    }).filter(constraint => constraint !== null);

    const d_rnd_seed = data['rnd_seed'];
    const d_catalog = data['catalog'] ? PartCatalog.fromData(data['catalog']) : null;

    const aggregation = new Aggregation(d_name, d_parts, d_rules, d_mode, [], d_coll_check, /*d_field,*/ d_global_constraints, d_rnd_seed, d_catalog);

    const d_aggregated_parts = data['aggregated_parts_sequence'].map(p_id => {
      const aggr_part_data = data['aggregated_parts'][String(p_id)];
      if (aggr_part_data['class_type'] === 'Part') {
        return Part.fromData(aggr_part_data);
      } else if (aggr_part_data['class_type'] === 'AdvancedPart') {
        return AdvancedPart.fromData(aggr_part_data);
      }
      return null;
    }).filter(part => part !== null);

    // THIS CAN BE FIXED IN ORDER TO LOAD AGGREGATIONS FROM THE FILE AS INITAL STATE, NEEDS TO ADD
    // THE PARTS TO THE SCENE
    aggregation.aggregated_parts = [] // ORIGINAL: d_aggregated_parts; 
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
}

addFirstPartToAggregation() {
    let first_part = this.parts[randomChoice(Object.keys(this.parts))];
    const identityMatrix = new THREE.Matrix4().identity();
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
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}