import { availableSets } from './config.js';
import { setAggregationPartCount } from 'webwaspjs';
import { state, refs, getInitialSetName } from './store.ts';
import { normalizeHex, logAvailableSetsValidity } from './io.ts';
import { renderPart } from './viewport.ts';
import {
    populateSetList,
    loadSet,
    setMode,
    openInfoModal,
    closeInfoModal,
    updateCurrentPartColor,
    warmAllPreviews,
} from './actions.ts';

export function bootApp() {
    document.addEventListener('DOMContentLoaded', () => {
        populateSetList();
        logAvailableSetsValidity(availableSets);

        if (!availableSets.length) {
            console.error('No example configs found in public/examples');
            return;
        }

        const initialSetName = getInitialSetName();
        refs.aggregationCounterDisplay.textContent = refs.aggregationSlider.value;
        refs.setNameLabel.textContent = initialSetName;
        if (initialSetName) loadSet(initialSetName);
        warmAllPreviews();
    });

    refs.modeButtons.forEach((btn: any) => {
        btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });

    refs.infoButton?.addEventListener('click', openInfoModal);
    refs.infoModalClose?.addEventListener('click', closeInfoModal);
    refs.infoModal?.addEventListener('click', (evt: any) => {
        if (evt.target === refs.infoModal || evt.target.classList.contains('modal__backdrop')) {
            closeInfoModal();
        }
    });

    document.addEventListener('keydown', evt => {
        if (evt.key === 'Escape' && refs.infoModal?.classList.contains('is-open')) closeInfoModal();
    });

    refs.aggregationSlider.addEventListener('input', (event: any) => {
        const targetCount = Number(event.target.value);
        refs.aggregationCounterDisplay.textContent = targetCount;
        setAggregationPartCount(state.aggregation, targetCount, state.waspVisualization);
    });

    refs.prevPartBtn.addEventListener('click', () => renderPart(state.partIndex - 1));
    refs.nextPartBtn.addEventListener('click', () => renderPart(state.partIndex + 1));
    refs.partColorInput?.addEventListener('input', (event: any) => {
        const hex = normalizeHex(event.target.value);
        updateCurrentPartColor(hex);
    });
}
