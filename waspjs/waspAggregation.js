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
                let first_part_trans = first_part.copy()
                //console.log("identityMatrix: ", identityMatrix)
                //let first_part_trans = first_part.transform(identityMatrix);
                //console.log("first_part_trans: ", first_part_trans)
                first_part_trans.connections.forEach(conn => {
                    //console.log("conn: ", conn)
                    //addConnectionArrowsToScene(conn);
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
            //console.log("next_rule: ", next_rule)
  
            if (next_rule !== null) {
              
                let next_part = this.parts[next_rule.partB];


                // NEW PART
                let startingPlane = next_part.connections[next_rule.connectionB].flip_pln

                //addSphereToScene2(next_part.connections[next_rule.connectionB].flip_pln.origin, 0xFF69B4) // Pink
                //addConnectionArrowsToScene(next_part.connections[next_rule.connectionB].flip_pln)

                //console.log("the plane one the new part as it is initialized: ", startingPlane)



                // EXISTING PART
                let targetPlane = this.aggregated_parts[part_01_id].connections[conn_01_id].pln

                //addSphereToScene2(this.aggregated_parts[part_01_id].connections[conn_01_id].pln.origin, 0x00FFFF) // Cyan
                //let newArrow = addConnectionArrowsToScene(this.aggregated_parts[part_01_id].connections[conn_01_id].pln)
                //threeJsContext.scene.add(newArrow);

                //console.log("the plane one the existing part where it sould go: ", startingPlane)

                // CALC TRANSFORM
                let orientTransform = newPlaneToPlane(startingPlane, targetPlane);
                //console.log("orientTransform: ", orientTransform.elements)


                // ADD HELPER ARROW TO VISUALIZE MOVEMENT DIRECTION
                /*const lengthST = startingPlane.origin.distanceTo(targetPlane.origin);
                const direction = new THREE.Vector3().subVectors(targetPlane.origin, startingPlane.origin).normalize();
                const arrowHelper = new THREE.ArrowHelper(
                    direction,
                    startingPlane.origin,
                    lengthST,
                    0xffff00 // Yellow
                );
                threeJsContext.scene.add(arrowHelper);*/

                // PERSFORM TRANFORM ON PART
                let next_part_trans = next_part.transform(orientTransform);

                //console.log("where the plane actually ends up at: ", finalPlane)
                

                //addSphereToScene2(next_part_trans.connections[next_rule.connectionB].flip_pln.origin, 0x00FF00) // Green
                //addConnectionArrowsToScene(next_part_trans.connections[next_rule.connectionB].flip_pln)


                // REST OF STUFF
                //console.log("nextRule: ", next_rule)
                next_part_trans.resetPart(this.rules);
                //console.log("New Part Active Connections BEFORE: ", next_part_trans.active_connections)
                next_part_trans.active_connections = next_part_trans.active_connections.filter(conn => conn !== next_rule.connectionB);
                //console.log("New Part Active Connections AFTER: ", next_part_trans.active_connections)
                next_part_trans.id = this.aggregated_parts.length;
                //console.log(`Removed Connection ${next_rule.connectionB} from new part ${next_part_trans.id}`)

                
                // parent-child tracking
                this.aggregated_parts[part_01_id].children.push(next_part_trans.id);
                next_part_trans.parent = this.aggregated_parts[part_01_id].id;
                next_part_trans.conn_on_parent = next_rule.conn1;
                next_part_trans.conn_to_parent = next_rule.conn2;
  
                // add part to aggregated_parts list
                this.aggregated_parts.push(next_part_trans);
  
                // remove connection from parent part's active connections
                //console.log("Parent Part Active Connections BEFORE: ", this.aggregated_parts[part_01_id].active_connections)
                this.aggregated_parts[part_01_id].active_connections = this.aggregated_parts[part_01_id].active_connections.filter(conn => conn !== conn_01_id);
                //console.log("Parent Part Active Connections AFTER: ", this.aggregated_parts[part_01_id].active_connections)

                added += 1;
                //console.log(`Removed Connection ${this.aggregated_parts[part_01_id].connections[conn_01_id]} from parent part ${part_01_id}'s active connections`)
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

function addSphereToScene2(position, color) {
    const geometry = new THREE.SphereGeometry(0.5, 32, 16);
    const material = new THREE.MeshBasicMaterial({ color: color });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(position.x, position.y, position.z);
    threeJsContext.scene.add(sphere);
}

function addConnectionArrowsToScene(plane) {
    //console.log("plane to view: ", plane)
    const origin = plane.origin;
    const xArrow = new THREE.ArrowHelper(plane.xaxis.normalize(), origin, 2, 0xff0000); // Red for X-axis
    const yArrow = new THREE.ArrowHelper(plane.yaxis.normalize(), origin, 2, 0x0000ff); // Blue for Y-axis
    const zArrow = new THREE.ArrowHelper(plane.zaxis.normalize(), origin, 2, 0x00ff00); // Green for Z-axis

    threeJsContext.scene.add(xArrow);
    threeJsContext.scene.add(yArrow);
    threeJsContext.scene.add(zArrow);
}