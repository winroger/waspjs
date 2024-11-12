import * as THREE from 'three';
import { Rule } from './waspRules';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';

THREE.Mesh.prototype.raycast = acceleratedRaycast;

export function checkMeshesIntersection(mesh1, mesh2) {
    if (!mesh1.geometry.boundsTree) {
      mesh1.geometry.boundsTree = new MeshBVH(mesh1.geometry);
    }
    if (!mesh2.geometry.boundsTree) {
      mesh2.geometry.boundsTree = new MeshBVH(mesh2.geometry);
    }
  
    const transformMatrix = new THREE.Matrix4();
    transformMatrix.copy(mesh2.matrixWorld).invert().multiply(mesh1.matrixWorld);
  
    const intersects = mesh2.geometry.boundsTree.intersectsGeometry(mesh1.geometry, transformMatrix);
  
    return intersects;
  }

// Utility function to convert a mesh to data
export function meshToData(mesh) {
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
export function meshFromData(data) {
    const geometry = new THREE.BufferGeometry();

    const vertices = [];
    const indices = [];

    data.vertices.forEach(v => {
        vertices.push(v[0], v[1], v[2]);
    });

    data.faces.forEach(f => {
        if (f.length === 3) {
            indices.push(f[0], f[1], f[2]);
        } else if (f.length === 4) {
            indices.push(f[0], f[1], f[2], f[0], f[2], f[3]);
        }
    });
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);

    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });

    return new THREE.Mesh(geometry, material);
}

// Utility function to convert a transformation matrix to data
export function transformToData(trans) {
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
export function transformFromData(data) {
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

    return matrix;
}

export function newPlaneToPlane(sourcePlane, targetPlane) {
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


  
export function generateRules(parts, selfPart = true, selfConnection = false, useTypes = false, grammar = []) {
    const rules = [];
  
    if (grammar.length === 0) {
      for (const part of parts) {
        for (const conn of part.connections) {
          for (const otherPart of parts) {
            let skipPart = false;
            if (!selfPart && part.name === otherPart.name) {
              skipPart = true;
            }
  
            if (!skipPart) {
              for (const otherConn of otherPart.connections) {
                let skipConn = false;
                if (!selfConnection && conn.id === otherConn.id) {
                  skipConn = true;
                }
  
                if (!skipConn) {
                  if (useTypes) {
                    if (conn.type === otherConn.type) {
                      rules.push(new Rule(part.name, conn.id, otherPart.name, otherConn.id));
                    }
                  } else {
                    rules.push(new Rule(part.name, conn.id, otherPart.name, otherConn.id));
                  }
                }
              }
            }
          }
        }
      }
    } else {
      for (const gr_rule of grammar) {
        const [startType, endType] = gr_rule.split(">");
        for (const part of parts) {
          for (const conn of part.connections) {
            if (conn.type === startType) {
              for (const otherPart of parts) {
                let skipPart = false;
                if (!selfPart && part.name === otherPart.name) {
                  skipPart = true;
                }
  
                if (!skipPart) {
                  for (const otherConn of otherPart.connections) {
                    if (otherConn.type === endType) {
                      let skipConn = false;
                      if (!selfConnection && conn.id === otherConn.id) {
                        skipConn = true;
                      }
  
                      if (!skipConn) {
                        rules.push(new Rule(part.name, conn.id, otherPart.name, otherConn.id));
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  
    return rules;
  }