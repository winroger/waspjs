import React, { useEffect, useReducer, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { availableSets } from '../config/availableSets';
import { buildReducer, initialBuildState } from '../state/buildState';
import {
  loadDataset,
  createVisualizerInContainer,
  disposeVisualizer,
  growToTarget,
  frameScene,
  applyColors,
  normalizeHex,
  getValidPlacementsAtParent,
  placeFirstPartManually,
  placePartManually,
  removePartById,
  setActivePartTypes,
} from '../lib/buildRuntime';
import {
  setAggregationPartCount,
} from 'webwaspjs';
import { Navbar } from '../components/Navbar';
import { InfoModal } from '../components/InfoModal';
import { PartCatalog } from '../components/PartCatalog';
import { RandomControls } from '../components/RandomControls';
import { ManualControls } from '../components/ManualControls';

function useIsPortrait() {
  const [isPortrait, setIsPortrait] = React.useState(
    () => typeof window !== 'undefined' && (window.innerWidth < window.innerHeight || window.innerWidth < 700),
  );
  useEffect(() => {
    const check = () => setIsPortrait(window.innerWidth < window.innerHeight || window.innerWidth < 700);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isPortrait;
}

export function BuildScreen() {
  const isPortrait = useIsPortrait();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(buildReducer, initialBuildState);
  const currentSet = availableSets.find((item) => item.slug === slug) ?? null;

  /* refs for mutable Three.js objects */
  const canvasRef = useRef<HTMLDivElement>(null);
  const vizRef = useRef<any>(null);
  const aggRef = useRef<any>(null);
  const colorsRef = useRef<any>(null);
  /** All valid placements at the currently-hovered parent part, grouped by connectionId */
  const placementsByConnRef = useRef<Map<number, any[]>>(new Map());
  /** Index into the variant list for the currently-hovered ghost's connection */
  const activeVariantIndexRef = useRef<Map<number, number>>(new Map());
  const hoveredParentRef = useRef<number | null>(null);
  /** The ghost index currently under the pointer */
  const hoveredGhostRef = useRef<number | null>(null);

  /* ── Load dataset on mount / slug change ── */
  useEffect(() => {
    const set = availableSets.find((s) => s.slug === slug);
    if (!set) {
      navigate('/', { replace: true });
      return;
    }

    let cancelled = false;
    dispatch({ type: 'setLoading', payload: true });

    (async () => {
      try {
        const { aggregation, colorsConfig, catalog } = await loadDataset(set);
        if (cancelled) return;

        aggRef.current = aggregation;
        colorsRef.current = colorsConfig;

        /* initialise the visualizer */
        if (vizRef.current) disposeVisualizer(vizRef.current);
        if (canvasRef.current) {
          vizRef.current = createVisualizerInContainer(canvasRef.current);
        }

        /* grow to default count */
        await growToTarget(aggregation, initialBuildState.aggregationTargetCount, vizRef.current);
        frameScene(vizRef.current);

        dispatch({
          type: 'setLoaded',
          payload: { slug: set.slug, setName: set.name, catalog },
        });
      } catch (err: any) {
        if (!cancelled) dispatch({ type: 'setLoadError', payload: err.message });
      }
    })();

    return () => {
      cancelled = true;
      disposeVisualizer(vizRef.current);
      vizRef.current = null;
      aggRef.current = null;
    };
  }, [slug, navigate]);

  /* ── Mode switch ── */
  const handleModeChange = useCallback(
    (mode: 'random' | 'manual') => {
      dispatch({ type: 'setBuildMode', payload: mode });
      const viz = vizRef.current;
      if (viz) {
        viz.clearGhostMeshes?.();
      }
      placementsByConnRef.current = new Map();
      activeVariantIndexRef.current = new Map();
      hoveredParentRef.current = null;
      hoveredGhostRef.current = null;
    },
    [],
  );

  /** Show ghosts at all open connections of the hovered parent part. */
  const showGhostsForParent = useCallback((partName: string | null) => {
    const viz = vizRef.current;
    const agg = aggRef.current;
    const parentId = hoveredParentRef.current;

    if (!viz || !agg || parentId == null || !partName) {
      viz?.clearGhostMeshes?.();
      placementsByConnRef.current = new Map();
      activeVariantIndexRef.current = new Map();
      dispatch({ type: 'setHoveredGhost', payload: null });
      return;
    }

    const allPlacements: any[] = getValidPlacementsAtParent(agg, partName, parentId);

    // Group by connectionId
    const byConn = new Map<number, any[]>();
    for (const p of allPlacements) {
      const list = byConn.get(p.connectionId) ?? [];
      list.push(p);
      byConn.set(p.connectionId, list);
    }
    placementsByConnRef.current = byConn;

    // Pick one placement per connection (using current variant index or 0)
    const ghostPlacements: any[] = [];
    const newVariantIndex = new Map<number, number>();
    for (const [connId, variants] of byConn) {
      const prevIdx = activeVariantIndexRef.current.get(connId) ?? 0;
      const idx = prevIdx < variants.length ? prevIdx : 0;
      newVariantIndex.set(connId, idx);
      ghostPlacements.push(variants[idx]);
    }
    activeVariantIndexRef.current = newVariantIndex;

    viz.clearGhostMeshes?.();
    if (ghostPlacements.length > 0) {
      viz.addGhostMeshes?.(ghostPlacements);
    }
    dispatch({ type: 'setHoveredGhost', payload: null });
  }, []);

  /** Helper: clear all visual overlays and refs */
  const clearOverlays = useCallback(() => {
    const viz = vizRef.current;
    if (viz) {
      viz.clearGhostMeshes?.();
    }
    placementsByConnRef.current = new Map();
    activeVariantIndexRef.current = new Map();
    hoveredParentRef.current = null;
    hoveredGhostRef.current = null;
    dispatch({ type: 'setHoveredGhost', payload: null });
  }, []);

  /* ── Random mode: slider ── */
  const handleTargetChange = useCallback(
    (targetCount: number) => {
      dispatch({ type: 'setAggregationTarget', payload: targetCount });
      const agg = aggRef.current;
      const viz = vizRef.current;
      if (agg && viz) {
        setAggregationPartCount(agg, targetCount, viz);
      }
    },
    [],
  );

  /* ── Part catalog: toggle active ── */
  const handleToggleActive = useCallback(
    (partName: string) => {
      dispatch({ type: 'togglePartActive', payload: partName });
      // We'll sync activePartTypes after state update via effect
    },
    [],
  );

  /* Sync active part list to aggregation whenever catalog changes */
  useEffect(() => {
    const agg = aggRef.current;
    if (!agg) return;
    const activeNames = state.catalog.filter((p) => p.active).map((p) => p.name);
    if (activeNames.length === state.catalog.length) {
      setActivePartTypes(agg, null); // all active
    } else {
      setActivePartTypes(agg, activeNames);
    }
  }, [state.catalog]);

  /* ── Part catalog: color change ── */
  const handleColorChange = useCallback(
    (partName: string, hex: string) => {
      const normalized = normalizeHex(hex);
      dispatch({ type: 'setPartColor', payload: { name: partName, color: normalized } });

      const agg = aggRef.current;
      const viz = vizRef.current;
      if (!agg || !viz) return;

      // Update colorsConfig and re-apply
      const cfg = colorsRef.current || { colors: [], byPart: {} };
      cfg.byPart = cfg.byPart || {};
      cfg.byPart[partName] = normalized;
      colorsRef.current = cfg;
      applyColors(agg, cfg);
      // Re-render current part count to refresh materials
      setAggregationPartCount(agg, state.aggregationTargetCount, viz);
    },
    [state.aggregationTargetCount],
  );

  /* ── Manual mode: select part for placement ── */
  const handleSelectPart = useCallback(
    (partName: string | null) => {
      dispatch({ type: 'selectPart', payload: partName });
      clearOverlays();
    },
    [clearOverlays],
  );

  /* ── Manual mode: pointer events on canvas ── */
  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (state.buildMode !== 'manual' || !state.selectedPartName) return;
      const viz = vizRef.current;
      const agg = aggRef.current;
      if (!viz || !agg) return;

      // Priority 1: check ghost hover (highlight the one under pointer)
      if (viz._ghostMeshes?.length > 0) {
        const ghostHit = viz.raycastGhosts?.(e.nativeEvent);
        if (ghostHit) {
          if (ghostHit.index !== hoveredGhostRef.current) {
            hoveredGhostRef.current = ghostHit.index;
            viz.highlightGhost?.(ghostHit.index);
            dispatch({ type: 'setHoveredGhost', payload: ghostHit.index });
          }
          return;
        } else if (hoveredGhostRef.current != null) {
          hoveredGhostRef.current = null;
          viz.unhighlightGhosts?.();
          dispatch({ type: 'setHoveredGhost', payload: null });
        }
      }

      // Priority 2: raycast placed parts → show ghosts at all open connections
      const partHit = viz.raycastParts?.(e.nativeEvent);
      const hitParentId = partHit?.partId ?? null;

      if (hitParentId !== hoveredParentRef.current) {
        hoveredParentRef.current = hitParentId;
        hoveredGhostRef.current = null;

        if (hitParentId != null) {
          showGhostsForParent(state.selectedPartName);
        } else {
          viz.clearGhostMeshes?.();
          placementsByConnRef.current = new Map();
          activeVariantIndexRef.current = new Map();
          dispatch({ type: 'setHoveredGhost', payload: null });
        }
      }
    },
    [state.buildMode, state.selectedPartName, showGhostsForParent],
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (state.buildMode !== 'manual') return;
      const agg = aggRef.current;
      const viz = vizRef.current;
      if (!agg || !viz) return;

      if (state.selectedPartName && state.hoveredGhostIndex != null) {
        // Get the placement data from the hovered ghost
        const ghostData = viz._ghostData?.[state.hoveredGhostIndex];
        if (ghostData) {
          placePartManually(
            agg,
            ghostData.parentPartId,
            ghostData.connectionId,
            ghostData.partName,
            ghostData.connectionBId,
            viz,
          );
          clearOverlays();
          dispatch({ type: 'setAggregationTarget', payload: agg.aggregated_parts.length });
        }
      } else if (!state.selectedPartName) {
        if (agg.aggregated_parts.length === 0 && state.catalog.length > 0) {
          placeFirstPartManually(agg, state.catalog[0].name, viz);
          dispatch({ type: 'setAggregationTarget', payload: agg.aggregated_parts.length });
        }
      }
    },
    [state.buildMode, state.selectedPartName, state.hoveredGhostIndex, state.catalog, clearOverlays],
  );

  const handleCanvasContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (state.buildMode !== 'manual') return;
      const agg = aggRef.current;
      const viz = vizRef.current;
      if (!agg || !viz) return;

      const hit = viz.raycastParts?.(e.nativeEvent);
      if (hit && hit.partId != null) {
        removePartById(agg, hit.partId, viz);
        clearOverlays();
        dispatch({ type: 'setAggregationTarget', payload: agg.aggregated_parts.length });
      }
    },
    [state.buildMode, clearOverlays],
  );

  /* ── Keyboard: Escape deselects, arrows cycle variants/parts ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dispatch({ type: 'selectPart', payload: null });
        clearOverlays();
        dispatch({ type: 'setInfoOpen', payload: false });
        return;
      }

      if (state.buildMode !== 'manual' || state.catalog.length === 0) {
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // Cycle variant at the currently hovered ghost's connection
        const viz = vizRef.current;
        if (hoveredGhostRef.current != null && viz?._ghostData) {
          const ghostData = viz._ghostData[hoveredGhostRef.current];
          if (ghostData) {
            const connId = ghostData.connectionId;
            const variants = placementsByConnRef.current.get(connId);
            if (variants && variants.length > 1) {
              e.preventDefault();
              const curIdx = activeVariantIndexRef.current.get(connId) ?? 0;
              const delta = e.key === 'ArrowRight' ? 1 : -1;
              const nextIdx = (curIdx + delta + variants.length) % variants.length;
              activeVariantIndexRef.current.set(connId, nextIdx);
              showGhostsForParent(state.selectedPartName);
            }
          }
        }
        return;
      }

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        const currentIndex = state.catalog.findIndex((entry) => entry.name === state.selectedPartName);
        const fallbackIndex = step > 0 ? 0 : state.catalog.length - 1;
        const nextIndex = currentIndex === -1
          ? fallbackIndex
          : (currentIndex + step + state.catalog.length) % state.catalog.length;
        const nextPartName = state.catalog[nextIndex]?.name ?? null;

        dispatch({ type: 'selectPart', payload: nextPartName });
        // Re-show ghosts with new part if hovering a parent
        if (hoveredParentRef.current != null) {
          // Need to defer to let state update
          hoveredGhostRef.current = null;
          placementsByConnRef.current = new Map();
          activeVariantIndexRef.current = new Map();
          vizRef.current?.clearGhostMeshes?.();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clearOverlays, showGhostsForParent, state.buildMode, state.catalog, state.selectedPartName]);

  /* Re-show ghosts when selected part changes while hovering a parent */
  useEffect(() => {
    if (state.buildMode === 'manual' && hoveredParentRef.current != null && state.selectedPartName) {
      showGhostsForParent(state.selectedPartName);
    }
  }, [state.selectedPartName, state.buildMode, showGhostsForParent]);

  /* ── Render ── */
  return (
    <div className="build-screen">
      {isPortrait && (
        <div className="build-portrait-overlay" aria-live="polite">
          <svg className="build-portrait-overlay__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="5" y="2" width="14" height="20" rx="2"/>
            <path d="M12 18h.01"/>
            <path d="M3 11l3-3 3 3" opacity="0.5"/>
            <path d="M21 13l-3 3-3-3" opacity="0.5"/>
          </svg>
          <h2 className="build-portrait-overlay__title">Rotate your device</h2>
          <p className="build-portrait-overlay__desc">The editor works best in landscape mode.</p>
        </div>
      )}
      <Navbar />

      <div className="build-layout">
        {/* ── Main viewer ── */}
        <div
          className="build-viewer"
          ref={canvasRef}
          onPointerMove={handleCanvasPointerMove}
          onClick={handleCanvasClick}
          onContextMenu={handleCanvasContextMenu}
        >
            <div className="build-viewer__dataset-name">
              Dataset: {state.setName || currentSet?.name || slug}
            </div>

          <button
              className="build-viewer__back"
              onClick={() => navigate('/')}
              title="Back to datasets"
              aria-label="Back to datasets"
            >
              ←
            </button>

            <button
            className="build-viewer__info"
            type="button"
            onClick={() => dispatch({ type: 'setInfoOpen', payload: true })}
            aria-label="Show dataset info"
            title="Dataset info"
          >
            i
          </button>

        </div>

        {/* ── Right sidebar ── */}
        <aside className="build-sidebar">
          <div className="build-sidebar__mode-picker">
            <button
              className={`mode-btn ${state.buildMode === 'random' ? 'mode-btn--active' : ''}`}
              onClick={() => handleModeChange('random')}
            >
              Random
            </button>
            <button
              className={`mode-btn ${state.buildMode === 'manual' ? 'mode-btn--active' : ''}`}
              onClick={() => handleModeChange('manual')}
            >
              Manual
            </button>
          </div>

          <div className="build-sidebar__settings">
            <h3 className="build-sidebar__section-title">Mode Settings</h3>

            {state.buildMode === 'random' ? (
              <RandomControls
                targetCount={state.aggregationTargetCount}
                onTargetChange={handleTargetChange}
              />
            ) : (
              <ManualControls
                selectedPartName={state.selectedPartName}
                partCount={aggRef.current?.aggregated_parts?.length ?? 0}
              />
            )}

            <PartCatalog
              catalog={state.catalog}
              selectedPartName={state.selectedPartName}
              buildMode={state.buildMode}
              onToggleActive={handleToggleActive}
              onColorChange={handleColorChange}
              onSelectPart={handleSelectPart}
            />
          </div>

          <div className="build-sidebar__usage">
            <h3 className="build-sidebar__section-title">Usage</h3>
            {state.buildMode === 'manual' ? (
              <>
                <p><kbd>Hover</kbd> a part to see placement options</p>
                <p><kbd>Click</kbd> ghost to place</p>
                <p><kbd>Right-click</kbd> part to remove</p>
                <p><kbd>Left</kbd>/<kbd>Right</kbd> switch placement variants</p>
                <p><kbd>Up</kbd>/<kbd>Down</kbd> switch parts</p>
                <p><kbd>Esc</kbd> to deselect</p>
              </>
            ) : (
              <>
                <p>Use the slider to grow or shrink the aggregation.</p>
                <p>Toggle parts off to exclude them from random growth.</p>
                <p>Use the color swatch to update part materials.</p>
              </>
            )}
          </div>
        </aside>
      </div>

      {/* Loading overlay */}
      {state.isLoading && (
        <div className="build-loading">
          <p>Loading {state.setName || slug}…</p>
        </div>
      )}

      {/* Error */}
      {state.loadError && (
        <div className="build-error">
          <p>Error: {state.loadError}</p>
          <button onClick={() => navigate('/')}>Back to datasets</button>
        </div>
      )}

      <InfoModal
        isOpen={state.isInfoOpen}
        onClose={() => dispatch({ type: 'setInfoOpen', payload: false })}
        title={currentSet?.name || state.setName || 'Dataset Info'}
        setName={currentSet?.name || state.setName}
        description={currentSet?.description}
        author={currentSet?.author}
      />
    </div>
  );
}
