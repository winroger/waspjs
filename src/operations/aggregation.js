/**
 * WaspJS — aggregation convenience operations.
 * JS-specific helpers: delegate to core behavior and expose inspection results.
 * No Grasshopper UI or application state is owned here; src/index.js is the
 * public package entry point. This module is not a complete aggregation API.
 */
import { Aggregation } from '../core/aggregation.js';

/**
 * JS-specific helper: create an `Aggregation` instance from serialized data.
 * @param {import('../types/index.js').AggregationData} data
 * @returns {Aggregation}
 */
export function createAggregationFromData(data) {
  return Aggregation.fromData(data);
}

/**
 * JS-specific helper: return catalog/base parts from an aggregation.
 * @param {Aggregation} aggregation
 * @returns {import('../core/part.js').Part[]}
 */
export function getAggregationCatalogParts(aggregation) {
  return Object.values(aggregation?.parts || {});
}

/**
 * JS-specific helper: compute valid placements scoped to a single parent part.
 * Limits the search to that parent; no aggregation-wide scan of connection slots.
 * @param {Aggregation} aggregation
 * @param {string} partName
 * @param {number|string} parentPartId
 * @returns {Array<{parentPartId: number|string, connectionId: number, partName: string, connectionBId: number, ruleIndex: number, transform: import('three').Matrix4, transformedPart: import('../core/part.js').Part}>}
 */
export function getValidPlacementsAtParent(aggregation, partName, parentPartId) {
  if (!aggregation) return [];
  return aggregation.getValidPlacementsAtParent(partName, parentPartId);
}

/**
 * JS-specific helper: compute valid placements at a single connection slot.
 * Evaluates rules for one connection.
 * @param {Aggregation} aggregation
 * @param {string} partName
 * @param {number|string} parentPartId
 * @param {number} connectionId
 * @returns {Array<{parentPartId: number|string, connectionId: number, partName: string, connectionBId: number, ruleIndex: number, transform: import('three').Matrix4, transformedPart: import('../core/part.js').Part}>}
 */
export function getValidPlacementsAtConnection(aggregation, partName, parentPartId, connectionId) {
  if (!aggregation) return [];
  return aggregation.getValidPlacementsAtConnection(partName, parentPartId, connectionId);
}

/**
 * JS-specific helper: get active connection slots for one Part. Unlike Aggregation.getOpenConnections,
 * each result exposes its full live rules_table, not only active_rules entries.
 * @param {Aggregation} aggregation
 * @param {number|string} parentPartId
 * @returns {Array<{partId: number|string, connectionId: number, plane: object, type: string, rules: Array}>}
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
 * JS-specific helper: set which part types are allowed for random aggregation.
 * Pass null to allow all parts.
 * @param {Aggregation} aggregation
 * @param {string[]|null} partNames
 * @returns {void}
 */
export function setActivePartTypes(aggregation, partNames) {
  if (!aggregation) return;
  aggregation.setActivePartTypes(partNames);
}
