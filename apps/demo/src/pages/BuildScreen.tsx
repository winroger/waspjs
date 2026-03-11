import React, { useEffect, useReducer, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { availableSets } from '../config/availableSets';
import { buildReducer, initialBuildState } from '../state/buildState';
import type { BuildAction } from '../state/buildState';
import {
  loadDataset,
  createVisualizerInContainer,
  disposeVisualizer,
  growToTarget,
  frameScene,
  applyColors,
  normalizeHex,
  getOpenConnectionsForPart,
  getValidPlacementsAtConnection,
  placeFirstPartManually,
  placePartManually,
  removePartById,
  setActivePartTypes,
} from '../lib/buildRuntime';
import {
  setAggregationPartCount,
} from 'webwaspjs';
import { Navbar } from '../components/Navbar';
import { PartCatalog } from '../components/PartCatalog';
import { RandomControls } from '../components/RandomControls';
import { ManualControls } from '../components/ManualControls';

export function BuildScreen() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(buildReducer, initialBuildState);

  /* refs for mutable Three.js objects */
  const canvasRef = useRef<HTMLDivElement>(null);
  const vizRef = useRef<any>(null);
  const aggRef = useRef<any>(null);
  const colorsRef = useRef<any>(null);
  /** Cached placement for the currently-hovered connection marker */
  const placementsRef = useRef<any[]>([]);
  const hoveredParentRef = useRef<number | null>(null);
  /** Which marker index is currently showing a ghost */
  const hoveredMarkerRef = useRef<number | null>(null);

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
        viz.clearConnectionMarkers?.();
      }
      placementsRef.current = [];
      hoveredParentRef.current = null;
      hoveredMarkerRef.current = null;
    },
    [],
  );

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
      const viz = vizRef.current;
      if (viz) {
        viz.clearGhostMeshes?.();
        viz.clearConnectionMarkers?.();
      }
      placementsRef.current = [];
      hoveredParentRef.current = null;
      hoveredMarkerRef.current = null;
      dispatch({ type: 'setHoveredGhost', payload: null });
    },
    [],
  );

  /** Helper: clear all visual overlays and refs */
  const clearOverlays = useCallback(() => {
    const viz = vizRef.current;
    if (viz) {
      viz.clearGhostMeshes?.();
      viz.clearConnectionMarkers?.();
    }
    placementsRef.current = [];
    hoveredParentRef.current = null;
    hoveredMarkerRef.current = null;
    dispatch({ type: 'setHoveredGhost', payload: null });
  }, []);

  /* ── Manual mode: pointer events on canvas ── */
  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (state.buildMode !== 'manual' || !state.selectedPartName) return;
      const viz = vizRef.current;
      const agg = aggRef.current;
      if (!viz || !agg) return;

      // Priority 1: if ghosts are visible, check for ghost hover
      if (placementsRef.current.length > 0) {
        const ghostHit = viz.raycastGhosts?.(e.nativeEvent);
        if (ghostHit) {
          viz.highlightGhost?.(ghostHit.index);
          dispatch({ type: 'setHoveredGhost', payload: ghostHit.index });
          return;
        } else {
          viz.unhighlightGhosts?.();
          dispatch({ type: 'setHoveredGhost', payload: null });
        }
      }

      // Priority 2: check for marker sphere hover → show ghost at that connection
      if (viz._markerMeshes?.length > 0) {
        const markerHit = viz.raycastMarkers?.(e.nativeEvent);
        if (markerHit) {
          const markerIdx = markerHit.index;
          // Only recompute ghost if we moved to a different marker
          if (markerIdx !== hoveredMarkerRef.current) {
            hoveredMarkerRef.current = markerIdx;
            viz.highlightMarker?.(markerIdx);
            viz.clearGhostMeshes?.();
            placementsRef.current = [];
            dispatch({ type: 'setHoveredGhost', payload: null });

            const connData = markerHit.data;
            const placements = getValidPlacementsAtConnection(
              agg, state.selectedPartName, connData.partId, connData.connectionId,
            );
            if (placements.length > 0) {
              placementsRef.current = placements;
              viz.addGhostMeshes?.(placements);
            }
          }
          return;
        } else {
          // Moved off markers — clear ghost but keep markers
          if (hoveredMarkerRef.current != null) {
            hoveredMarkerRef.current = null;
            viz.unhighlightMarkers?.();
            viz.clearGhostMeshes?.();
            placementsRef.current = [];
            dispatch({ type: 'setHoveredGhost', payload: null });
          }
        }
      }

      // Priority 3: raycast placed parts → show markers at open connections
      const partHit = viz.raycastParts?.(e.nativeEvent);
      const hitParentId = partHit?.partId ?? null;

      if (hitParentId !== hoveredParentRef.current) {
        hoveredParentRef.current = hitParentId;
        hoveredMarkerRef.current = null;
        viz.clearConnectionMarkers?.();
        viz.clearGhostMeshes?.();
        placementsRef.current = [];
        dispatch({ type: 'setHoveredGhost', payload: null });

        if (hitParentId != null) {
          const conns = getOpenConnectionsForPart(agg, hitParentId);
          // Filter to only connections that have rules matching selected part
          const relevant = conns.filter((c: any) =>
            c.rules.some((r: any) => r.partB === state.selectedPartName),
          );
          if (relevant.length > 0) {
            viz.addConnectionMarkers?.(relevant);
          }
        }
      }
    },
    [state.buildMode, state.selectedPartName],
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (state.buildMode !== 'manual') return;
      const agg = aggRef.current;
      const viz = vizRef.current;
      if (!agg || !viz) return;

      if (state.selectedPartName && state.hoveredGhostIndex != null) {
        // Place at ghost location using the cached placements
        const placement = placementsRef.current[state.hoveredGhostIndex];
        if (placement) {
          placePartManually(
            agg,
            placement.parentPartId,
            placement.connectionId,
            placement.partName,
            placement.connectionBId,
            viz,
          );
          clearOverlays();
          dispatch({ type: 'setAggregationTarget', payload: agg.aggregated_parts.length });
        }
      } else if (!state.selectedPartName) {
        // If nothing selected and aggregation is empty, place first part of first catalog entry
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

  /* ── Keyboard: Escape deselects ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dispatch({ type: 'selectPart', payload: null });
        vizRef.current?.clearGhostMeshes?.();
        vizRef.current?.clearConnectionMarkers?.();
        placementsRef.current = [];
        hoveredParentRef.current = null;
        hoveredMarkerRef.current = null;
        dispatch({ type: 'setInfoOpen', payload: false });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ── Render ── */
  return (
    <div className="build-screen">
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
          {/* Back arrow – bottom left */}
          <button
            className="build-viewer__back"
            onClick={() => navigate('/')}
            title="Back to datasets"
            aria-label="Back to datasets"
          >
            ←
          </button>

          {/* Mode toggle – bottom center */}
          <div className="build-viewer__mode-toggle">
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
        </div>

        {/* ── Right sidebar ── */}
        <aside className="build-sidebar">
          <PartCatalog
            catalog={state.catalog}
            selectedPartName={state.selectedPartName}
            buildMode={state.buildMode}
            onToggleActive={handleToggleActive}
            onColorChange={handleColorChange}
            onSelectPart={handleSelectPart}
          />

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
    </div>
  );
}
