import {
  createAggregationFromData,
  getAggregationCatalogParts,
  applyAggregationColors,
  setAggregationPartCount,
  frameVisualizerToScene,
} from 'webwaspjs';

export const aggregationService = {
  createAggregationFromData,
  getAggregationCatalogParts,
  applyAggregationColors,
  setAggregationPartCount,
  frameVisualizerToScene,
};

export function centerCameraOnMesh(viz: any, mesh: any, distanceScale = 3) {
  const geom = mesh.geometry;
  if (!geom.boundingSphere) {
    geom.computeBoundingSphere();
  }
  const sphere = geom.boundingSphere;
  const radius = sphere.radius || 1;
  const center = sphere.center.clone().applyMatrix4(mesh.matrixWorld);
  const distance = radius * distanceScale;

  viz.camera.position.set(center.x + distance, center.y + distance, center.z + distance);
  if (viz.cameraControls) {
    viz.cameraControls.setLookAt(
      center.x + distance,
      center.y + distance,
      center.z + distance,
      center.x,
      center.y,
      center.z,
      false
    );
  }
}
