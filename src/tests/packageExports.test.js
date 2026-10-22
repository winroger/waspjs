import { describe, it, expect } from 'vitest';
import * as webwaspjs from '../index.js';
import * as aggregationCore from '../core/aggregation.js';

describe('package exports', () => {
  it.each([
    'createAggregationFromData',
    'getAggregationCatalogParts',
    'getValidPlacementsAtParent',
    'getValidPlacementsAtConnection',
    'getOpenConnectionsForPart',
    'setActivePartTypes',
  ])('does not expose the removed %s function', name => {
    expect(webwaspjs).not.toHaveProperty(name);
    expect(aggregationCore).not.toHaveProperty(name);
  });

  it('loads the public package entry point', () => {
    expect(webwaspjs.Aggregation).toBeTypeOf('function');
    expect(webwaspjs.Visualizer).toBeTypeOf('function');
    expect(webwaspjs.Aggregation).toBe(aggregationCore.Aggregation);
  });
});
