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

// ── Manual Placement API ──────────────────────────────────────

/**
 * Get all open connections in the aggregation.
 * @deprecated Prefer `getOpenConnectionsForPart` in interactive/manual workflows.
 * @param {Aggregation} aggregation
 * @returns {Array<{partId: number, connectionId: number, plane: object, type: string, rules: Array}>}
 */
export function getOpenConnections(aggregation) {
  if (!aggregation) return [];
  return aggregation.getOpenConnections();
}

/**
 * Compute all valid placements for a given part type (collision-checked).
 * @deprecated Prefer `getValidPlacementsAtParent` or `getValidPlacementsAtConnection`
 * in interactive/manual workflows for better performance.
 * @param {Aggregation} aggregation
 * @param {string} partName
 * @returns {Array}
 */
export function getValidPlacements(aggregation, partName) {
  if (!aggregation) return [];
  return aggregation.getValidPlacementsForPart(partName);
}

/**
 * Compute valid placements scoped to a single parent part.
 * Much cheaper than getValidPlacements at scale.
 * @param {Aggregation} aggregation
 * @param {string} partName
 * @param {number} parentPartId
 * @returns {Array}
 */
export function getValidPlacementsAtParent(aggregation, partName, parentPartId) {
  if (!aggregation) return [];
  return aggregation.getValidPlacementsAtParent(partName, parentPartId);
}

/**
 * Compute valid placements at a single connection slot.
 * Cheapest option — only evaluates rules for one connection.
 * @param {Aggregation} aggregation
 * @param {string} partName
 * @param {number} parentPartId
 * @param {number} connectionId
 * @returns {Array}
 */
export function getValidPlacementsAtConnection(aggregation, partName, parentPartId, connectionId) {
  if (!aggregation) return [];
  return aggregation.getValidPlacementsAtConnection(partName, parentPartId, connectionId);
}

/**
 * Get open connections for a single parent part.
 * @param {Aggregation} aggregation
 * @param {number} parentPartId
 * @returns {Array<{partId: number, connectionId: number, plane: object, type: string, rules: Array}>}
 */
export function getOpenConnectionsForPart(aggregation, parentPartId) {
  if (!aggregation) return [];
  const part = aggregation.aggregated_parts.find(p => p.id === parentPartId);
  if (!part) return [];
  return part.active_connections.map(connIdx => {
    const conn = part.connections[connIdx];
    return {
      partId: part.id,
      connectionId: connIdx,
      plane: conn.pln,
      type: conn.type,
      rules: conn.rules_table,
    };
  });
}

/**
 * Place the first part in an empty aggregation (manual mode).
 * @param {Aggregation} aggregation
 * @param {string} partName
 * @param {object} [visualizer]
 * @returns {{ success: boolean, part?: object, error?: string }}
 */
export function placeFirstPartManually(aggregation, partName, visualizer) {
  if (!aggregation) return { success: false, error: 'No aggregation' };
  const result = aggregation.placeFirstPart(partName);
  if (result.success && visualizer) {
    visualizer.addEntity(result.part);
  }
  return result;
}

/**
 * Place a specific part at a specific connection (manual mode).
 * @param {Aggregation} aggregation
 * @param {number} parentPartId
 * @param {number} connectionId
 * @param {string} partName
 * @param {number} connectionBId
 * @param {object} [visualizer]
 * @returns {{ success: boolean, part?: object, error?: string }}
 */
export function placePartManually(aggregation, parentPartId, connectionId, partName, connectionBId, visualizer) {
  if (!aggregation) return { success: false, error: 'No aggregation' };
  const result = aggregation.placePartAtConnection(parentPartId, connectionId, partName, connectionBId);
  if (result.success && visualizer) {
    visualizer.addEntity(result.part);
  }
  return result;
}

/**
 * Remove a leaf part by ID from the aggregation and the visualizer.
 * Only parts with no children (end-of-chain) can be removed.
 * @param {Aggregation} aggregation
 * @param {number} partId
 * @param {object} [visualizer]
 * @returns {boolean}
 */
export function removePartById(aggregation, partId, visualizer) {
  if (!aggregation) return false;
  const part = aggregation.aggregated_parts.find(p => p.id === partId);
  if (!part) return false;
  if (part.children && part.children.length > 0) return false;
  if (visualizer) {
    visualizer.removeEntity(part);
  }
  return aggregation.removePartFromAggregation(partId);
}

/**
 * Set which part types are allowed for random aggregation.
 * Pass null to allow all parts.
 * @param {Aggregation} aggregation
 * @param {string[]|null} partNames
 */
export function setActivePartTypes(aggregation, partNames) {
  if (!aggregation) return;
  aggregation.setActivePartTypes(partNames);
}
