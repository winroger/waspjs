import React from 'react';
import { Controls } from './Controls';

type ControlsPanelProps = {
  aggregationTargetCount: number;
  currentColor: string;
  onAggregationTargetChange: (nextValue: number) => void;
  onColorChange: (hex: string) => void;
};

export function ControlsPanel(props: ControlsPanelProps) {
  return <Controls {...props} />;
}
