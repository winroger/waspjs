import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Visualizer } from 'webwaspjs';
import { loadAvailableSets, type DemoSetConfig } from '../config/availableSets';
import { aggregationService } from '../lib/aggregationService';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

async function loadJson(path: string) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
  return response.json();
}

/* ── Landing page ── */
export function LandingPage() {
  const [sets, setSets] = useState<DemoSetConfig[]>([]);
  const backgroundRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const result = await loadAvailableSets();
      if (!active) return;
      setSets(result.sets);
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const host = backgroundRef.current;
    if (!host || sets.length === 0) return;

    const brioSet =
      sets.find((set) => /brio.*rail|rail.*brio/i.test(`${set.name} ${set.slug}`)) ??
      sets.find((set) => /brio/i.test(`${set.name} ${set.slug}`));
    if (!brioSet) return;

    let disposed = false;
    let timerId: number | null = null;
    let viz: any = null;
    let aggregation: any = null;

    const minCount = 10;
    const maxCount = 200;
    const step = 1;
    const tickMs = 33;
    let targetCount = 80;
    let direction: 1 | -1 = 1;

    const animateGrowth = async () => {
      if (disposed || !viz || !aggregation) return;

      // Occasionally switch direction to keep the motion organic.
      if (Math.random() < 0.06) {
        direction = direction === 1 ? -1 : 1;
      }

      targetCount += direction * step;
      if (targetCount >= maxCount) {
        targetCount = maxCount;
        direction = -1;
      } else if (targetCount <= minCount) {
        targetCount = minCount;
        direction = 1;
      }

      await aggregationService.setAggregationPartCount(aggregation, targetCount, viz);

      timerId = window.setTimeout(() => {
        void animateGrowth();
      }, tickMs);
    };

    (async () => {
      try {
        const data = await loadJson(`${brioSet.path}${brioSet.aggregation}`);
        if (disposed) return;

        aggregation = aggregationService.createAggregationFromData(data);
        const catalogParts = aggregationService.getAggregationCatalogParts(aggregation);
        const whiteByPart: Record<string, string> = {};
        for (const part of catalogParts) {
          whiteByPart[part.name] = '#ffffff';
        }
        aggregationService.applyAggregationColors(aggregation, {
          colors: ['#ffffff'],
          byPart: whiteByPart,
        });

        viz = new Visualizer(host as any, host as any);
        if (!viz) return;
        viz.cameraControls.enabled = false;
        viz.renderer?.setPixelRatio?.(1);

        await aggregationService.setAggregationPartCount(aggregation, targetCount, viz);
        aggregationService.frameVisualizerToScene(viz, 0.72);
        viz.cameraControls?.setLookAt?.(-110, 0, 210, -110, 0, 0, false);

        void animateGrowth();
      } catch (err: any) {
        console.warn(`Landing background effect failed: ${err.message}`);
      }
    })();

    return () => {
      disposed = true;
      if (timerId != null) {
        window.clearTimeout(timerId);
      }

      if (viz) {
        try {
          viz.cameraControls?.dispose?.();
          viz.renderer?.dispose?.();
          const dom = viz.renderer?.domElement;
          if (dom?.parentNode) dom.parentNode.removeChild(dom);
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, [sets]);

  return (
    <div className="landing landing--home">
      <div className="landing__bg" aria-hidden="true">
        <div className="landing__bg-canvas" ref={backgroundRef} />
      </div>

      <Navbar />

      <main className="landing__main">
        <section className="landing__hero landing__hero--home" aria-label="Introduction">
          <span className="landing__hero-label">Wasp Atlas of Modularity</span>
          <h1 className="landing__hero-title">
            Explore modular<br />building systems
          </h1>
          <p className="landing__hero-desc">
            A growing open library of modular building systems designed with the
            Grasshopper plug-in WASP, a combinatorial toolkit for discrete design.
            Each dataset encodes parts, connection rules, and spatial logic,
            ready to explore, reconfigure, and grow.
          </p>
          <div className="landing__hero-actions">
            <Link to="/datasets" className="landing__cta-primary">
              Explore datasets
            </Link>
            <a
              className="landing__cta-secondary"
              href="https://forms.gle/SYdRbsySKonq19GJ8"
              target="_blank"
              rel="noreferrer noopener"
            >
              Submit a dataset ⤴
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
