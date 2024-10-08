function readJSONFiles(files) {
    const datasets = [];
    const promises = [];

    for (const file of files) {
        const promise = new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = event => {
                try {
                    const jsonData = JSON.parse(event.target.result);
                    datasets.push(jsonData);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });

        promises.push(promise);
    }

    return Promise.all(promises).then(() => datasets);
}


// Utility function to convert a mesh to data
function meshToData(mesh) {
    const data = {};
    const vertices = [];
    mesh.geometry.vertices.forEach(v => {
        vertices.push([v.x, v.y, v.z]);
    });
    data.vertices = vertices;

    const faces = [];
    mesh.geometry.faces.forEach(f => {
        const face = [f.a, f.b, f.c];
        if (f.d !== undefined) {
            face.push(f.d);
        }
        faces.push(face);
    });
    data.faces = faces;

    return data;
}

// Utility function to create a mesh from data
function meshFromData(data) {
    const geometry = new THREE.BufferGeometry();

    // Flattened arrays for vertices and indices
    const vertices = [];
    const indices = [];

    // Populate vertices array
    data.vertices.forEach(v => {
        vertices.push(v[0], v[1], v[2]);
    });

    // Populate indices array
    data.faces.forEach(f => {
        if (f.length === 3) {
            // Triangle face
            indices.push(f[0], f[1], f[2]);
        } else if (f.length === 4) {
            // Quad face, split into two triangles
            indices.push(f[0], f[1], f[2], f[0], f[2], f[3]);
        }
    });

    // Set the vertices and indices on the geometry
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);

    // Compute normals
    geometry.computeVertexNormals();

    // Create the mesh with a basic material
    //const material = new THREE.MeshNormalMaterial();
    const material = new THREE.MeshStandardMaterial({
        color: 0xFFFFFF, // White color
        roughness: 0.5, // Controls how rough the surface appears
        metalness: 0.5, // Controls how metallic the surface appears
    });
    return new THREE.Mesh(geometry, material);
}

// Utility function to convert a transformation matrix to data
function transformToData(trans) {
    return {
        M00: trans.elements[0],
        M01: trans.elements[1],
        M02: trans.elements[2],
        M03: trans.elements[3],
        M10: trans.elements[4],
        M11: trans.elements[5],
        M12: trans.elements[6],
        M13: trans.elements[7],
        M20: trans.elements[8],
        M21: trans.elements[9],
        M22: trans.elements[10],
        M23: trans.elements[11],
        M30: trans.elements[12],
        M31: trans.elements[13],
        M32: trans.elements[14],
        M33: trans.elements[15]
    };
}

// Utility function to create a transformation matrix from data
function transformFromData(data) {
    //console.log(data)
    const trans = [
        parseFloat(data.M00), parseFloat(data.M01), parseFloat(data.M02), parseFloat(data.M03),
        parseFloat(data.M10), parseFloat(data.M11), parseFloat(data.M12), parseFloat(data.M13),
        parseFloat(data.M20), parseFloat(data.M21), parseFloat(data.M22), parseFloat(data.M23),
        parseFloat(data.M30), parseFloat(data.M31), parseFloat(data.M32), parseFloat(data.M33)
    ];
    
    // Create a THREE.Matrix4 and set its elements from the trans array
    const matrix = new THREE.Matrix4();
    matrix.set(
        trans[0], trans[1], trans[2], trans[3],
        trans[4], trans[5], trans[6], trans[7],
        trans[8], trans[9], trans[10], trans[11],
        trans[12], trans[13], trans[14], trans[15]
    );

    //matrix.multiplyMatrices(swapMatrix, matrix);

    // Return the resulting matrix
    return matrix;
}

/*
function customPlaneToPlane(sourcePlane, targetPlane) {
    // Create rotation matrix
    const sourceZ = new THREE.Vector3().crossVectors(sourcePlane.xaxis, sourcePlane.yaxis).normalize();
    const targetZ = new THREE.Vector3().crossVectors(targetPlane.xaxis, targetPlane.yaxis).normalize();
    
    const sourceMatrix = new THREE.Matrix4().makeBasis(sourcePlane.xaxis, sourcePlane.yaxis, sourceZ);
    const targetMatrix = new THREE.Matrix4().makeBasis(targetPlane.xaxis, targetPlane.yaxis, targetZ);
    
    const rotationMatrix = new THREE.Matrix4().copy(sourceMatrix).invert().multiply(targetMatrix);

    // Create translation matrix
    const translationMatrix = new THREE.Matrix4().makeTranslation(
      targetPlane.origin.x,
      targetPlane.origin.y,
      targetPlane.origin.z
    );
    
    // Combine rotation and translation matrices
    const transformationMatrix = new THREE.Matrix4()
      .multiply(rotationMatrix)
      .multiply(translationMatrix); 

    return transformationMatrix;
}

*/
function newPlaneToPlane(sourcePlane, targetPlane) {
    //console.log("STARTING PLANE: ", sourcePlane);
    //console.log("TARGET PLANE: ", targetPlane);

    // Create transformation matrix from source plane to target plane
    const sourceMatrix = new THREE.Matrix4();
    sourceMatrix.makeBasis(
        sourcePlane.xaxis.clone().normalize(),
        sourcePlane.yaxis.clone().normalize(),
        sourcePlane.zaxis.clone().normalize()
    );
    sourceMatrix.setPosition(sourcePlane.origin.clone());

    const targetMatrix = new THREE.Matrix4();
    targetMatrix.makeBasis(
        targetPlane.xaxis.clone().normalize(),
        targetPlane.yaxis.clone().normalize(),
        targetPlane.zaxis.clone().normalize()
    );
    targetMatrix.setPosition(targetPlane.origin.clone());

    const transformMatrix = new THREE.Matrix4();
    transformMatrix.copy(targetMatrix).multiply(sourceMatrix.invert());

    return transformMatrix;
}