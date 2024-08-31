class Plane {
    constructor(origin, xaxis, yaxis) {
        this.origin = origin.clone();
        this.xaxis = xaxis.clone().normalize();
        this.yaxis = yaxis.clone().normalize();
        this.zaxis = new THREE.Vector3().crossVectors(this.xaxis, this.yaxis).normalize();
    }

    clone() {
        return new Plane(this.origin.clone(), this.xaxis.clone(), this.yaxis.clone());
    }
    
    applyMatrix4onPlane(matrix) {
        let newPlane = this.clone();
        
        // Apply the matrix to origin, xaxis, and yaxis vectors
        newPlane.origin.applyMatrix4(matrix);
        newPlane.xaxis.applyMatrix4(matrix).normalize();
        newPlane.yaxis.applyMatrix4(matrix).normalize();
        
        // Recalculate the zaxis to ensure orthogonality
        newPlane.zaxis = new THREE.Vector3().crossVectors(newPlane.xaxis, newPlane.yaxis).normalize();
        
        return newPlane; // Return the modified Plane object
    }
}



// Utility function to convert a plane to data
function planeToData(plane) {
    return {
        origin: [plane.origin.x, plane.origin.y, plane.origin.z],
        xaxis: [plane.xaxis.x, plane.xaxis.y, plane.xaxis.z],
        yaxis: [plane.yaxis.x, plane.yaxis.y, plane.yaxis.z]
    };
}

// Utility function to create a plane from data
function planeFromData(data) {
    const origin = new THREE.Vector3(data.origin[0], data.origin[1], data.origin[2]);
    const xaxis = new THREE.Vector3(data.xaxis[0], data.xaxis[1], data.xaxis[2]);
    const yaxis = new THREE.Vector3(data.yaxis[0], data.yaxis[1], data.yaxis[2]);
    
    const newPlane = new Plane(origin, xaxis, yaxis);
    //console.log("new Plane: ", newPlane)
    return newPlane
}