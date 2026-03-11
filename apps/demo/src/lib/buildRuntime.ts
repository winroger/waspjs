/**
 * buildRuntime.ts – React-controlled runtime for the build screen.
 *
 * Unlike the old demoRuntime, this module exposes pure functions that operate
 * on explicit Aggregation / Visualizer refs.  All DOM manipulation is gone;
 * the React layer owns rendering.
 */

import { Visualizer } from 'webwaspjs';
import {
  createAggregationFromData,
  getAggregationCatalogParts,
  applyAggregationColors,
  setAggregationPartCount,
  frameVisualizerToScene,
  getOpenConnections,
  getOpenConnectionsForPart,
  getValidPlacements,
  getValidPlacementsAtParent,
  getValidPlacementsAtConnection,
  placeFirstPartManually,
  placePartManually,
  removePartById,
  setActivePartTypes,
} from 'webwaspjs';
import type { PartCatalogEntry } from '../state/buildState';

/* ── helpers ── */

async function loadJson(path: string) {
  const resp = await fetch(path);
  if (!resp.ok) throw new Error(`Failed to load ${path}: ${resp.status}`);
  return resp.json();
}

async function resolveColors(set: { colors?: string[]; byPart?: Record<string, string>; path: string }) {
  const hasConfig = (set.colors?.length ?? 0) > 0 || Object.keys(set.byPart ?? {}).length > 0;
  if (hasConfig) return { colors: set.colors || [], byPart: set.byPart || {} };
  try {
    const r = await fetch(`${set.path}colors.json`);
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}

export function normalizeHex(value: string): string {
  if (!value) return '#ffffff';
  const v = value.trim();
  if (v.startsWith('#')) {
    return v.length === 7 ? v : v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : '#ffffff';
  }
  if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v}`;
  if (/^[0-9a-fA-F]{3}$/.test(v)) return `#${v[0]}${v[0]}${v[1]}${v[1]}${v[2]}${v[2]}`;
  return '#ffffff';
}

/* ── dataset loading ── */

export type LoadResult = {
  aggregation: any;
  colorsConfig: any;
  catalog: PartCatalogEntry[];
};

export async function loadDataset(
  set: { path: string; aggregation: string; colors?: string[]; byPart?: Record<string, string> },
): Promise<LoadResult> {
  const data = await loadJson(`${set.path}${set.aggregation}`);
  const colorsConfig = await resolveColors(set);
  const agg = createAggregationFromData(data);
  if (colorsConfig) applyAggregationColors(agg, colorsConfig);

  const parts = getAggregationCatalogParts(agg);
  const palette = colorsConfig?.colors || [];
  const byPart = colorsConfig?.byPart || {};

  const catalog: PartCatalogEntry[] = parts.map((p: any, i: number) => ({
    name: p.name,
    color: normalizeHex(byPart[p.name] || (palette.length ? palette[i % palette.length] : '#ffffff')),
    active: true,
  }));

  return { aggregation: agg, colorsConfig, catalog };
}

/* ── visualizer lifecycle ── */

export function createVisualizerInContainer(container: HTMLElement): any {
  // Visualizer expects a CSS selector or element – pass the element directly
  return new Visualizer(container as any, container as any);
}

export function disposeVisualizer(viz: any) {
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
    if (dom?.parentNode) dom.parentNode.removeChild(dom);
  } catch {}
}

/* ── aggregation helpers (thin wrappers kept for call-site clarity) ── */

export function growToTarget(agg: any, targetCount: number, viz: any) {
  return setAggregationPartCount(agg, targetCount, viz);
}

export function frameScene(viz: any, padding = 0.8) {
  frameVisualizerToScene(viz, padding);
}

export function applyColors(agg: any, colorsConfig: any) {
  if (colorsConfig) applyAggregationColors(agg, colorsConfig);
}

export { getOpenConnections, getOpenConnectionsForPart, getValidPlacements, getValidPlacementsAtParent, getValidPlacementsAtConnection, placeFirstPartManually, placePartManually, removePartById, setActivePartTypes };
