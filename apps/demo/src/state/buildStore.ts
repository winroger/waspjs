import { create } from 'zustand';
import type { BuildMode, BuildState, PartCatalogEntry, UploadedDatasetPayload } from './buildState';
import { initialBuildState } from './buildState';

type BuildActions = {
  setLoaded: (payload: { slug: string; setName: string; catalog: PartCatalogEntry[] }) => void;
  setLoading: (isLoading: boolean) => void;
  setLoadError: (loadError: string | null) => void;
  setBuildMode: (mode: BuildMode) => void;
  setAggregationTarget: (targetCount: number) => void;
  togglePartActive: (partName: string) => void;
  selectPart: (partName: string | null) => void;
  setHoveredGhost: (ghostIndex: number | null) => void;
  setPartColor: (payload: { name: string; color: string }) => void;
  setCatalog: (catalog: PartCatalogEntry[]) => void;
  setInfoOpen: (isInfoOpen: boolean) => void;
  setUploadedDataset: (payload: UploadedDatasetPayload) => void;
  clearUploadedDataset: () => void;
  resetBuildState: () => void;
};

type BuildStore = BuildState & BuildActions;

export const useBuildStore = create<BuildStore>((set) => ({
  ...initialBuildState,

  setLoaded: ({ slug, setName, catalog }) =>
    set({
      slug,
      setName,
      catalog,
      isLoading: false,
      loadError: null,
    }),

  setLoading: (isLoading) => set({ isLoading }),

  setLoadError: (loadError) => set({ loadError, isLoading: false }),

  setBuildMode: (buildMode) =>
    set((state) => ({
      buildMode,
      selectedPartName: buildMode === 'manual' ? (state.catalog[0]?.name ?? null) : null,
      hoveredGhostIndex: null,
    })),

  setAggregationTarget: (aggregationTargetCount) => set({ aggregationTargetCount }),

  togglePartActive: (partName) =>
    set((state) => ({
      catalog: state.catalog.map((entry) =>
        entry.name === partName ? { ...entry, active: !entry.active } : entry,
      ),
    })),

  selectPart: (selectedPartName) => set({ selectedPartName, hoveredGhostIndex: null }),

  setHoveredGhost: (hoveredGhostIndex) => set({ hoveredGhostIndex }),

  setPartColor: ({ name, color }) =>
    set((state) => ({
      catalog: state.catalog.map((entry) =>
        entry.name === name ? { ...entry, color } : entry,
      ),
    })),

  setCatalog: (catalog) => set({ catalog }),

  setInfoOpen: (isInfoOpen) => set({ isInfoOpen }),

  setUploadedDataset: (uploadedDataset) => set({ uploadedDataset }),

  clearUploadedDataset: () => set({ uploadedDataset: null }),

  resetBuildState: () => set({ ...initialBuildState }),
}));
