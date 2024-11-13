import * as THREE from 'three';

export class Plane {
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

    toData() {
        return {
            origin: [this.origin.x, this.origin.y, this.origin.z],
            xaxis: [this.xaxis.x, this.xaxis.y, this.xaxis.z],
            yaxis: [this.yaxis.x, this.yaxis.y, this.yaxis.z]
        };
    }

    static fromData(data) {
        const origin = new THREE.Vector3(data.origin[0], data.origin[1], data.origin[2]);
        const xaxis = new THREE.Vector3(data.xaxis[0], data.xaxis[1], data.xaxis[2]);
        const zaxis = new THREE.Vector3(data.yaxis[0], data.yaxis[1], data.yaxis[2]);
        
        return new Plane(origin, xaxis, zaxis);
    }
}
