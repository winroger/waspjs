/**
 * WaspJS — Collider class and surface collision checks.
 * Upstream module: src/wasp/core/colliders.py
 */
import { copyMesh, meshFromData, meshToData, checkMeshesIntersection } from './utilities';
import { Connection } from './connection';

// ==================== Collider ====================

/**
 * Stores composite collision meshes or alternative free-space variants.
 */
export class Collider {
    /**
     * @param {Array<import('three').Mesh>} geometry
     * @param {boolean} multiple
     * @param {boolean} checkAll
     * @param {Connection[]} connections
     * @param {number[]} validConnections
     */
    constructor(geometry, multiple = false, checkAll = false, connections = [], validConnections = []) {
        this.geometry = geometry;
        this.multiple = multiple;
        this.checkAll = checkAll;
        this.connections = connections;

        this.facesCount = 0;
        for (const mesh of this.geometry) {
            const geo = mesh.geometry;
            // JS host representation: JSON quads have already become triangles.
            this.facesCount += geo.isBufferGeometry
                ? Math.floor((geo.index?.count ?? geo.getAttribute('position')?.count ?? 0) / 3)
                : geo.faces.length;
        }

        this.validConnections = validConnections;

        this.setConnections = false;
        if (this.connections.length === this.geometry.length && this.multiple) {
            this.setConnections = true;
        }
    }

    /**
     * Deserialize collider data.
     */
    static fromData(data) {
        const geometry = data.geometry.map(meshFromData);
        const multiple = data.multiple;
        const checkAll = data.check_all;
        const connections = data.connections.map(Connection.fromData);
        const validConnections = data.valid_connections.map(vc => parseInt(vc, 10));
        return new Collider(geometry, multiple, checkAll, connections, validConnections);
    }

    /**
     * Serialize collider data.
     */
    toData() {
        return {
            geometry: this.geometry.map(meshToData),
            multiple: this.multiple,
            check_all: this.checkAll,
            connections: this.connections.map(conn => conn.toData()),
            valid_connections: this.validConnections
        };
    }

    /**
     * Transform independent mesh copies, matching GH Collider.transform.
     * @param {import('three').Matrix4} trans
     * @param {boolean} [transformConnections=false]
     * @param {boolean} [maintainValid=false]
     * @returns {Collider}
     */
    transform(trans, transformConnections = false, maintainValid = false) {
        const geometryTrans = this.geometry.map(geo => {
            const geoTrans = copyMesh(geo);
            geoTrans.applyMatrix4(trans);
            return geoTrans;
        });

        let connectionsTrans = [];
        if (transformConnections) {
            connectionsTrans = this.connections.map(conn => conn.transform(trans));
        }

        if (maintainValid) {
            return new Collider(geometryTrans, this.multiple, this.checkAll, connectionsTrans, [...this.validConnections]);
        } else {
            return new Collider(geometryTrans, this.multiple, this.checkAll, connectionsTrans);
        }
    }

    /**
     * Copy collider meshes with independent buffers, matching GH Mesh.Duplicate.
     * @returns {Collider}
     */
    copy() {
        const geometryCopy = this.geometry.map(copyMesh);
        const connectionsCopy = this.connections.map(conn => conn.copy());
        const validConnectionsCopy = [...this.validConnections];
        return new Collider(geometryCopy, this.multiple, this.checkAll, connectionsCopy, validConnectionsCopy);
    }

    /**
     * Test all meshes; multiple=true accepts any free variant and updates its
     * geometry indices in validConnections when connections are associated.
     * checkAll controls enumeration, not an AND of variants.
     * @param {Array<{collider: Collider}>} parts
     * @returns {boolean} True when blocked.
     */
    checkCollisionsWithParts(parts) {
        if (this.multiple) {
            let validColliders = [];
            this.validConnections = [];
            let count = 0;
            for (let geo of this.geometry) {
                let validColl = true;
                for (let part of parts) {
                    for (let otherGeo of part.collider.geometry) {
                        if (checkMeshesIntersection(geo, otherGeo)) {
                            validColl = false;
                            break;
                        }
                    }
                    if (!validColl) break;
                }
                validColliders.push(validColl);
                if (this.setConnections && validColl) {
                    this.validConnections.push(count);
                }
                if (validColl && !this.checkAll) break;
                count++;
            }
            return !validColliders.includes(true);
        } else {
            for (let geo of this.geometry) {
                for (let part of parts) {
                    for (let otherGeo of part.collider.geometry) {
                        if (checkMeshesIntersection(geo, otherGeo)) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }
    }

    /**
     * Test selected array indices without changing validConnections, as GH does.
     * @param {Array<{collider: Collider}>} parts
     * @param {number[]} ids Array indices, not Part.id values.
     * @returns {boolean} True when blocked.
     */
    checkCollisionsById(parts, ids) {
        if (this.multiple) {
            let validColliders = [];
            for (let geo of this.geometry) {
                let validColl = true;
                for (let id of ids) {
                    for (let otherGeo of parts[id].collider.geometry) {
                        if (checkMeshesIntersection(geo, otherGeo)) {
                            validColl = false;
                            break;
                        }
                    }
                    if (!validColl) break;
                }
                validColliders.push(validColl);
                if (validColl && !this.checkAll) break;
            }
            return !validColliders.includes(true);
        } else {
            for (let geo of this.geometry) {
                for (let id of ids) {
                    for (let otherGeo of parts[id].collider.geometry) {
                        if (checkMeshesIntersection(geo, otherGeo)) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }
    }

    checkIntersectionWithLine(line) {
        for (let geo of this.geometry) {
            if (geo.intersectsLine(line)) {
                return true;
            }
        }
        return false;
    }

    checkGlobalConstraints(_constraint) {
        // Placeholder for global constraints check
        return false;
    }
}
