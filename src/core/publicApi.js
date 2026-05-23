import { Aggregation } from './aggregation.js';

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
 * Compute valid placements scoped to a single parent part.
 * Much cheaper than a full aggregation-wide placement search at scale.
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
 * Set which part types are allowed for random aggregation.
 * Pass null to allow all parts.
 * @param {Aggregation} aggregation
 * @param {string[]|null} partNames
 */
export function setActivePartTypes(aggregation, partNames) {
  if (!aggregation) return;
  aggregation.setActivePartTypes(partNames);
}
