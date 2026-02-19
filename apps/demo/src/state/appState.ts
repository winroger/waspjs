export type DemoMode = 'aggregation' | 'parts';

export type DemoState = {
  currentSetName: string;
  currentMode: DemoMode;
  partIndex: number;
  partsCount: number;
  aggregationTargetCount: number;
  isLoading: boolean;
  isInfoOpen: boolean;
  currentColor: string;
};

export type DemoAction =
  | { type: 'setLoaded'; payload: { setName: string; partsCount: number; partIndex: number } }
  | { type: 'setMode'; payload: DemoMode }
  | { type: 'setPartIndex'; payload: { partIndex: number; partsCount: number } }
  | { type: 'setAggregationTargetCount'; payload: number }
  | { type: 'setLoading'; payload: boolean }
  | { type: 'setInfoOpen'; payload: boolean }
  | { type: 'setColor'; payload: string };

export const initialDemoState: DemoState = {
  currentSetName: '',
  currentMode: 'aggregation',
  partIndex: 0,
  partsCount: 0,
  aggregationTargetCount: 100,
  isLoading: false,
  isInfoOpen: false,
  currentColor: '#ffffff',
};

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'setLoaded':
      return {
        ...state,
        currentSetName: action.payload.setName,
        partsCount: action.payload.partsCount,
        partIndex: action.payload.partIndex,
      };
    case 'setMode':
      return { ...state, currentMode: action.payload };
    case 'setPartIndex':
      return {
        ...state,
        partIndex: action.payload.partIndex,
        partsCount: action.payload.partsCount,
      };
    case 'setAggregationTargetCount':
      return { ...state, aggregationTargetCount: action.payload };
    case 'setLoading':
      return { ...state, isLoading: action.payload };
    case 'setInfoOpen':
      return { ...state, isInfoOpen: action.payload };
    case 'setColor':
      return { ...state, currentColor: action.payload };
    default:
      return state;
  }
}
