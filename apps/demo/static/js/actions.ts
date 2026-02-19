// @ts-nocheck
import {
    Visualizer,
    createAggregationFromData,
    getAggregationCatalogParts,
    applyAggregationColors,
    setAggregationPartCount,
} from 'webwaspjs';
import { availableSets } from './config.js';
import { state, refs, getSetPreviewState } from './store.ts';
import { loadJson, resolveColors, setLoading } from './io.ts';
import { resetAggregationViewer, resetPartViewer, renderPart, frameAggregationScene, centerCameraOnMesh } from './viewport.ts';

export function populateSetList() {
    refs.setList.innerHTML = '';
    availableSets.forEach((set, idx) => {
        const button = document.createElement('button');
        button.className = `set-card${idx === 0 ? ' is-active' : ''}`;
        button.dataset.set = set.name;
        button.title = set.description ? `${set.description}${set.author ? ` — ${set.author}` : ''}` : (set.author || '');
        const previewId = `set-preview-${set.slug}`;
        button.innerHTML = `
            <div class="set-card__preview">
                <div class="set-card__preview-canvas" id="${previewId}"></div>
                <div class="set-card__nav set-card__nav--prev" data-dir="-1" aria-label="Previous part">◀</div>
                <div class="set-card__nav set-card__nav--next" data-dir="1" aria-label="Next part">▶</div>
            </div>
            <div class="set-card__footer">
                <div class="set-card__name">${set.name}</div>
            </div>
        `;
        button.addEventListener('click', () => loadSet(set.name));

        button.querySelectorAll('.set-card__nav').forEach(nav => {
            nav.addEventListener('click', evt => {
                evt.stopPropagation();
                const delta = Number(nav.dataset.dir) || 0;
                nudgeSetPreview(set.name, delta);
            });
        });
        refs.setList.appendChild(button);
    });
}

export function highlightActiveSet(setName) {
    const cards = Array.from(refs.setList.querySelectorAll('.set-card'));
    cards.forEach(card => {
        card.classList.toggle('is-active', card.dataset.set === setName);
    });
}

export async function loadSet(setName) {
    const set = availableSets.find(s => s.name === setName);
    if (!set) {
        console.error(`Set with name ${setName} not found`);
        return;
    }

    state.currentSet = set;

    state.aggregation = null;
    state.aggregationData = null;
    state.partsList = [];
    state.partIndex = 0;
    resetAggregationViewer();
    resetPartViewer();
    highlightActiveSet(setName);
    const targetCount = Number(refs.aggregationSlider.value);

    try {
        if (!set.aggregation) {
            throw new Error(`Set ${set.name} is missing aggregation filename`);
        }

        setLoading(refs, true, `Loading ${set.name}…`);
        const data = await loadJson(`${set.path}${set.aggregation}`);
        const colorsConfig = await resolveColors(set);
        state.aggregationData = data;
        state.aggregation = createAggregationFromData(data);
        state.currentColors = colorsConfig;
        applyAggregationColors(state.aggregation, colorsConfig);

        state.partsList = getAggregationCatalogParts(state.aggregation);
        state.setPartsCache[set.name] = state.partsList;
        await setAggregationPartCount(state.aggregation, targetCount, state.waspVisualization);
        frameAggregationScene(state.waspVisualization);
        renderSetPreview(set.name, 0);
        updateSetPreviewNav(set.name);
        if (refs.setNameLabel) refs.setNameLabel.textContent = set.name;
        populateInfoModal();
        renderPart(state.partIndex);
    } catch (error) {
        console.error('Error loading set:', error);
        console.error(`Failed to load ${set.name}: ${error.message}`);
    }
    setLoading(refs, false);
}

export function setMode(mode) {
    if (mode === state.currentMode) return;
    state.currentMode = mode;

    refs.modeButtons.forEach(btn => btn.classList.toggle('is-active', btn.dataset.mode === mode));

    const isAgg = mode === 'aggregation';
    refs.aggCanvas.classList.toggle('is-hidden', !isAgg);
    refs.partCanvas.classList.toggle('is-hidden', isAgg);
    refs.aggregationControls.classList.toggle('is-hidden', !isAgg);
    refs.partOverlay.classList.toggle('is-hidden', isAgg || !state.partsList.length);
    refs.partCaption.classList.toggle('is-hidden', isAgg || !state.partsList.length);
    refs.partColorControls?.classList.toggle('is-hidden', isAgg || !state.partsList.length);
}

export function updateCurrentPartColor(hex) {
    const part = state.partsList[state.partIndex];
    if (!part) return;
    state.currentColors = state.currentColors || {};
    state.currentColors.byPart = state.currentColors.byPart || {};
    state.currentColors.byPart[part.name] = hex;
    refs.partColorValue.textContent = hex.toUpperCase();
    refs.partColorInput.value = hex;

    applyAggregationColors(state.aggregation, state.currentColors);
    const targetCount = Number(refs.aggregationSlider.value);
    setAggregationPartCount(state.aggregation, targetCount, state.waspVisualization);

    const previewMesh = state.partVisualization?.scene?.children?.find(child => child.name === `${part.name}_preview`);
    if (previewMesh?.material?.color) {
        previewMesh.material.color.set(hex);
    }
}

export function ensureSetPreviewViz(setName) {
    const set = availableSets.find(s => s.name === setName);
    if (!set) return null;
    const statePreview = getSetPreviewState(setName);
    if (statePreview.viz) return statePreview.viz;
    const selector = `#set-preview-${set.slug}`;
    statePreview.viz = new Visualizer(selector, selector);
    if (statePreview.viz?.cameraControls) {
        statePreview.viz.cameraControls.enabled = false;
    }
    return statePreview.viz;
}

export function renderSetPreview(setName, nextIndex = 0) {
    const parts = state.setPartsCache[setName];
    if (!parts || !parts.length) return;
    const statePreview = getSetPreviewState(setName);
    const viz = ensureSetPreviewViz(setName);
    if (!viz) return;

    const normalized = ((nextIndex % parts.length) + parts.length) % parts.length;
    const part = parts[normalized];

    if (statePreview.mesh && viz.scene) {
        viz.scene.remove(statePreview.mesh);
    }

    const mesh = part.geo.clone();
    mesh.name = `${part.name}_set_preview`;
    viz.scene.add(mesh);
    centerCameraOnMesh(viz, mesh, 2.2);

    statePreview.mesh = mesh;
    statePreview.index = normalized;
}

export function nudgeSetPreview(setName, delta) {
    const statePreview = getSetPreviewState(setName);
    renderSetPreview(setName, statePreview.index + delta);
    updateSetPreviewNav(setName);
}

export function updateSetPreviewNav(setName) {
    const parts = state.setPartsCache[setName] || [];
    const card = Array.from(refs.setList.querySelectorAll('.set-card')).find(el => el.dataset.set === setName);
    if (!card) return;
    const navs = card.querySelectorAll('.set-card__nav');
    navs.forEach(nav => nav.classList.toggle('is-hidden', parts.length <= 1));
}

export async function warmAllPreviews() {
    for (const set of availableSets) {
        await warmPreview(set);
    }
}

export async function warmPreview(set) {
    if (state.setPartsCache[set.name]) return;
    try {
        const data = await loadJson(`${set.path}${set.aggregation}`);
        const colorsConfig = await resolveColors(set);
        const agg = createAggregationFromData(data);
        applyAggregationColors(agg, colorsConfig);
        const parts = getAggregationCatalogParts(agg);
        state.setPartsCache[set.name] = parts;
        renderSetPreview(set.name, 0);
        updateSetPreviewNav(set.name);
    } catch (err) {
        console.warn(`Preview warm failed for ${set.name}: ${err.message}`);
    }
}

export function populateInfoModal() {
    if (!state.currentSet || !refs.infoModal) return;
    refs.infoModalTitle.textContent = state.currentSet.name || 'Set Info';
    refs.infoModalSet.textContent = state.currentSet.name || '—';
    refs.infoModalDesc.textContent = state.currentSet.description || '—';
    refs.infoModalAuthor.textContent = state.currentSet.author || '—';
}

export function openInfoModal() {
    populateInfoModal();
    refs.infoModal?.classList.add('is-open');
}

export function closeInfoModal() {
    refs.infoModal?.classList.remove('is-open');
}
