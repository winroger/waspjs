import React, { useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { loadAvailableSets, type DemoSetConfig } from '../config/availableSets';
import { useBuildStore } from '../state/buildStore';
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
  const {
    buildMode,
    selectedPartName,
    hoveredGhostIndex,
    catalog,
    aggregationTargetCount,
    setName,
    isLoading,
    loadError,
    isInfoOpen,
    setLoaded,
    setLoading,
    setLoadError,
    setBuildMode,
    setAggregationTarget,
    togglePartActive,
    selectPart,
    setHoveredGhost,
    setPartColor,
    setInfoOpen,
  } = useBuildStore(
    useShallow((store) => ({
      buildMode: store.buildMode,
      selectedPartName: store.selectedPartName,
      hoveredGhostIndex: store.hoveredGhostIndex,
      catalog: store.catalog,
      aggregationTargetCount: store.aggregationTargetCount,
      setName: store.setName,
      isLoading: store.isLoading,
      loadError: store.loadError,
      isInfoOpen: store.isInfoOpen,
      setLoaded: store.setLoaded,
      setLoading: store.setLoading,
      setLoadError: store.setLoadError,
      setBuildMode: store.setBuildMode,
      setAggregationTarget: store.setAggregationTarget,
      togglePartActive: store.togglePartActive,
      selectPart: store.selectPart,
      setHoveredGhost: store.setHoveredGhost,
      setPartColor: store.setPartColor,
      setInfoOpen: store.setInfoOpen,
    })),
  );
  const [sets, setSets] = React.useState<DemoSetConfig[]>([]);
  const [areSetsLoaded, setAreSetsLoaded] = React.useState(false);
  const [catalogNotice, setCatalogNotice] = React.useState<string | null>(null);
  const currentSet = sets.find((item) => item.slug === slug) ?? null;

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

  useEffect(() => {
    let active = true;
    (async () => {
      const result = await loadAvailableSets();
      if (!active) return;
      setSets(result.sets);
      setCatalogNotice(result.notice);
      setAreSetsLoaded(true);
    })();

    return () => {
      active = false;
    };
  }, []);

  /* ── Load dataset on mount / slug change ── */
  useEffect(() => {
    if (!areSetsLoaded) return;

    const set = sets.find((s) => s.slug === slug);
    if (!set) {
      navigate('/', { replace: true });
      return;
    }

    let cancelled = false;
    setLoading(true);

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
        await growToTarget(aggregation, 50, vizRef.current);
        frameScene(vizRef.current);

        setLoaded({ slug: set.slug, setName: set.name, catalog });
      } catch (err: any) {
        if (!cancelled) setLoadError(err.message);
      }
    })();

    return () => {
      cancelled = true;
      disposeVisualizer(vizRef.current);
      vizRef.current = null;
      aggRef.current = null;
    };
  }, [slug, navigate, sets, areSetsLoaded, setLoading, setLoaded, setLoadError]);

  /* ── Mode switch ── */
  const handleModeChange = useCallback(
    (mode: 'random' | 'manual') => {
      setBuildMode(mode);
      const viz = vizRef.current;
      if (viz) {
        viz.clearGhostMeshes?.();
      }
      placementsByConnRef.current = new Map();
      activeVariantIndexRef.current = new Map();
      hoveredParentRef.current = null;
      hoveredGhostRef.current = null;
    },
    [setBuildMode],
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
      setHoveredGhost(null);
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
    setHoveredGhost(null);
  }, [setHoveredGhost]);

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
    setHoveredGhost(null);
  }, [setHoveredGhost]);

  /* ── Random mode: slider ── */
  const handleTargetChange = useCallback(
    (targetCount: number) => {
      setAggregationTarget(targetCount);
      const agg = aggRef.current;
      const viz = vizRef.current;
      if (agg && viz) {
        setAggregationPartCount(agg, targetCount, viz);
      }
    },
    [setAggregationTarget],
  );

  /* ── Part catalog: toggle active ── */
  const handleToggleActive = useCallback(
    (partName: string) => {
      togglePartActive(partName);
      // We'll sync activePartTypes after state update via effect
    },
    [togglePartActive],
  );

  /* Sync active part list to aggregation whenever catalog changes */
  useEffect(() => {
    const agg = aggRef.current;
    if (!agg) return;
    const activeNames = catalog.filter((p) => p.active).map((p) => p.name);
    if (activeNames.length === catalog.length) {
      setActivePartTypes(agg, null); // all active
    } else {
      setActivePartTypes(agg, activeNames);
    }
  }, [catalog]);

  /* ── Part catalog: color change ── */
  const handleColorChange = useCallback(
    (partName: string, hex: string) => {
      const normalized = normalizeHex(hex);
      setPartColor({ name: partName, color: normalized });

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
      setAggregationPartCount(agg, aggregationTargetCount, viz);
    },
    [setPartColor, aggregationTargetCount],
  );

  /* ── Manual mode: select part for placement ── */
  const handleSelectPart = useCallback(
    (partName: string | null) => {
      selectPart(partName);
      clearOverlays();
    },
    [clearOverlays, selectPart],
  );

  /* ── Manual mode: pointer events on canvas ── */
  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (buildMode !== 'manual' || !selectedPartName) return;
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
            setHoveredGhost(ghostHit.index);
          }
          return;
        } else if (hoveredGhostRef.current != null) {
          hoveredGhostRef.current = null;
          viz.unhighlightGhosts?.();
          setHoveredGhost(null);
        }
      }

      // Priority 2: raycast placed parts → show ghosts at all open connections
      const partHit = viz.raycastParts?.(e.nativeEvent);
      const hitParentId = partHit?.partId ?? null;

      if (hitParentId !== hoveredParentRef.current) {
        hoveredParentRef.current = hitParentId;
        hoveredGhostRef.current = null;

        if (hitParentId != null) {
          showGhostsForParent(selectedPartName);
        } else {
          viz.clearGhostMeshes?.();
          placementsByConnRef.current = new Map();
          activeVariantIndexRef.current = new Map();
          setHoveredGhost(null);
        }
      }
    },
    [buildMode, selectedPartName, showGhostsForParent, setHoveredGhost],
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (buildMode !== 'manual') return;
      const agg = aggRef.current;
      const viz = vizRef.current;
      if (!agg || !viz) return;

      if (selectedPartName && hoveredGhostIndex != null) {
        // Get the placement data from the hovered ghost
        const ghostData = viz._ghostData?.[hoveredGhostIndex];
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
          setAggregationTarget(agg.aggregated_parts.length);
        }
      } else if (!selectedPartName) {
        if (agg.aggregated_parts.length === 0 && catalog.length > 0) {
          placeFirstPartManually(agg, catalog[0].name, viz);
          setAggregationTarget(agg.aggregated_parts.length);
        }
      }
    },
    [buildMode, selectedPartName, hoveredGhostIndex, catalog, clearOverlays, setAggregationTarget],
  );

  const handleCanvasContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (buildMode !== 'manual') return;
      const agg = aggRef.current;
      const viz = vizRef.current;
      if (!agg || !viz) return;

      const hit = viz.raycastParts?.(e.nativeEvent);
      if (hit && hit.partId != null) {
        removePartById(agg, hit.partId, viz);
        clearOverlays();
        setAggregationTarget(agg.aggregated_parts.length);
      }
    },
    [buildMode, clearOverlays, setAggregationTarget],
  );

  /* ── Keyboard: Escape deselects, arrows cycle variants/parts ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        selectPart(null);
        clearOverlays();
        setInfoOpen(false);
        return;
      }

      if (buildMode !== 'manual' || catalog.length === 0) {
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
              showGhostsForParent(selectedPartName);
            }
          }
        }
        return;
      }

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        const currentIndex = catalog.findIndex((entry) => entry.name === selectedPartName);
        const fallbackIndex = step > 0 ? 0 : catalog.length - 1;
        const nextIndex = currentIndex === -1
          ? fallbackIndex
          : (currentIndex + step + catalog.length) % catalog.length;
        const nextPartName = catalog[nextIndex]?.name ?? null;

        selectPart(nextPartName);
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
  }, [
    buildMode,
    selectedPartName,
    catalog,
    clearOverlays,
    showGhostsForParent,
    selectPart,
    setInfoOpen,
  ]);

  /* Re-show ghosts when selected part changes while hovering a parent */
  useEffect(() => {
    if (buildMode === 'manual' && hoveredParentRef.current != null && selectedPartName) {
      showGhostsForParent(selectedPartName);
    }
  }, [selectedPartName, buildMode, showGhostsForParent]);

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
              Dataset: {setName || currentSet?.name || slug}
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
              onClick={() => setInfoOpen(true)}
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
              className={`mode-btn ${buildMode === 'random' ? 'mode-btn--active' : ''}`}
              onClick={() => handleModeChange('random')}
            >
              Random
            </button>
            <button
              className={`mode-btn ${buildMode === 'manual' ? 'mode-btn--active' : ''}`}
              onClick={() => handleModeChange('manual')}
            >
              Manual
            </button>
          </div>

          <div className="build-sidebar__settings">
            <h3 className="build-sidebar__section-title">Mode Settings</h3>

            {buildMode === 'random' ? (
              <RandomControls
                targetCount={aggregationTargetCount}
                onTargetChange={handleTargetChange}
              />
            ) : (
              <ManualControls
                selectedPartName={selectedPartName}
                partCount={aggRef.current?.aggregated_parts?.length ?? 0}
              />
            )}

            <PartCatalog
              catalog={catalog}
              selectedPartName={selectedPartName}
              buildMode={buildMode}
              onToggleActive={handleToggleActive}
              onColorChange={handleColorChange}
              onSelectPart={handleSelectPart}
            />
          </div>

          <div className="build-sidebar__usage">
            <h3 className="build-sidebar__section-title">Usage</h3>
            {buildMode === 'manual' ? (
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
      {(isLoading || !areSetsLoaded) && (
        <div className="build-loading">
          <p>Loading {setName || slug}…</p>
        </div>
      )}

      {catalogNotice ? (
        <div className="dataset-source-notice dataset-source-notice--build" role="status" aria-live="polite">
          {catalogNotice}
        </div>
      ) : null}

      {/* Error */}
      {loadError && (
        <div className="build-error">
          <p>Error: {loadError}</p>
          <button onClick={() => navigate('/')}>Back to datasets</button>
        </div>
      )}

      <InfoModal
        isOpen={isInfoOpen}
        onClose={() => setInfoOpen(false)}
        title={currentSet?.name || setName || 'Dataset Info'}
        setName={currentSet?.name || setName}
        description={currentSet?.description}
        author={currentSet?.author}
        tags={currentSet?.tags}
        license={currentSet?.license}
        units={currentSet?.units}
        version={currentSet?.version}
        created={currentSet?.created}
      />
    </div>
  );
}
