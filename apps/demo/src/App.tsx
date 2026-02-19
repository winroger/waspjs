import React, { useEffect, useReducer, useRef, useState } from 'react';
import { createDemoRuntime } from './lib/demoRuntime';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { ViewerArea } from './components/ViewerArea';
import { ControlsPanel } from './components/ControlsPanel';
import { DatasetOverlay } from './components/DatasetOverlay';
import { demoReducer, initialDemoState } from './state/appState';
import { useDemoBootstrap } from './hooks/useDemoBootstrap';

export default function App() {
  const runtimeRef = useRef(createDemoRuntime());
  const demoRuntime = runtimeRef.current;
  const [state, dispatch] = useReducer(demoReducer, initialDemoState);
  const [isDatasetOverlayOpen, setDatasetOverlayOpen] = useState(false);
  const availableSets = demoRuntime.getAvailableSets();

  useEffect(() => {
    demoRuntime.configure({
      onSetLoaded: payload => dispatch({ type: 'setLoaded', payload }),
      onPartChanged: payload => dispatch({ type: 'setPartIndex', payload }),
      onLoadingChanged: payload => dispatch({ type: 'setLoading', payload: payload.isLoading }),
      onColorChanged: payload => dispatch({ type: 'setColor', payload: payload.hex }),
      onModeChanged: payload => dispatch({ type: 'setMode', payload: payload.mode }),
    });
  }, [demoRuntime]);

  useDemoBootstrap(demoRuntime, state.aggregationTargetCount);

  useEffect(() => {
    const onEsc = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') {
        dispatch({ type: 'setInfoOpen', payload: false });
        setDatasetOverlayOpen(false);
      }
    };

    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, []);

  const handleModeChange = (mode: 'aggregation' | 'parts') => {
    dispatch({ type: 'setMode', payload: mode });
    demoRuntime.setMode(mode);
  };

  const handleOpenInfo = () => {
    demoRuntime.populateInfoModal();
    dispatch({ type: 'setInfoOpen', payload: true });
  };

  const handleCloseInfo = () => {
    dispatch({ type: 'setInfoOpen', payload: false });
  };

  const handlePrevPart = () => {
    demoRuntime.renderPart(demoRuntime.getCurrentPartIndex() - 1);
  };

  const handleNextPart = () => {
    demoRuntime.renderPart(demoRuntime.getCurrentPartIndex() + 1);
  };

  const handleAggregationTargetChange = (targetCount: number) => {
    dispatch({ type: 'setAggregationTargetCount', payload: targetCount });
    demoRuntime.setAggregationTargetCount(targetCount);
  };

  const handleLoadSet = async (setName: string) => {
    await demoRuntime.loadSet(setName, state.aggregationTargetCount);
    setDatasetOverlayOpen(false);
  };

  const handleColorChange = (hex: string) => {
    const normalized = demoRuntime.normalizeHex(hex);
    dispatch({ type: 'setColor', payload: normalized });
    demoRuntime.updateCurrentPartColor(normalized);
  };

  return (
    <>
      <Navbar onOpenDatasets={() => setDatasetOverlayOpen(true)} />
      <div className="layout">
        <Sidebar
          sets={availableSets}
          activeSetName={state.currentSetName}
          onLoadSet={handleLoadSet}
          onNudgePreview={(setName, delta) => demoRuntime.nudgeSetPreview(setName, delta)}
        />
        <div className="workspace">
          <ViewerArea
            currentMode={state.currentMode}
            isInfoOpen={state.isInfoOpen}
            onModeChange={handleModeChange}
            onOpenInfo={handleOpenInfo}
            onCloseInfo={handleCloseInfo}
            onPrevPart={handlePrevPart}
            onNextPart={handleNextPart}
          />
          <ControlsPanel
            aggregationTargetCount={state.aggregationTargetCount}
            currentColor={state.currentColor}
            onAggregationTargetChange={handleAggregationTargetChange}
            onColorChange={handleColorChange}
          />
        </div>
      </div>
      <DatasetOverlay
        isOpen={isDatasetOverlayOpen}
        sets={availableSets}
        activeSetName={state.currentSetName}
        onClose={() => setDatasetOverlayOpen(false)}
        onLoadSet={handleLoadSet}
      />
    </>
  );
}
