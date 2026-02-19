import { Visualizer } from 'webwaspjs';
import { availableSets, type DemoSetConfig } from '../config/availableSets';
import { aggregationService, centerCameraOnMesh } from './aggregationService';

export type DemoMode = 'aggregation' | 'parts';

type RuntimeCallbacks = {
  onSetLoaded?: (payload: { setName: string; partsCount: number; partIndex: number }) => void;
  onPartChanged?: (payload: { partIndex: number; partsCount: number }) => void;
  onLoadingChanged?: (payload: { isLoading: boolean; message?: string }) => void;
  onColorChanged?: (payload: { hex: string }) => void;
  onModeChanged?: (payload: { mode: DemoMode }) => void;
};

export type DemoRuntime = {
  configure: (callbacks: RuntimeCallbacks) => void;
  getAvailableSets: () => DemoSetConfig[];
  getCurrentPartIndex: () => number;
  normalizeHex: (value: string) => string;
  renderPart: (nextIndex: number) => void;
  setMode: (mode: DemoMode) => void;
  updateCurrentPartColor: (hex: string) => void;
  renderSetPreview: (setName: string, nextIndex?: number) => void;
  nudgeSetPreview: (setName: string, delta: number) => void;
  updateSetPreviewNav: (setName: string) => void;
  warmPreview: (set: DemoSetConfig) => Promise<void>;
  loadSet: (setName: string, targetCount: number) => Promise<void>;
  populateInfoModal: () => void;
  setAggregationTargetCount: (targetCount: number) => void;
  disposeSetPreviewVisualizers: () => void;
};

function refs() {
  return {
    aggregationSlider: document.getElementById('aggregationSlider') as HTMLInputElement | null,
    aggregationControls: document.getElementById('aggregationControls'),
    partColorControls: document.getElementById('partColorControls'),
    partColorInput: document.getElementById('partColorInput') as HTMLInputElement | null,
    partColorValue: document.getElementById('partColorValue'),
    partColorName: document.getElementById('partColorName'),
    partOverlay: document.getElementById('partOverlay'),
    partCaption: document.getElementById('partCaption'),
    partCaptionName: document.getElementById('partCaptionName'),
    partCaptionCounter: document.getElementById('partCaptionCounter'),
    aggCanvas: document.getElementById('agg-viewer') as HTMLElement | null,
    partCanvas: document.getElementById('part-viewer') as HTMLElement | null,
    infoModal: document.getElementById('infoModal'),
    infoModalTitle: document.getElementById('infoModalTitle'),
    infoModalSet: document.getElementById('infoModalSet'),
    infoModalDesc: document.getElementById('infoModalDesc'),
    infoModalAuthor: document.getElementById('infoModalAuthor'),
  };
}

export function normalizeHex(value: string) {
  if (!value) return '#ffffff';
  const v = value.trim();
  if (v.startsWith('#')) {
    return v.length === 7 ? v : v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : '#ffffff';
  }
  if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v}`;
  if (/^[0-9a-fA-F]{3}$/.test(v)) return `#${v[0]}${v[0]}${v[1]}${v[1]}${v[2]}${v[2]}`;
  return '#ffffff';
}

async function loadJson(path: string) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
  return response.json();
}

async function loadColors(path: string) {
  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function resolveColors(set: any) {
  const hasConfigColors = (set.colors && set.colors.length) || Object.keys(set.byPart || {}).length;
  if (hasConfigColors) {
    return { colors: set.colors || [], byPart: set.byPart || {} };
  }
  return loadColors(`${set.path}colors.json`);
}

function disposeVisualizer(viz: any) {
  if (!viz) return;
  try {
    viz.cameraControls?.dispose?.();
    viz.scene?.traverse?.((obj: any) => {
      obj.geometry?.dispose?.();
      if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m?.dispose?.());
      else obj.material?.dispose?.();
    });
    viz.renderer?.dispose?.();
    const dom = viz.renderer?.domElement;
    if (dom && dom.parentNode) dom.parentNode.removeChild(dom);
  } catch {}
}

export function createDemoRuntime(initialCallbacks: RuntimeCallbacks = {}): DemoRuntime {
  const runtime = {
    aggregation: null as any,
    aggregationData: null as any,
    waspVisualization: null as any,
    partVisualization: null as any,
    partsList: [] as any[],
    partIndex: 0,
    currentColors: null as any,
    currentMode: 'aggregation' as DemoMode,
    currentSet: null as DemoSetConfig | null,
    setPreviewStates: {} as Record<string, any>,
    setPartsCache: {} as Record<string, any[]>,
    callbacks: initialCallbacks,
  };

  function getSetPreviewState(setName: string) {
    if (!runtime.setPreviewStates[setName]) {
      runtime.setPreviewStates[setName] = { index: 0, viz: null, mesh: null };
    }
    return runtime.setPreviewStates[setName];
  }

  function setLoading(isLoading: boolean, message = '') {
    runtime.callbacks.onLoadingChanged?.({ isLoading, message });

    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    if (!loadingOverlay || !loadingText) return;
    loadingOverlay.style.opacity = isLoading ? '1' : '0';
    loadingOverlay.style.pointerEvents = isLoading ? 'auto' : 'none';
    loadingText.textContent = message;
  }

  function resetAggregationViewer() {
    const r = refs();
    if (!r.aggCanvas) return;
    r.aggCanvas.innerHTML = '';
    runtime.waspVisualization = new Visualizer('#agg-viewer', '#viewerArea');
  }

  function resetPartViewer() {
    const r = refs();
    if (!r.partCanvas) return;
    r.partCanvas.innerHTML = '';
    runtime.partVisualization = new Visualizer('#part-viewer', '#viewerArea');
  }

  function syncColorPicker(part: any, idx: number, inPartsMode: boolean) {
    const r = refs();
    if (!r.partColorInput || !r.partColorValue) return;
    const palette = runtime.currentColors?.colors || runtime.currentColors?.palette || [];
    const byPart = runtime.currentColors?.byPart || {};
    const fallback = palette.length ? palette[idx % palette.length] : '#ffffff';
    const hex = normalizeHex(byPart[part.name] || fallback);

    r.partColorInput.value = hex;
    r.partColorValue.textContent = hex.toUpperCase();
    r.partColorName && (r.partColorName.textContent = part.name);
    r.partColorControls?.classList.toggle('is-hidden', !inPartsMode);

    runtime.callbacks.onColorChanged?.({ hex });
  }

  function renderPart(nextIndex: number) {
    const r = refs();
    const inPartsMode = runtime.currentMode === 'parts';

    if (!runtime.partsList.length) {
      r.partCaptionName && (r.partCaptionName.textContent = 'No parts available');
      r.partCaptionCounter && (r.partCaptionCounter.textContent = '');
      r.partCaption?.classList.toggle('is-hidden', !inPartsMode);
      r.partOverlay?.classList.add('is-hidden');
      return;
    }

    const normalizedIndex = (nextIndex + runtime.partsList.length) % runtime.partsList.length;
    runtime.partIndex = normalizedIndex;
    const part = runtime.partsList[runtime.partIndex];

    resetPartViewer();
    const mesh = part.geo.clone();
    mesh.name = `${part.name}_preview`;
    runtime.partVisualization.scene.add(mesh);

    centerCameraOnMesh(runtime.partVisualization, mesh);

    r.partCaptionName && (r.partCaptionName.textContent = part.name);
    r.partCaptionCounter && (r.partCaptionCounter.textContent = `${runtime.partIndex + 1} / ${runtime.partsList.length}`);
    r.partCaption?.classList.toggle('is-hidden', !inPartsMode);
    r.partOverlay?.classList.toggle('is-hidden', !inPartsMode);
    syncColorPicker(part, runtime.partIndex, inPartsMode);

    runtime.callbacks.onPartChanged?.({ partIndex: runtime.partIndex, partsCount: runtime.partsList.length });
  }

  function setMode(mode: DemoMode) {
    if (mode === runtime.currentMode) return;
    runtime.currentMode = mode;
    const r = refs();

    const isAgg = mode === 'aggregation';
    r.aggCanvas?.classList.toggle('is-hidden', !isAgg);
    r.partCanvas?.classList.toggle('is-hidden', isAgg);
    r.aggregationControls?.classList.toggle('is-hidden', !isAgg);
    r.partOverlay?.classList.toggle('is-hidden', isAgg || !runtime.partsList.length);
    r.partCaption?.classList.toggle('is-hidden', isAgg || !runtime.partsList.length);
    r.partColorControls?.classList.toggle('is-hidden', isAgg || !runtime.partsList.length);

    runtime.callbacks.onModeChanged?.({ mode });
  }

  function updateCurrentPartColor(hex: string) {
    const part = runtime.partsList[runtime.partIndex];
    if (!part) return;

    const normalized = normalizeHex(hex);
    runtime.currentColors = runtime.currentColors || {};
    runtime.currentColors.byPart = runtime.currentColors.byPart || {};
    runtime.currentColors.byPart[part.name] = normalized;

    const r = refs();
    r.partColorValue && (r.partColorValue.textContent = normalized.toUpperCase());
    if (r.partColorInput) r.partColorInput.value = normalized;

    runtime.callbacks.onColorChanged?.({ hex: normalized });

    aggregationService.applyAggregationColors(runtime.aggregation, runtime.currentColors);
    const targetCount = Number(r.aggregationSlider?.value || 0);
    aggregationService.setAggregationPartCount(runtime.aggregation, targetCount, runtime.waspVisualization);

    const previewMesh = runtime.partVisualization?.scene?.children?.find((child: any) => child.name === `${part.name}_preview`);
    if (previewMesh?.material?.color) previewMesh.material.color.set(normalized);
  }

  function ensureSetPreviewViz(setName: string) {
    const set = availableSets.find((s: any) => s.name === setName);
    if (!set) return null;
    const previewState = getSetPreviewState(setName);
    if (previewState.viz) return previewState.viz;
    const selector = `#set-preview-${set.slug}`;
    previewState.viz = new Visualizer(selector, selector);
    if (previewState.viz?.cameraControls) previewState.viz.cameraControls.enabled = false;
    return previewState.viz;
  }

  function renderSetPreview(setName: string, nextIndex = 0) {
    const parts = runtime.setPartsCache[setName];
    if (!parts || !parts.length) return;

    const previewState = getSetPreviewState(setName);
    const viz = ensureSetPreviewViz(setName);
    if (!viz) return;

    const normalized = ((nextIndex % parts.length) + parts.length) % parts.length;
    const part = parts[normalized];

    if (previewState.mesh && viz.scene) viz.scene.remove(previewState.mesh);

    const mesh = part.geo.clone();
    mesh.name = `${part.name}_set_preview`;
    viz.scene.add(mesh);
    centerCameraOnMesh(viz, mesh, 2.2);

    previewState.mesh = mesh;
    previewState.index = normalized;
  }

  function nudgeSetPreview(setName: string, delta: number) {
    const previewState = getSetPreviewState(setName);
    renderSetPreview(setName, previewState.index + delta);
    updateSetPreviewNav(setName);
  }

  function updateSetPreviewNav(setName: string) {
    const parts = runtime.setPartsCache[setName] || [];
    const card = Array.from(document.querySelectorAll('.set-card')).find((el: any) => el.dataset.set === setName) as HTMLElement | undefined;
    if (!card) return;
    const navs = card.querySelectorAll('.set-card__nav');
    navs.forEach(nav => nav.classList.toggle('is-hidden', parts.length <= 1));
  }

  async function warmPreview(set: DemoSetConfig) {
    if (runtime.setPartsCache[set.name]) return;

    try {
      const data = await loadJson(`${set.path}${set.aggregation}`);
      const colorsConfig = await resolveColors(set);
      const agg = aggregationService.createAggregationFromData(data);
      aggregationService.applyAggregationColors(agg, colorsConfig);
      const parts = aggregationService.getAggregationCatalogParts(agg);
      runtime.setPartsCache[set.name] = parts;
      renderSetPreview(set.name, 0);
      updateSetPreviewNav(set.name);
    } catch (err: any) {
      console.warn(`Preview warm failed for ${set.name}: ${err.message}`);
    }
  }

  async function loadSet(setName: string, targetCount: number) {
    const set = availableSets.find((s) => s.name === setName);
    if (!set) return;

    runtime.currentSet = set;
    runtime.aggregation = null;
    runtime.aggregationData = null;
    runtime.partsList = [];
    runtime.partIndex = 0;

    resetAggregationViewer();
    resetPartViewer();

    try {
      if (!set.aggregation) throw new Error(`Set ${set.name} is missing aggregation filename`);

      setLoading(true, `Loading ${set.name}…`);

      const data = await loadJson(`${set.path}${set.aggregation}`);
      const colorsConfig = await resolveColors(set);

      runtime.aggregationData = data;
      runtime.aggregation = aggregationService.createAggregationFromData(data);
      runtime.currentColors = colorsConfig;
      aggregationService.applyAggregationColors(runtime.aggregation, colorsConfig);

      runtime.partsList = aggregationService.getAggregationCatalogParts(runtime.aggregation);
      runtime.setPartsCache[set.name] = runtime.partsList;

      await aggregationService.setAggregationPartCount(runtime.aggregation, targetCount, runtime.waspVisualization);
      aggregationService.frameVisualizerToScene(runtime.waspVisualization, 0.8);

      renderSetPreview(set.name, 0);
      updateSetPreviewNav(set.name);
      populateInfoModal();
      renderPart(runtime.partIndex);

      runtime.callbacks.onSetLoaded?.({
        setName: set.name,
        partsCount: runtime.partsList.length,
        partIndex: runtime.partIndex,
      });
    } catch (error: any) {
      console.error(`Failed to load ${set.name}: ${error.message}`);
    }

    setLoading(false);
  }

  function populateInfoModal() {
    const r = refs();
    if (!runtime.currentSet || !r.infoModal) return;
    r.infoModalTitle && (r.infoModalTitle.textContent = runtime.currentSet.name || 'Set Info');
    r.infoModalSet && (r.infoModalSet.textContent = runtime.currentSet.name || '—');
    r.infoModalDesc && (r.infoModalDesc.textContent = runtime.currentSet.description || '—');
    r.infoModalAuthor && (r.infoModalAuthor.textContent = runtime.currentSet.author || '—');
  }

  function setAggregationTargetCount(targetCount: number) {
    aggregationService.setAggregationPartCount(runtime.aggregation, targetCount, runtime.waspVisualization);
  }

  function disposeSetPreviewVisualizers() {
    Object.values(runtime.setPreviewStates).forEach((preview: any) => disposeVisualizer(preview?.viz));
    runtime.setPreviewStates = {};
  }

  return {
    configure: (callbacks: RuntimeCallbacks) => {
      runtime.callbacks = callbacks;
    },
    getAvailableSets: () => availableSets,
    getCurrentPartIndex: () => runtime.partIndex,
    normalizeHex,
    renderPart,
    setMode,
    updateCurrentPartColor,
    renderSetPreview,
    nudgeSetPreview,
    updateSetPreviewNav,
    warmPreview,
    loadSet,
    populateInfoModal,
    setAggregationTargetCount,
    disposeSetPreviewVisualizers,
  };
}
