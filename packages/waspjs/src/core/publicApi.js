import { Box3, Vector3 } from 'three';
import { Aggregation } from './aggregation.js';

/**
 * @typedef {object} AggregationColors
 * @property {string[]=} colors
 * @property {string[]=} palette
 * @property {Record<string, string>=} byPart
 */

/**
 * Create an `Aggregation` instance from serialized data.
 * @param {object} data
 * @returns {Aggregation}
 */
export function createAggregationFromData(data) {
  return Aggregation.fromData(data);
}

/**
 * Return catalog/base parts from an aggregation.
 * @param {Aggregation} aggregation
 * @returns {Array}
 */
export function getAggregationCatalogParts(aggregation) {
  return Object.values(aggregation?.parts || {});
}

/**
 * Apply color mapping to all catalog/base parts.
 * @param {Aggregation} aggregation
 * @param {AggregationColors|null|undefined} colorsConfig
 */
export function applyAggregationColors(aggregation, colorsConfig) {
  if (!aggregation || !colorsConfig) return;
  const palette = colorsConfig.colors || colorsConfig.palette || [];
  const byPart = colorsConfig.byPart || {};
  const parts = getAggregationCatalogParts(aggregation);

  parts.forEach((part, idx) => {
    const color = byPart[part.name] || palette[idx % palette.length];
    if (color && part.geo?.material?.color) {
      part.geo.material.color.set(color);
    }
  });
}

/**
 * Resize rendered aggregation to target number of parts.
 * @param {Aggregation} aggregation
 * @param {number} targetCount
 * @param {object} visualizer
 * @returns {Promise<void>}
 */
export async function setAggregationPartCount(aggregation, targetCount, visualizer) {
  if (!aggregation || !visualizer) return;
  await aggregation.modifyParts(targetCount, visualizer);
}

/**
 * Frame a visualizer camera on all scene contents.
 * @param {object} visualizer
 * @param {number=} distanceScale
 */
export function frameVisualizerToScene(visualizer, distanceScale = 0.8) {
  if (!visualizer?.scene || !visualizer?.camera) return;

  const box = new Box3().setFromObject(visualizer.scene);
  if (!isFinite(box.max.x) || box.isEmpty()) return;

  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const distance = maxDim * distanceScale;

  visualizer.camera.position.set(center.x + distance, center.y + distance, center.z + distance);

  if (visualizer.cameraControls) {
    visualizer.cameraControls.setLookAt(
      center.x + distance,
      center.y + distance,
      center.z + distance,
      center.x,
      center.y,
      center.z,
      false
    );
  } else {
    visualizer.camera.lookAt(center);
  }
}
