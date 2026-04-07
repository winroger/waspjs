/* ── Build-screen state (replaces old DemoState) ── */

export type BuildMode = 'random' | 'manual';

export type PartCatalogEntry = {
  name: string;
  color: string;
  active: boolean;          // active in random mode
};

export type UploadedDatasetPayload = {
  setName: string;
  aggregationData: any;
  byPart: Record<string, string>;
};

export type BuildState = {
  /* dataset */
  slug: string;
  setName: string;
  isLoading: boolean;
  loadError: string | null;

  /* viewer */
  buildMode: BuildMode;
  aggregationTargetCount: number;  // slider value (random mode)

  /* part catalog */
  catalog: PartCatalogEntry[];
  selectedPartName: string | null; // selected for manual placement

  /* manual mode helpers */
  hoveredGhostIndex: number | null;

  /* info overlay */
  isInfoOpen: boolean;
  description: string;
  author: string;
  uploadedDataset: UploadedDatasetPayload | null;
};

export type BuildAction =
  | { type: 'setLoaded'; payload: { slug: string; setName: string; catalog: PartCatalogEntry[] } }
  | { type: 'setLoading'; payload: boolean }
  | { type: 'setLoadError'; payload: string | null }
  | { type: 'setBuildMode'; payload: BuildMode }
  | { type: 'setAggregationTarget'; payload: number }
  | { type: 'togglePartActive'; payload: string }       // toggle by part name
  | { type: 'selectPart'; payload: string | null }       // manual mode selection
  | { type: 'setHoveredGhost'; payload: number | null }
  | { type: 'setPartColor'; payload: { name: string; color: string } }
  | { type: 'setCatalog'; payload: PartCatalogEntry[] }
  | { type: 'setInfoOpen'; payload: boolean };

export const initialBuildState: BuildState = {
  slug: '',
  setName: '',
  isLoading: false,
  loadError: null,
  buildMode: 'random',
  aggregationTargetCount: 50,
  catalog: [],
  selectedPartName: null,
  hoveredGhostIndex: null,
  isInfoOpen: false,
  description: '',
  author: '',
  uploadedDataset: null,
};

export function buildReducer(state: BuildState, action: BuildAction): BuildState {
  switch (action.type) {
    case 'setLoaded':
      return {
        ...state,
        slug: action.payload.slug,
        setName: action.payload.setName,
        catalog: action.payload.catalog,
        isLoading: false,
        loadError: null,
      };

    case 'setLoading':
      return { ...state, isLoading: action.payload };

    case 'setLoadError':
      return { ...state, loadError: action.payload, isLoading: false };

    case 'setBuildMode':
      return {
        ...state,
        buildMode: action.payload,
        selectedPartName: action.payload === 'manual' ? (state.catalog[0]?.name ?? null) : null,
        hoveredGhostIndex: null,
      };

    case 'setAggregationTarget':
      return { ...state, aggregationTargetCount: action.payload };

    case 'togglePartActive': {
      const catalog = state.catalog.map((p) =>
        p.name === action.payload ? { ...p, active: !p.active } : p,
      );
      return { ...state, catalog };
    }

    case 'selectPart':
      return { ...state, selectedPartName: action.payload, hoveredGhostIndex: null };

    case 'setHoveredGhost':
      return { ...state, hoveredGhostIndex: action.payload };

    case 'setPartColor': {
      const catalog = state.catalog.map((p) =>
        p.name === action.payload.name ? { ...p, color: action.payload.color } : p,
      );
      return { ...state, catalog };
    }

    case 'setCatalog':
      return { ...state, catalog: action.payload };

    case 'setInfoOpen':
      return { ...state, isInfoOpen: action.payload };

    default:
      return state;
  }
}
