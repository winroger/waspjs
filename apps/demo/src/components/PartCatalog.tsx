import React from 'react';
import type { PartCatalogEntry, BuildMode } from '../state/buildState';

type Props = {
  catalog: PartCatalogEntry[];
  selectedPartName: string | null;
  buildMode: BuildMode;
  onToggleActive: (name: string) => void;
  onColorChange: (name: string, hex: string) => void;
  onSelectPart: (name: string | null) => void;
};

export function PartCatalog({
  catalog,
  selectedPartName,
  buildMode,
  onToggleActive,
  onColorChange,
  onSelectPart,
}: Props) {
  return (
    <div className="part-catalog">
      <h3 className="part-catalog__title">Parts</h3>
      <ul className="part-catalog__list">
        {catalog.map((entry) => {
          const isSelected = entry.name === selectedPartName;
          return (
            <li
              key={entry.name}
              className={`part-catalog__item ${isSelected ? 'part-catalog__item--selected' : ''} ${!entry.active ? 'part-catalog__item--inactive' : ''}`}
            >
              {/* Active toggle (random mode) – left side */}
              {buildMode === 'random' && (
                <button
                  className={`part-catalog__toggle ${entry.active ? 'part-catalog__toggle--on' : ''}`}
                  onClick={() => onToggleActive(entry.name)}
                  title={entry.active ? 'Deactivate' : 'Activate'}
                >
                  {entry.active ? '✓' : '✗'}
                </button>
              )}

              {/* Name – click to select in manual mode */}
              <button
                className="part-catalog__name"
                onClick={() => {
                  if (buildMode === 'manual') {
                    onSelectPart(isSelected ? null : entry.name);
                  }
                }}
                title={buildMode === 'manual' ? 'Select for placement' : entry.name}
              >
                {entry.name}
              </button>

              {/* Color swatch + picker – right side */}
              <label className="part-catalog__color" title="Change color">
                <span
                  className="part-catalog__swatch"
                  style={{ backgroundColor: entry.color }}
                />
                <input
                  type="color"
                  className="part-catalog__color-input"
                  value={entry.color}
                  onChange={(e) => onColorChange(entry.name, e.target.value)}
                />
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
