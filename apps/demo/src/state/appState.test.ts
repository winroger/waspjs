import { describe, expect, it } from 'vitest';
import { demoReducer, initialDemoState } from './appState';

describe('demoReducer', () => {
  it('handles setLoaded transition', () => {
    const next = demoReducer(initialDemoState, {
      type: 'setLoaded',
      payload: { setName: 'BRIO', partsCount: 12, partIndex: 3 },
    });

    expect(next.currentSetName).toBe('BRIO');
    expect(next.partsCount).toBe(12);
    expect(next.partIndex).toBe(3);
  });

  it('handles mode, loading and color transitions', () => {
    const mode = demoReducer(initialDemoState, { type: 'setMode', payload: 'parts' });
    const loading = demoReducer(mode, { type: 'setLoading', payload: true });
    const color = demoReducer(loading, { type: 'setColor', payload: '#00ff00' });

    expect(color.currentMode).toBe('parts');
    expect(color.isLoading).toBe(true);
    expect(color.currentColor).toBe('#00ff00');
  });

  it('updates aggregation target count', () => {
    const next = demoReducer(initialDemoState, { type: 'setAggregationTargetCount', payload: 42 });
    expect(next.aggregationTargetCount).toBe(42);
  });
});
