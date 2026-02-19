import React from 'react';

type ModeToggleProps = {
  currentMode: 'aggregation' | 'parts';
  onModeChange: (mode: 'aggregation' | 'parts') => void;
};

export function ModeToggle({ currentMode, onModeChange }: ModeToggleProps) {
  return (
    <div className="viewer__topbar">
      <div className="mode-toggle" role="group" aria-label="Viewer mode">
        <button
          className={`mode-toggle__btn${currentMode === 'aggregation' ? ' is-active' : ''}`}
          onClick={() => onModeChange('aggregation')}
        >
          Aggregation
        </button>
        <button
          className={`mode-toggle__btn${currentMode === 'parts' ? ' is-active' : ''}`}
          onClick={() => onModeChange('parts')}
        >
          Parts
        </button>
      </div>
    </div>
  );
}
