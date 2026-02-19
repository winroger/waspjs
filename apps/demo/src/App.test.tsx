// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';
import * as runtime from './lib/demoRuntime';

vi.mock('./hooks/useDemoBootstrap', () => ({
  useDemoBootstrap: vi.fn(),
}));

const runtimeInstanceMock = {
  configure: vi.fn(),
  getAvailableSets: vi.fn(() => [
    {
      slug: 'example_brio_chamfer',
      name: 'BRIO',
      description: 'Example set',
      author: 'Tester',
      path: 'examples/example_brio_chamfer/',
      aggregation: 'aggregation.json',
      colors: [],
      byPart: {},
    },
  ]),
  getCurrentPartIndex: vi.fn(() => 0),
  loadSet: vi.fn(async () => {}),
  nudgeSetPreview: vi.fn(),
  normalizeHex: vi.fn((value: string) => value),
  populateInfoModal: vi.fn(),
  renderPart: vi.fn(),
  setAggregationTargetCount: vi.fn(),
  setMode: vi.fn(),
  updateCurrentPartColor: vi.fn(),
  warmPreview: vi.fn(async () => {}),
  renderSetPreview: vi.fn(),
  updateSetPreviewNav: vi.fn(),
  disposeSetPreviewVisualizers: vi.fn(),
};

vi.mock('./lib/demoRuntime', () => ({
  createDemoRuntime: vi.fn(() => runtimeInstanceMock),
  normalizeHex: vi.fn((value: string) => value),
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mounts and wires runtime callbacks', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: 'Open datasets' })).toBeTruthy();
    expect(runtime.createDemoRuntime).toHaveBeenCalledTimes(1);
    expect(runtimeInstanceMock.configure).toHaveBeenCalledTimes(1);
  });

  it('opens and closes dataset overlay from navbar', () => {
    render(<App />);

    const overlayRoot = document.querySelector('.dataset-overlay');
    expect(overlayRoot?.getAttribute('aria-hidden')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Open datasets' }));
    expect(overlayRoot?.getAttribute('aria-hidden')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Close datasets' }));
    expect(overlayRoot?.getAttribute('aria-hidden')).toBe('true');
  });

  it('handles core controls (mode, slider, set switch, color)', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Parts' }));
    expect(runtimeInstanceMock.setMode).toHaveBeenCalledWith('parts');

    fireEvent.change(screen.getByLabelText('Parts'), { target: { value: '77' } });
    expect(runtimeInstanceMock.setAggregationTargetCount).toHaveBeenCalledWith(77);

    fireEvent.click(screen.getByRole('button', { name: /BRIO/i }));
    await waitFor(() => {
      expect(runtimeInstanceMock.loadSet).toHaveBeenCalledWith('BRIO', 77);
    });

    fireEvent.change(screen.getByLabelText('Pick part color'), { target: { value: '#abcdef' } });
    expect(runtimeInstanceMock.normalizeHex).toHaveBeenCalledWith('#abcdef');
    expect(runtimeInstanceMock.updateCurrentPartColor).toHaveBeenCalledWith('#abcdef');
  });
});
