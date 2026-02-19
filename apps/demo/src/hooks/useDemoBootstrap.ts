import { useEffect, useRef } from 'react';
import type { DemoRuntime } from '../lib/demoRuntime';

export function useDemoBootstrap(demoRuntime: DemoRuntime, initialTargetCount: number) {
  const requestIdRef = useRef(0);
  const initialTargetRef = useRef(initialTargetCount);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++requestIdRef.current;
    const availableSets = demoRuntime.getAvailableSets();

    const run = async () => {
      if (!availableSets.length) {
        console.error('No example configs found in public/examples');
        return;
      }

      const initialSetName = availableSets[0]?.name;
      if (initialSetName) {
        await demoRuntime.loadSet(initialSetName, initialTargetRef.current);
      }

      if (cancelled || requestId !== requestIdRef.current) return;

      for (const set of availableSets) {
        if (cancelled || requestId !== requestIdRef.current) break;
        await demoRuntime.warmPreview(set);
      }
    };

    run();

    return () => {
      cancelled = true;
      demoRuntime.disposeSetPreviewVisualizers();
    };
  }, [demoRuntime]);
}
