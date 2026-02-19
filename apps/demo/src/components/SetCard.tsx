import React from 'react';
import type { DemoSetConfig } from '../config/availableSets';

type SetCardProps = {
  set: DemoSetConfig;
  isActive: boolean;
  onLoadSet: (setName: string) => void;
  onNudgePreview: (setName: string, delta: number) => void;
};

export function SetCard({ set, isActive, onLoadSet, onNudgePreview }: SetCardProps) {
  const previewId = `set-preview-${set.slug}`;

  return (
    <button
      className={`set-card${isActive ? ' is-active' : ''}`}
      data-set={set.name}
      title={set.description ? `${set.description}${set.author ? ` — ${set.author}` : ''}` : set.author || ''}
      onClick={() => onLoadSet(set.name)}
    >
      <div className="set-card__preview">
        <div className="set-card__preview-canvas" id={previewId}></div>
        <div
          className="set-card__nav set-card__nav--prev"
          aria-label="Previous part"
          onClick={evt => {
            evt.stopPropagation();
            onNudgePreview(set.name, -1);
          }}
        >
          ◀
        </div>
        <div
          className="set-card__nav set-card__nav--next"
          aria-label="Next part"
          onClick={evt => {
            evt.stopPropagation();
            onNudgePreview(set.name, 1);
          }}
        >
          ▶
        </div>
      </div>
      <div className="set-card__footer">
        <div className="set-card__name">{set.name}</div>
      </div>
    </button>
  );
}
