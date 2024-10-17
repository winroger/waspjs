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
    
        // Apply the transformation matrix to the origin
        newPlane.origin.applyMatrix4(matrix);
    
        // Extract the rotation part of the matrix
        const rotationMatrix = new THREE.Matrix4().extractRotation(matrix);
    
        // Apply the rotation matrix to the axes
        newPlane.xaxis.applyMatrix4(rotationMatrix).normalize();
        newPlane.yaxis.applyMatrix4(rotationMatrix).normalize();
        newPlane.zaxis.applyMatrix4(rotationMatrix).normalize();
    
        return newPlane;
    }
}



// Utility function to convert a plane to data
export function planeToData(plane) {
    return {
        origin: [plane.origin.x, plane.origin.y, plane.origin.z],
        xaxis: [plane.xaxis.x, plane.xaxis.y, plane.xaxis.z],
        yaxis: [plane.yaxis.x, plane.yaxis.y, plane.yaxis.z]
    };
}

// Utility function to create a plane from data
export function planeFromData(data) {
    const origin = new THREE.Vector3(data.origin[0], data.origin[1], data.origin[2]);
    const xaxis = new THREE.Vector3(data.xaxis[0], data.xaxis[1], data.xaxis[2]);
    const zaxis = new THREE.Vector3(data.yaxis[0], data.yaxis[1], data.yaxis[2]);
    
    const newPlane = new Plane(origin, xaxis, zaxis);
    //console.log("new Plane: ", newPlane)
    return newPlane
}