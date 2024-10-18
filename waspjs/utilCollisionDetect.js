import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';

// Add the accelerated raycast function to the raycaster
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export function checkMeshesIntersection(mesh1, mesh2) {
  // Ensure the geometries have the necessary index and attributes for BVH
  if (!mesh1.geometry.boundsTree) {
    mesh1.geometry.boundsTree = new MeshBVH(mesh1.geometry);
  }
  if (!mesh2.geometry.boundsTree) {
    mesh2.geometry.boundsTree = new MeshBVH(mesh2.geometry);
  }

  // Create a transformation matrix from mesh1 to mesh2
  const transformMatrix = new THREE.Matrix4();
  transformMatrix.copy(mesh2.matrixWorld).invert().multiply(mesh1.matrixWorld);

  // Check for intersection using BVH
  const intersects = mesh2.geometry.boundsTree.intersectsGeometry(mesh1.geometry, transformMatrix);

  return intersects;
}