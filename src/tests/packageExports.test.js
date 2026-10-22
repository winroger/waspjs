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
  ])('preserves %s as a core-local compatibility function', name => {
    const operation = Reflect.get(aggregationCore, name);
    expect(operation).toBeTypeOf('function');
    expect(Reflect.get(webwaspjs, name)).toBe(operation);
  });

  it('loads the public package entry point', () => {
    expect(webwaspjs.Aggregation).toBeTypeOf('function');
    expect(webwaspjs.Visualizer).toBeTypeOf('function');
    expect(webwaspjs.createAggregationFromData).toBeTypeOf('function');
  });
});
