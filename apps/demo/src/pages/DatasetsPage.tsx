import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Visualizer } from 'webwaspjs';
import { loadAvailableSets, type DemoSetConfig } from '../config/availableSets';
import { aggregationService, centerCameraOnMesh } from '../lib/aggregationService';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

async function loadJson(path: string) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
  return response.json();
}

async function resolveColors(set: DemoSetConfig) {
  const hasConfigColors =
    (set.colors && set.colors.length) || Object.keys(set.byPart || {}).length;
  if (hasConfigColors) return { colors: set.colors || [], byPart: set.byPart || {} };

  if (set.meta) {
    try {
      const response = await fetch(set.meta);
      if (response.ok) {
        const meta = await response.json();
        const colors = Array.isArray(meta?.colors) ? meta.colors : Array.isArray(meta?.palette) ? meta.palette : [];
        const byPart = meta?.byPart || meta?.by_part || {};
        if (colors.length || Object.keys(byPart).length) {
          return { colors, byPart };
        }
      }
    } catch {
      // Fall through to colors.json lookup.
    }
  }

  try {
    const response = await fetch(`${set.path}colors.json`);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function DatasetCard({
  set,
  onSelect,
  onShowInfo,
}: {
  set: DemoSetConfig;
  onSelect: (slug: string) => void;
  onShowInfo: (set: DemoSetConfig) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const vizRef = useRef<any>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    const container = canvasRef.current;
    if (!container || loadedRef.current) return;
    loadedRef.current = true;

    let disposed = false;

    (async () => {
      try {
        const data = await loadJson(`${set.path}${set.aggregation}`);
        const colorsConfig = await resolveColors(set);
        const agg = aggregationService.createAggregationFromData(data);
        if (colorsConfig) aggregationService.applyAggregationColors(agg, colorsConfig);
        const parts = aggregationService.getAggregationCatalogParts(agg);
        if (disposed || !parts.length) return;

        const viz = new Visualizer(container as any, container as any);
        vizRef.current = viz;
        if (viz.cameraControls) viz.cameraControls.enabled = false;

        const mesh = parts[0].geo.clone();
        mesh.name = `${parts[0].name}_datasets_preview`;
        if (viz.scene) {
          viz.scene.add(mesh);
          centerCameraOnMesh(viz, mesh, 2.5);
        }
      } catch (err: any) {
        console.warn(`Preview failed for ${set.name}: ${err.message}`);
      }
    })();

    return () => {
      disposed = true;
      const viz = vizRef.current;
      if (!viz) return;
      try {
        viz.cameraControls?.dispose?.();
        viz.renderer?.dispose?.();
        const dom = viz.renderer?.domElement;
        if (dom?.parentNode) dom.parentNode.removeChild(dom);
      } catch {
        // ignore cleanup errors
      }
    };
  }, [set]);

  return (
    <div className="landing-card">
      <button
        className="landing-card__preview"
        onClick={() => onSelect(set.slug)}
        type="button"
      >
        <div className="landing-card__canvas" ref={canvasRef} />
      </button>

      <div className="landing-card__footer">
        <span className="landing-card__title">{set.name}</span>
        <button
          className="landing-card__info-btn"
          onClick={(e) => {
            e.stopPropagation();
            onShowInfo(set);
          }}
          title="Dataset info"
          aria-label={`Info about ${set.name}`}
        >
          <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm.75 12.5h-1.5v-5h1.5v5Zm0-6.5h-1.5V6.5h1.5V8Z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

function DatasetInfoModal({
  set,
  onClose,
}: {
  set: DemoSetConfig | null;
  onClose: () => void;
}) {
  if (!set) return null;
  return (
    <div className="modal is-open" aria-modal="true" role="dialog">
      <div className="modal__backdrop" onClick={onClose} />
      <div className="modal__content">
        <button className="modal__close" aria-label="Close info" onClick={onClose}>
          ×
        </button>
        <h2 className="modal__title">{set.name}</h2>
        <dl className="modal__meta">
          {set.description && (
            <div>
              <dt>Description</dt>
              <dd>{set.description}</dd>
            </div>
          )}
          {set.author && (
            <div>
              <dt>Author</dt>
              <dd>{set.author}</dd>
            </div>
          )}
          <div>
            <dt>Slug</dt>
            <dd>{set.slug}</dd>
          </div>
          {set.tags && set.tags.length > 0 ? (
            <div>
              <dt>Tags</dt>
              <dd>
                <div className="modal__tags">
                  {set.tags.map((tag) => (
                    <span key={tag} className="modal__tag">{tag}</span>
                  ))}
                </div>
              </dd>
            </div>
          ) : null}
          {set.license ? (
            <div>
              <dt>License</dt>
              <dd>{set.license}</dd>
            </div>
          ) : null}
          {set.units ? (
            <div>
              <dt>Units</dt>
              <dd>{set.units}</dd>
            </div>
          ) : null}
          {set.version ? (
            <div>
              <dt>Version</dt>
              <dd>{set.version}</dd>
            </div>
          ) : null}
          {set.created ? (
            <div>
              <dt>Created</dt>
              <dd>{set.created}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>
  );
}

export function DatasetsPage() {
  const navigate = useNavigate();
  const [sets, setSets] = useState<DemoSetConfig[]>([]);
  const [catalogNotice, setCatalogNotice] = useState<string | null>(null);
  const [infoSet, setInfoSet] = useState<DemoSetConfig | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const result = await loadAvailableSets();
      if (!active) return;
      setSets(result.sets);
      setCatalogNotice(result.notice);
    })();

    return () => {
      active = false;
    };
  }, []);

  const handleSelect = useCallback(
    (slug: string) => navigate(`/build/${slug}`),
    [navigate],
  );

  return (
    <div className="datasets-page">
      <Navbar />

      <main className="datasets-page__main">
        <section className="landing__datasets" aria-label="Available datasets">
          <div className="landing__datasets-header">
            <div className="datasets-page__intro">
              <h1 className="datasets-page__title">Datasets</h1>
            </div>
            <div className="datasets-page__actions">
              <a
                className="landing__source-link"
                href="https://github.com/Wasp-Framework/Wasp-Atlas"
                target="_blank"
                rel="noreferrer noopener"
                title="Wasp-Atlas catalog source"
              >
                Source: Wasp-Atlas
              </a>
            </div>
          </div>
          {catalogNotice ? (
            <p className="dataset-source-notice" role="status" aria-live="polite">
              {catalogNotice}
            </p>
          ) : null}
          <div className="landing__grid datasets-page__grid">
            {sets.map((set) => (
              <DatasetCard
                key={set.slug}
                set={set}
                onSelect={handleSelect}
                onShowInfo={setInfoSet}
              />
            ))}
          </div>
        </section>
      </main>

      <DatasetInfoModal set={infoSet} onClose={() => setInfoSet(null)} />

      <Footer />
    </div>
  );
}
