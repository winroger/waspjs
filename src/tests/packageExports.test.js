import { describe, it, expect } from 'vitest';
import * as webwaspjs from '../index.js';
import * as aggregationOperations from '../operations/aggregation.js';
import * as previousSourceModule from '../core/publicApi.js';

describe('package exports', () => {
  it.each([
    'createAggregationFromData',
    'getAggregationCatalogParts',
    'getValidPlacementsAtParent',
    'getValidPlacementsAtConnection',
    'getOpenConnectionsForPart',
    'setActivePartTypes',
  ])('preserves %s as one function across package, operations and old source imports', name => {
    const operation = Reflect.get(aggregationOperations, name);
    expect(operation).toBeTypeOf('function');
    expect(Reflect.get(webwaspjs, name)).toBe(operation);
    expect(Reflect.get(previousSourceModule, name)).toBe(operation);
  });

  it('loads the public package entry point', () => {
    expect(webwaspjs.Aggregation).toBeTypeOf('function');
    expect(webwaspjs.Visualizer).toBeTypeOf('function');
    expect(webwaspjs.createAggregationFromData).toBeTypeOf('function');
  });
});
