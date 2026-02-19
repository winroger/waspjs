import React from 'react';
import { SetList } from './SetList';
import type { DemoSetConfig } from '../config/availableSets';

type SidebarProps = {
  sets: DemoSetConfig[];
  activeSetName: string;
  onLoadSet: (setName: string) => void;
  onNudgePreview: (setName: string, delta: number) => void;
};

export function Sidebar({ sets, activeSetName, onLoadSet, onNudgePreview }: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="Available datasets">
      <div className="sidebar__header">Datasets</div>
      <SetList sets={sets} activeSetName={activeSetName} onLoadSet={onLoadSet} onNudgePreview={onNudgePreview} />
    </aside>
  );
}
