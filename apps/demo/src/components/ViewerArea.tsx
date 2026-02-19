import React from 'react';
import { InfoModal } from './InfoModal';
import { ModeToggle } from './ModeToggle';
import { ViewerCanvas } from './ViewerCanvas';
import { PartOverlay } from './PartOverlay';
import { PartCaption } from './PartCaption';

type ViewerAreaProps = {
  currentMode: 'aggregation' | 'parts';
  isInfoOpen: boolean;
  onModeChange: (mode: 'aggregation' | 'parts') => void;
  onOpenInfo: () => void;
  onCloseInfo: () => void;
  onPrevPart: () => void;
  onNextPart: () => void;
};

export function ViewerArea({
  currentMode,
  isInfoOpen,
  onModeChange,
  onOpenInfo,
  onCloseInfo,
  onPrevPart,
  onNextPart,
}: ViewerAreaProps) {
  return (
    <div className="viewer-shell">
      <div className="viewer" id="viewerArea">
        <ModeToggle currentMode={currentMode} onModeChange={onModeChange} />
        <ViewerCanvas onOpenInfo={onOpenInfo} />
        <PartOverlay onPrevPart={onPrevPart} onNextPart={onNextPart} />
        <PartCaption />
      </div>

      <InfoModal isOpen={isInfoOpen} onClose={onCloseInfo} />
    </div>
  );
}
