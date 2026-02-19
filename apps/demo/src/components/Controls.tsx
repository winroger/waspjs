import React from 'react';

type ControlsProps = {
  aggregationTargetCount: number;
  currentColor: string;
  onAggregationTargetChange: (nextValue: number) => void;
  onColorChange: (hex: string) => void;
};

export function Controls({
  aggregationTargetCount,
  currentColor,
  onAggregationTargetChange,
  onColorChange,
}: ControlsProps) {
  return (
    <section className="controls">
      <div className="controls__row" id="aggregationControls">
        <label className="controls__label" htmlFor="aggregationSlider">
          Parts
        </label>
        <input
          id="aggregationSlider"
          type="range"
          min="0"
          max="200"
          value={aggregationTargetCount}
          className="slider"
          aria-valuemin={0}
          aria-valuemax={200}
          aria-valuenow={aggregationTargetCount}
          onChange={evt => onAggregationTargetChange(Number(evt.target.value))}
        />
        <span id="aggregationCounter" className="controls__value" aria-live="polite">
          {aggregationTargetCount}
        </span>
      </div>

      <div className="controls__row is-hidden" id="partColorControls">
        <label className="controls__label" htmlFor="partColorInput">
          Part Color
        </label>
        <div className="color-picker">
          <input
            id="partColorInput"
            type="color"
            value={currentColor}
            aria-label="Pick part color"
            onChange={evt => onColorChange(evt.target.value)}
          />
          <span id="partColorValue" className="color-value">
            {currentColor.toUpperCase()}
          </span>
        </div>
        <span id="partColorName" className="controls__value controls__value--center"></span>
      </div>
    </section>
  );
}
