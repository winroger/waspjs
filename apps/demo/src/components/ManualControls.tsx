import React from 'react';

type Props = {
  selectedPartName: string | null;
  partCount: number;
};

export function ManualControls({ selectedPartName, partCount }: Props) {
  return (
    <div className="manual-controls">
      <h3 className="manual-controls__title">Manual Placement</h3>

      <p className="manual-controls__info">
        {selectedPartName
          ? <>Placing: <strong>{selectedPartName}</strong></>
          : 'Select a part from the catalog'}
      </p>

      <p className="manual-controls__count">
        Parts placed: <strong>{partCount}</strong>
      </p>

      <div className="manual-controls__hints">
        <p><kbd>Click</kbd> ghost to place</p>
        <p><kbd>Right-click</kbd> part to remove</p>
        <p><kbd>Esc</kbd> to deselect</p>
      </div>
    </div>
  );
}
