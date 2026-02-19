import React from 'react';
import { SetCard } from './SetCard';
import type { DemoSetConfig } from '../config/availableSets';

type SetListProps = {
  sets: DemoSetConfig[];
  activeSetName: string;
  onLoadSet: (setName: string) => void;
  onNudgePreview: (setName: string, delta: number) => void;
};

export function SetList({ sets, activeSetName, onLoadSet, onNudgePreview }: SetListProps) {
  return (
    <div className="sidebar__list" id="setList">
      {sets.map((set) => (
        <SetCard
          key={set.slug}
          set={set}
          isActive={activeSetName === set.name}
          onLoadSet={onLoadSet}
          onNudgePreview={onNudgePreview}
        />
      ))}
    </div>
  );
}
