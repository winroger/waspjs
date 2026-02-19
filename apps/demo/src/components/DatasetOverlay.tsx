import React from 'react';
import type { DemoSetConfig } from '../config/availableSets';

type DatasetOverlayProps = {
  isOpen: boolean;
  sets: DemoSetConfig[];
  activeSetName: string;
  onClose: () => void;
  onLoadSet: (setName: string) => void;
};

export function DatasetOverlay({ isOpen, sets, activeSetName, onClose, onLoadSet }: DatasetOverlayProps) {
  return (
    <div className={`dataset-overlay${isOpen ? ' is-open' : ''}`} aria-hidden={!isOpen}>
      <div className="dataset-overlay__backdrop" onClick={onClose}></div>
      <div className="dataset-overlay__sheet" role="dialog" aria-modal="true" aria-labelledby="datasetOverlayTitle">
        <div className="dataset-overlay__header">
          <h2 id="datasetOverlayTitle">Datasets</h2>
          <button className="dataset-overlay__close" aria-label="Close datasets" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="dataset-overlay__list">
          {sets.map(set => (
            <button
              key={set.slug}
              className={`dataset-overlay__item${activeSetName === set.name ? ' is-active' : ''}`}
              onClick={() => {
                onLoadSet(set.name);
                onClose();
              }}
            >
              <span className="dataset-overlay__item-name">{set.name}</span>
              {set.author ? <span className="dataset-overlay__item-meta">{set.author}</span> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
