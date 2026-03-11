import React from 'react';

type Props = {
  targetCount: number;
  onTargetChange: (count: number) => void;
};

export function RandomControls({ targetCount, onTargetChange }: Props) {
  return (
    <div className="random-controls">
      <h3 className="random-controls__title">Random Growth</h3>

      <label className="random-controls__label">
        Parts: <strong>{targetCount}</strong>
      </label>
      <input
        type="range"
        className="random-controls__slider"
        min={1}
        max={500}
        step={1}
        value={targetCount}
        onChange={(e) => onTargetChange(Number(e.target.value))}
      />
    </div>
  );
}
