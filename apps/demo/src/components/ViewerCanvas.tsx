import React from 'react';

type ViewerCanvasProps = {
  onOpenInfo: () => void;
};

export function ViewerCanvas({ onOpenInfo }: ViewerCanvasProps) {
  return (
    <>
      <button id="infoButton" className="info-button" aria-label="Show set info" onClick={onOpenInfo}>
        i
      </button>

      <div id="agg-viewer" className="canvas" aria-label="Aggregation viewer"></div>
      <div id="part-viewer" className="canvas is-hidden" aria-label="Part viewer"></div>

      <div id="loadingOverlay" className="loading" aria-live="polite" aria-busy="true">
        <div className="loading__spinner"></div>
        <p id="loadingText" className="loading__text"></p>
      </div>
    </>
  );
}
