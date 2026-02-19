import { availableSets } from './config.js';

export const state: any = {
    aggregation: null,
    aggregationData: null,
    waspVisualization: null,
    partVisualization: null,
    partsList: [],
    partIndex: 0,
    currentColors: null,
    currentMode: 'aggregation',
    currentSet: null,
    setPreviewStates: {},
    setPartsCache: {},
};

export const refs: any = {
    aggregationSlider: document.getElementById('aggregationSlider'),
    aggregationCounterDisplay: document.getElementById('aggregationCounter'),
    setList: document.getElementById('setList'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    loadingText: document.getElementById('loadingText'),
    modeButtons: Array.from(document.querySelectorAll('[data-mode]')),
    aggregationControls: document.getElementById('aggregationControls'),
    partColorControls: document.getElementById('partColorControls'),
    partColorInput: document.getElementById('partColorInput'),
    partColorValue: document.getElementById('partColorValue'),
    partColorName: document.getElementById('partColorName'),
    partOverlay: document.getElementById('partOverlay'),
    partCaption: document.getElementById('partCaption'),
    partCaptionName: document.getElementById('partCaptionName'),
    partCaptionCounter: document.getElementById('partCaptionCounter'),
    setNameLabel: document.getElementById('setNameLabel'),
    prevPartBtn: document.getElementById('prevPart'),
    nextPartBtn: document.getElementById('nextPart'),
    aggCanvas: document.getElementById('agg-viewer'),
    partCanvas: document.getElementById('part-viewer'),
    infoButton: document.getElementById('infoButton'),
    infoModal: document.getElementById('infoModal'),
    infoModalClose: document.getElementById('infoModalClose'),
    infoModalTitle: document.getElementById('infoModalTitle'),
    infoModalSet: document.getElementById('infoModalSet'),
    infoModalDesc: document.getElementById('infoModalDesc'),
    infoModalAuthor: document.getElementById('infoModalAuthor'),
};

export function getSetPreviewState(setName: string) {
    if (!state.setPreviewStates[setName]) {
        state.setPreviewStates[setName] = { index: 0, viz: null, mesh: null };
    }
    return state.setPreviewStates[setName];
}

export function getInitialSetName() {
    if (!availableSets.length) return null;
    return availableSets[0]?.name ?? null;
}
