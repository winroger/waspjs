import * as THREE from 'three';
import { meshFromData, meshToData } from './utilities';
import { Connection } from './waspConnection';

export class Collider {
    constructor(geometry, multiple = false, checkAll = false, connections = [], validConnections = []) {
        this.geometry = geometry;
        this.multiple = multiple;
        this.checkAll = checkAll;
        this.connections = connections;

        /*this.facesCount = 0;
        for (let geo of this.geometry) {
            this.facesCount += geo.faces.length;
        }*/

        this.validConnections = validConnections;

        this.setConnections = false;
        if (this.connections.length === this.geometry.length && this.multiple) {
            this.setConnections = true;
        }
    }

    toString() {
        return "WaspCollider";
    }

    static fromData(data) {
        const geometry = data.geometry.map(meshFromData);
        const multiple = data.multiple;
        const checkAll = data.check_all;
        const connections = data.connections.map(Connection.fromData);
        const validConnections = data.valid_connections.map(vc => parseInt(vc, 10));
        return new Collider(geometry, multiple, checkAll, connections, validConnections);
    }

    toData() {
        return {
            geometry: this.geometry.map(meshToData),
            multiple: this.multiple,
            check_all: this.checkAll,
            connections: this.connections.map(conn => conn.toData()),
            valid_connections: this.validConnections
        };
    }

    transform(trans, transformConnections = false, maintainValid = false) {
        const geometryTrans = this.geometry.map(geo => {
            const geoTrans = geo.clone();
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

    copy() {
        const geometryCopy = this.geometry.map(geo => geo.clone());
        const connectionsCopy = this.connections.map(conn => conn.copy());
        const validConnectionsCopy = [...this.validConnections];
        return new Collider(geometryCopy, this.multiple, this.checkAll, connectionsCopy, validConnectionsCopy);
    }

    checkCollisionsWithParts(parts) {
        if (this.multiple) {
            let validColliders = [];
            this.validConnections = [];
            let count = 0;
            for (let geo of this.geometry) {
                let validColl = true;
                for (let part of parts) {
                    for (let otherGeo of part.collider.geometry) {
                        if (geo.intersectsBox(new THREE.Box3().setFromObject(otherGeo))) {
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
                        if (geo.intersectsBox(new THREE.Box3().setFromObject(otherGeo))) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }
    }

    checkCollisionsById(parts, ids) {
        if (this.multiple) {
            let validColliders = [];
            let count = 0;
            for (let geo of this.geometry) {
                let validColl = true;
                for (let id of ids) {
                    for (let otherGeo of parts[id].collider.geometry) {
                        if (geo.intersectsBox(new THREE.Box3().setFromObject(otherGeo))) {
                            validColl = false;
                            break;
                        }
                    }
                    if (!validColl) break;
                }
                validColliders.push(validColl);
                if (validColl && !this.checkAll) break;
                count++;
            }
            return !validColliders.includes(true);
        } else {
            for (let geo of this.geometry) {
                for (let id of ids) {
                    for (let otherGeo of parts[id].collider.geometry) {
                        if (geo.intersectsBox(new THREE.Box3().setFromObject(otherGeo))) {
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

    checkGlobalConstraints(constraint) {
        // Placeholder for global constraints check
        return false;
    }
}