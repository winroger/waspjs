class Aggregation {
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
    let added = 0;
    let loops = 0;
    while (added < num) {
        loops += 1;
        if (loops > num * 100) {
            return `Could not place ${num - added} parts`;
        }
  
        // if no part is present in the aggregation, add first random part
        if (this.aggregated_parts.length === 0) {
            let first_part = this.parts[randomChoice(Object.keys(this.parts))];
            console.log("First Part: ", first_part)
            const identityMatrix = new THREE.Matrix4().identity();
            if (first_part !== null) {
                //let first_part_trans = first_part.copy()
                console.log("identityMatrix: ", identityMatrix)
                let first_part_trans = first_part.transform(identityMatrix);
                console.log("first_part_trans: ", first_part_trans)
                first_part_trans.connections.forEach(conn => {
                    console.log("conn: ", conn)
                    conn.generateRulesTable(this.rules);
                });
  
                first_part_trans.id = 0;
                this.aggregated_parts.push(first_part_trans);  
                added += 1;
            }
        } else {

            let next_rule = null;
            let part_01_id = -1;
            let conn_01_id = -1;
            let next_rule_id = -1;
            let new_rule_attempts = 0;
  
            while (new_rule_attempts < 100) { // ORIGINAL: 10000

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
            console.log("next_rule: ", next_rule)
  
            if (next_rule !== null) {
              
                let next_part = this.parts[next_rule.partB];
                let startingPlane = next_part.connections[next_rule.connectionB].flip_pln
                let targetPlane = this.aggregated_parts[part_01_id].connections[conn_01_id].pln

                
                let orientTransform = newPlaneToPlane(startingPlane, targetPlane);
                console.log("orientTransform: ", orientTransform)

                //let next_part_trans = next_part.copy()
                let next_part_trans = next_part.transform(orientTransform);
                next_part_trans.resetPart(this.rules);
                next_part_trans.active_connections = next_part_trans.active_connections.filter(conn => conn !== next_rule.conn2);
                next_part_trans.id = this.aggregated_parts.length;

                // TEST
                let finalPlane = next_part_trans.connections[next_rule.connectionB].flip_pln
                console.log("FINAL PLANE: ", finalPlane)
                const FinalGeo = new THREE.SphereGeometry(0.5, 32, 16);
                const FinalMat = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
                const FinalSphere = new THREE.Mesh(FinalGeo, FinalMat);
                FinalSphere.position.set(finalPlane.origin.x, finalPlane.origin.y, finalPlane.origin.z);
                threeJsContext.scene.add(FinalSphere);
  
                // parent-child tracking
                this.aggregated_parts[part_01_id].children.push(next_part_trans.id);
                next_part_trans.parent = this.aggregated_parts[part_01_id].id;
                next_part_trans.conn_on_parent = next_rule.conn1;
                next_part_trans.conn_to_parent = next_rule.conn2;
  
                // add part to aggregated_parts list
                this.aggregated_parts.push(next_part_trans);
  
                // remove connection from parent part's active connections
                this.aggregated_parts[part_01_id].active_connections = this.aggregated_parts[part_01_id].active_connections.filter(conn => conn !== conn_01_id);
                added += 1;
                //console.log("-------4-------")
                
            } else {

                return `Could not place ${num - added} parts`;
            }
        }
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