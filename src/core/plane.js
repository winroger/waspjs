import * as THREE from 'three';

/**
 * Simple 3D plane defined by origin and orthonormal axes.
 */
export class Plane {
    /**
     * @param {THREE.Vector3} origin
     * @param {THREE.Vector3} xaxis
     * @param {THREE.Vector3} zaxis
     */
    constructor(origin, xaxis, zaxis) {
        this.origin = origin.clone();
        this.xaxis = xaxis.clone().normalize();
        this.zaxis = zaxis.clone().normalize();
        this.yaxis = new THREE.Vector3().crossVectors(this.xaxis, this.zaxis).normalize();
    }

    clone() {
        return new Plane(this.origin.clone(), this.xaxis.clone(), this.zaxis.clone());
    }
    
    applyMatrix4onPlane(matrix) {
        let newPlane = this.clone();
    
        newPlane.origin.applyMatrix4(matrix);
        const rotationMatrix = new THREE.Matrix4().extractRotation(matrix);
    
        newPlane.xaxis.applyMatrix4(rotationMatrix).normalize();
        newPlane.yaxis.applyMatrix4(rotationMatrix).normalize();
        newPlane.zaxis.applyMatrix4(rotationMatrix).normalize();
    
        return newPlane;
    }

    /**
     * Serialize plane axes.
     */
    toData() {
        return {
            origin: [this.origin.x, this.origin.y, this.origin.z],
            xaxis: [this.xaxis.x, this.xaxis.y, this.xaxis.z],
            yaxis: [this.yaxis.x, this.yaxis.y, this.yaxis.z],
            zaxis: [this.zaxis.x, this.zaxis.y, this.zaxis.z]
        };
    }

    /**
     * Build a plane from serialized data.
     *
     * Legacy payloads may provide xaxis + yaxis (without zaxis). In that case,
     * reconstruct zaxis so that the constructor recomputes the original yaxis.
     */
    static fromData(data) {
        const origin = new THREE.Vector3(data.origin[0], data.origin[1], data.origin[2]);
        const xaxis = new THREE.Vector3(data.xaxis[0], data.xaxis[1], data.xaxis[2]);

        let zaxis;
        if (Array.isArray(data.zaxis)) {
            zaxis = new THREE.Vector3(data.zaxis[0], data.zaxis[1], data.zaxis[2]);
        } else if (Array.isArray(data.yaxis)) {
            const legacyYaxis = new THREE.Vector3(data.yaxis[0], data.yaxis[1], data.yaxis[2]);
            // Choose z so that x x z reproduces the legacy y.
            zaxis = new THREE.Vector3().crossVectors(legacyYaxis, xaxis);
            if (zaxis.lengthSq() === 0) {
                throw new Error('Invalid plane data: xaxis and yaxis are collinear');
            }
        } else {
            throw new Error('Invalid plane data: expected zaxis or yaxis');
        }
        
        return new Plane(origin, xaxis, zaxis);
    }
}
