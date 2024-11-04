import * as THREE from 'three';
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