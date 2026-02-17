import { Aggregation } from '../core/aggregation.js';
import { Part } from '../core/part.js';
import { Rule } from '../core/rule.js';
import { generateRules } from '../core/utilities.js';

const colorMap = {
  0: 0xF5F5DC,
  1: 0xDEB887,
  2: 0xD2B48C,
  3: 0xF5DEB3,
  4: 0xFFE4C4,
};

/**
 * Build an aggregation from serialized part data and optional rule data.
 */
export function buildAggregationFromPartsAndRules({
  name = 'aggregation',
  partsData = [],
  rulesData = null,
  autoGenerateRules = true,
  allowSelf = true,
  allowSelfConnection = false,
  useTypes = true,
  seed = null,
} = {}) {
  const parts = partsData.map((data, idx) => {
    const part = Part.fromData(data);
    part.assignId(idx);
    if (part.geo?.material?.color) {
      part.geo.material.color.setHex(colorMap[idx % 10] || colorMap[0]);
    }
    return part;
  });

  let rules = [];
  if (rulesData && rulesData.length) {
    rules = rulesData.map(rule => Rule.fromData(rule));
  } else if (autoGenerateRules) {
    rules = generateRules(parts, allowSelf, allowSelfConnection, useTypes);
  }

  const aggregation = new Aggregation(name, parts, rules, seed);

  return { aggregation, parts, rules };
}