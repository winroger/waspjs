import { Aggregation } from '../core/aggregation.js';

/**
 * Build an aggregation directly from structured data.
 */
export function buildAggregationFromData(aggregationData) {
  return Aggregation.fromData(aggregationData);
}