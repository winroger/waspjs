import * as THREE from 'three';
import { Rule } from './rule';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';


/**
 * Check if two meshes intersect using BVH-accelerated geometry test.
 */
if (THREE.Mesh.prototype.raycast !== acceleratedRaycast) {
  THREE.Mesh.prototype.raycast = acceleratedRaycast;
}
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

/**
 * Convert a mesh to plain vertex/face data (supports BufferGeometry).
 */
export function meshToData(mesh) {
  const geom = mesh.geometry;
  const data = { vertices: [], faces: [] };

  if (geom.isBufferGeometry) {
    const pos = geom.getAttribute('position');
    const index = geom.getIndex();
    for (let i = 0; i < pos.count; i++) {
      data.vertices.push([pos.getX(i), pos.getY(i), pos.getZ(i)]);
    }
    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        data.faces.push([index.getX(i), index.getX(i + 1), index.getX(i + 2)]);
      }
    } else {
      for (let i = 0; i < pos.count; i += 3) {
        data.faces.push([i, i + 1, i + 2]);
      }
    }
    return data;
  }

  // Legacy Geometry path
  geom.vertices.forEach(v => data.vertices.push([v.x, v.y, v.z]));
  geom.faces.forEach(f => {
    const face = [f.a, f.b, f.c];
    if (f.d !== undefined) face.push(f.d);
    data.faces.push(face);
  });
  return data;
}

/**
 * Create a mesh from plain vertex/face data.
 */
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

/**
 * Convert a Matrix4 to a plain object representation.
 */
export function transformToData(trans) {
  const e = trans.elements; // column-major
  return {
    M00: e[0], M01: e[4], M02: e[8],  M03: e[12],
    M10: e[1], M11: e[5], M12: e[9],  M13: e[13],
    M20: e[2], M21: e[6], M22: e[10], M23: e[14],
    M30: e[3], M31: e[7], M32: e[11], M33: e[15]
  };
}

/**
 * Rebuild a Matrix4 from plain object data.
 */
export function transformFromData(data) {
  const m = [
    parseFloat(data.M00), parseFloat(data.M01), parseFloat(data.M02), parseFloat(data.M03),
    parseFloat(data.M10), parseFloat(data.M11), parseFloat(data.M12), parseFloat(data.M13),
    parseFloat(data.M20), parseFloat(data.M21), parseFloat(data.M22), parseFloat(data.M23),
    parseFloat(data.M30), parseFloat(data.M31), parseFloat(data.M32), parseFloat(data.M33)
  ];

  const matrix = new THREE.Matrix4();
  matrix.set(
    m[0], m[1], m[2], m[3],
    m[4], m[5], m[6], m[7],
    m[8], m[9], m[10], m[11],
    m[12], m[13], m[14], m[15]
  );

  return matrix;
}

/**
 * Calculate a transform that orients sourcePlane to targetPlane.
 */
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


/**
 * Generate connection rules for a set of parts when none are provided.
 */
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
                if (!selfConnection && part.name === otherPart.name && conn.id === otherConn.id) {
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