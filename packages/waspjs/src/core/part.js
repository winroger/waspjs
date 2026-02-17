import { meshFromData, meshToData, transformToData } from "./utilities";
import { Connection } from "./connection"; 
import { Collider } from "./collider"; 
import * as THREE from 'three';

// Base Part
/**
 * Represents a single placeable part with geometry, connections, and collider.
 */
export class Part {
    /**
     * @param {string} name
     * @param {THREE.Mesh} geometry
     * @param {Connection[]} connections
     * @param {Collider} collider
     * @param {Array} attributes
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

        this.attributes = [] // not implemented, ORIGINAL: attributes.length > 0 ? attributes : [];

        this.is_constrained = false;
    }

    // create class from data dictionary
    static fromData(data) {
        let p_name = data['name'];
        let p_geometry = meshFromData(data['geometry'])
        let p_connections = data['connections'].map(c_data => Connection.fromData(c_data));
        let p_collider = Collider.fromData(data['collider']);
        let p_attributes = []; // ATTRIBUTES NOT IMPLEMENTED
        let p_dim = parseFloat(data['dim']);

        let p_id = null;
        try {
            p_id = parseInt(data['id']);
        } catch {
            p_id = data['id'];
        }
        let p_field = data['field'];

        let part = new Part(p_name, p_geometry, p_connections, p_collider,  p_attributes, p_dim, p_id, p_field);
        part.transformation = new THREE.Matrix4().identity() //transformFromData(data['transform']);
        part.parent = data['parent'];
        part.conn_on_parent = data['conn_on_parent'];
        part.conn_to_parent = data['conn_to_parent'];

        for (let child_data of data['children']) {
            try {
                part.children.push(parseInt(child_data));
            } catch {
                part.children.push(child_data);
            }
        }

        return part;
    }

    // return the data dictionary representing the part
    toData() {
        return {
            'class_type': 'Part',
            'name': this.name,
            'id': this.id,
            'geometry': meshToData(this.geo),
            'field': this.field,
            'connections': this.connections.map(conn => conn.toData()),
            'active_connections': this.active_connections,
            'collider': this.collider.toData(),
            'transform': transformToData(this.transformation),
            'dim': this.dim,
            'parent': this.parent,
            'conn_on_parent': this.conn_on_parent,
            'conn_to_parent': this.conn_to_parent,
            'children': this.children
        };
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
            'attributes': this.attributes
        };
    }

    // return a transformed copy of the part
    transform(trans, _transform_sub_parts = false, maintain_parenting = false) {
        let geo_trans = this.geo.clone()
        geo_trans.applyMatrix4(trans);

        let collider_trans = this.collider.transform(trans);

        let connections_trans = []
        for (let conn of this.connections) {
            let conn_trans = conn.transform(trans)
            connections_trans.push(conn_trans)
        }

        let attributes_trans = [];
        if (this.attributes.length > 0) {
            attributes_trans = this.attributes.map(attr => attr.transform(trans));
        }

        let part_trans = new Part(this.name, geo_trans, connections_trans, collider_trans, attributes_trans, this.dim, this.id, this.field)
        
        part_trans.transformation.copy(this.transformation).multiply(trans)

        if (maintain_parenting) {
            part_trans.parent = this.parent;
            part_trans.conn_on_parent = this.conn_on_parent;
            part_trans.conn_to_parent = this.conn_to_parent;
            part_trans.children = this.children;
        }
        return part_trans
    }

    // return a copy of the part
    copy(maintain_parenting = false) {
        let geo_copy = this.geo.clone();

        let collider_copy = this.collider.copy();

        let connections_copy = this.connections.map(conn => conn.copy());

        let attributes_copy = [];
        if (this.attributes.length > 0) {
            attributes_copy = this.attributes.map(attr => attr.copy());
        }

        let part_copy = new Part(this.name, geo_copy, connections_copy, collider_copy, attributes_copy, this.dim, this.id, this.field);
        part_copy.transformation.copy(this.transformation);

        if (maintain_parenting) {
            part_copy.parent = this.parent;
            part_copy.conn_on_parent = this.conn_on_parent;
            part_copy.conn_to_parent = this.conn_to_parent;
            part_copy.children = this.children;
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

// Derive a rough center and size from the mesh geometry while handling missing data gracefully.
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

    const center = geom.boundingBox ? geom.boundingBox.getCenter(new THREE.Vector3()) : defaultResult.center.clone();
    center.applyMatrix4(mesh.matrix);

    const radius = geom.boundingSphere ? geom.boundingSphere.radius * Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z) : null;
    const boxSize = geom.boundingBox ? geom.boundingBox.getSize(new THREE.Vector3()).length() / 2 : null;
    const dim = radius ?? boxSize ?? (collider && collider.geometry?.length ? collider.geometry.length : defaultResult.dim);

    return { center, dim };
}
