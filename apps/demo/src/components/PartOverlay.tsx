import React from 'react';

type PartOverlayProps = {
  onPrevPart: () => void;
  onNextPart: () => void;
};

export function PartOverlay({ onPrevPart, onNextPart }: PartOverlayProps) {
  return (
    <div id="partOverlay" className="part-overlay is-hidden">
      <button className="pill pill--ghost part-overlay__btn" id="prevPart" aria-label="Previous part" onClick={onPrevPart}>
        ◀
      </button>
      <button className="pill pill--ghost part-overlay__btn" id="nextPart" aria-label="Next part" onClick={onNextPart}>
        ▶
      </button>
    </div>
  );
}
