import { Aggregation } from '../core/aggregation.js';

/**
 * Build an aggregation directly from structured data.
 */
export function buildAggregationFromData(aggregationData) {
  return Aggregation.fromData(aggregationData);
}

/**
 * Build an aggregation from a JSON string or object.
 */
export function buildAggregationFromJson(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  return buildAggregationFromData(data);
}