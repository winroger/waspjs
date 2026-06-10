import { describe, it, expect } from 'vitest';
import * as webwaspjs from '../index.js';

describe('package exports', () => {
  it('loads the public package entry point', () => {
    expect(webwaspjs.Aggregation).toBeTypeOf('function');
    expect(webwaspjs.Visualizer).toBeTypeOf('function');
    expect(webwaspjs.createAggregationFromData).toBeTypeOf('function');
  });
});
