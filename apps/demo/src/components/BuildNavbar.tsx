import React from 'react';

type Props = {
  setName: string;
  buildMode: 'random' | 'manual';
  onModeChange: (mode: 'random' | 'manual') => void;
  onBack: () => void;
};

export function BuildNavbar({ setName, buildMode, onModeChange, onBack }: Props) {
  return (
    <nav className="build-navbar">
      <button className="build-navbar__back" onClick={onBack} title="Back to datasets">
        ← Datasets
      </button>

      <span className="build-navbar__title">{setName}</span>

      <div className="build-navbar__mode-toggle">
        <button
          className={`mode-btn ${buildMode === 'random' ? 'mode-btn--active' : ''}`}
          onClick={() => onModeChange('random')}
        >
          Random
        </button>
        <button
          className={`mode-btn ${buildMode === 'manual' ? 'mode-btn--active' : ''}`}
          onClick={() => onModeChange('manual')}
        >
          Manual
        </button>
      </div>
    </nav>
  );
}
