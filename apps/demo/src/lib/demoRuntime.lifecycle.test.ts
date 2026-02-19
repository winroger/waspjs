// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cameraDisposeSpies: Array<ReturnType<typeof vi.fn>> = [];
const rendererDisposeSpies: Array<ReturnType<typeof vi.fn>> = [];

vi.mock('webwaspjs', () => {
  class Visualizer {
    public cameraControls: { enabled: boolean; dispose: () => void };
    public scene: {
      add: (obj: any) => void;
      remove: (obj: any) => void;
      traverse: (cb: (obj: any) => void) => void;
    };
    public renderer: { domElement: HTMLCanvasElement; dispose: () => void };
    public camera = { position: { set: () => {} } };

    constructor(selector: string) {
      const cameraDispose = vi.fn();
      const rendererDispose = vi.fn();
      cameraDisposeSpies.push(cameraDispose);
      rendererDisposeSpies.push(rendererDispose);

      this.cameraControls = { enabled: true, dispose: cameraDispose };

      const disposableObject = {
        geometry: { dispose: vi.fn() },
        material: { dispose: vi.fn() },
      };

      this.scene = {
        add: () => {},
        remove: () => {},
        traverse: cb => cb(disposableObject),
      };

      const canvas = document.createElement('canvas');
      const host = document.querySelector(selector);
      if (host) host.appendChild(canvas);

      this.renderer = {
        domElement: canvas,
        dispose: rendererDispose,
      };
    }
  }

  return { Visualizer };
});

vi.mock('../config/availableSets', () => ({
  availableSets: [
    {
      slug: 'test-set',
      name: 'Test Set',
      description: '',
      author: '',
      path: 'examples/test-set/',
      aggregation: 'aggregation.json',
      colors: [],
      byPart: {},
    },
  ],
}));

vi.mock('./aggregationService', () => ({
  aggregationService: {
    createAggregationFromData: vi.fn(() => ({})),
    applyAggregationColors: vi.fn(),
    getAggregationCatalogParts: vi.fn(() => [
      {
        name: 'PartA',
        geo: {
          clone: () => ({
            name: '',
            material: { color: { set: vi.fn() } },
            geometry: { computeBoundingSphere: vi.fn(), boundingSphere: { radius: 1, center: { clone: () => ({ applyMatrix4: () => ({ x: 0, y: 0, z: 0 }) }) } } },
            matrixWorld: {},
          }),
        },
      },
    ]),
    setAggregationPartCount: vi.fn(),
    frameVisualizerToScene: vi.fn(),
  },
  centerCameraOnMesh: vi.fn(),
}));

describe('demoRuntime visualizer lifecycle', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="set-preview-test-set"></div><div id="setList"></div>';
    cameraDisposeSpies.length = 0;
    rendererDisposeSpies.length = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch,
    );
  });

  it('disposes preview visualizers and renderer resources', async () => {
    const runtimeModule = await import('./demoRuntime');
    const runtime = runtimeModule.createDemoRuntime();

    await runtime.warmPreview({
      slug: 'test-set',
      name: 'Test Set',
      description: '',
      author: '',
      path: 'examples/test-set/',
      aggregation: 'aggregation.json',
      colors: [],
      byPart: {},
    });

    expect(cameraDisposeSpies.length).toBeGreaterThan(0);
    expect(rendererDisposeSpies.length).toBeGreaterThan(0);

    runtime.disposeSetPreviewVisualizers();

    expect(cameraDisposeSpies[0]).toHaveBeenCalledTimes(1);
    expect(rendererDisposeSpies[0]).toHaveBeenCalledTimes(1);
  });
});
