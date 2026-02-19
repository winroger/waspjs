// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { useDemoBootstrap } from './useDemoBootstrap';

const runtimeMock = {
  configure: vi.fn(),
  getAvailableSets: vi.fn(() => [
    {
      slug: 'example_brio_chamfer',
      name: 'BRIO',
      path: 'examples/example_brio_chamfer/',
      aggregation: 'aggregation.json',
      description: '',
      author: '',
      colors: [],
      byPart: {},
    },
    {
      slug: 'example_corner',
      name: 'CORNER',
      path: 'examples/example_corner/',
      aggregation: 'aggregation.json',
      description: '',
      author: '',
      colors: [],
      byPart: {},
    },
  ]),
  getCurrentPartIndex: vi.fn(() => 0),
  normalizeHex: vi.fn((value: string) => value),
  renderPart: vi.fn(),
  setMode: vi.fn(),
  updateCurrentPartColor: vi.fn(),
  renderSetPreview: vi.fn(),
  nudgeSetPreview: vi.fn(),
  updateSetPreviewNav: vi.fn(),
  warmPreview: vi.fn(async () => {}),
  loadSet: vi.fn(async () => {}),
  populateInfoModal: vi.fn(),
  setAggregationTargetCount: vi.fn(),
  disposeSetPreviewVisualizers: vi.fn(),
};

function HookHarness() {
  useDemoBootstrap(runtimeMock, 123);
  return null;
}

describe('useDemoBootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads initial set, warms previews, and disposes on unmount', async () => {
    const { unmount } = render(<HookHarness />);

    await waitFor(() => {
      expect(runtimeMock.loadSet).toHaveBeenCalledWith('BRIO', 123);
    });

    await waitFor(() => {
      expect(runtimeMock.warmPreview).toHaveBeenCalledTimes(2);
    });

    unmount();
    expect(runtimeMock.disposeSetPreviewVisualizers).toHaveBeenCalledTimes(1);
  });
});
