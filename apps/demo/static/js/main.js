import { Visualizer, Aggregation } from 'webwaspjs';
import { Box3, Vector3 } from 'three';
import { availableSets } from './config.js';

let aggregation;
let aggregationData;
let waspVisualization;
let partVisualization;
let partsList = [];
let partIndex = 0;
let currentColors = null;
let currentMode = 'aggregation';

// Cache DOM elements
const aggregationSlider = document.getElementById('aggregationSlider');
const aggregationCounterDisplay = document.getElementById('aggregationCounter');
const setList = document.getElementById('setList');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const modeButtons = Array.from(document.querySelectorAll('[data-mode]'));
const aggregationControls = document.getElementById('aggregationControls');
const partColorControls = document.getElementById('partColorControls');
const partColorInput = document.getElementById('partColorInput');
const partColorValue = document.getElementById('partColorValue');
const partColorName = document.getElementById('partColorName');
const partOverlay = document.getElementById('partOverlay');
const partCaption = document.getElementById('partCaption');
const partCaptionName = document.getElementById('partCaptionName');
const partCaptionCounter = document.getElementById('partCaptionCounter');
const prevPartBtn = document.getElementById('prevPart');
const nextPartBtn = document.getElementById('nextPart');
const aggCanvas = document.getElementById('agg-viewer');
const partCanvas = document.getElementById('part-viewer');
const setPreviewStates = {};
const setPartsCache = {};

document.addEventListener('DOMContentLoaded', () => {
    populateSetList();
    logAvailableSetsValidity();

    if (!availableSets.length) {
        console.error('No example configs found in public/examples');
        return;
    }

    const initialSetName = availableSets[0].name;
    aggregationCounterDisplay.textContent = aggregationSlider.value;
    loadSet(initialSetName);
    warmAllPreviews();
});

modeButtons.forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
});

aggregationSlider.addEventListener('input', event => {
    const targetCount = Number(event.target.value);
    aggregationCounterDisplay.textContent = targetCount;
    if (aggregation) {
        aggregation.modifyParts(targetCount, waspVisualization);
    }
});

prevPartBtn.addEventListener('click', () => renderPart(partIndex - 1));
nextPartBtn.addEventListener('click', () => renderPart(partIndex + 1));
partColorInput?.addEventListener('input', event => {
    const hex = normalizeHex(event.target.value);
    updateCurrentPartColor(hex);
});

function populateSetList() {
    setList.innerHTML = '';
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
        setList.appendChild(button);
    });
}

function highlightActiveSet(setName) {
    const cards = Array.from(setList.querySelectorAll('.set-card'));
    cards.forEach(card => {
        card.classList.toggle('is-active', card.dataset.set === setName);
    });
}

async function loadSet(setName) {
    const set = availableSets.find(s => s.name === setName);
    if (!set) {
        console.error(`Set with name ${setName} not found`);
        return;
    }

    aggregation = null;
    aggregationData = null;
    partsList = [];
    partIndex = 0;
    resetAggregationViewer();
    resetPartViewer();
    highlightActiveSet(setName);
    const targetCount = Number(aggregationSlider.value);

    try {
        if (!set.aggregation) {
            throw new Error(`Set ${set.name} is missing aggregation filename`);
        }

        setLoading(true, `Loading ${set.name}…`);
        const data = await loadJson(`${set.path}${set.aggregation}`);
        const colorsConfig = await resolveColors(set);
        aggregationData = data;
        aggregation = Aggregation.fromData(data);
        currentColors = colorsConfig;
        applyColors(aggregation, colorsConfig);

        partsList = Object.values(aggregation.parts || {});
        setPartsCache[set.name] = partsList;
        aggregation.modifyParts(targetCount, waspVisualization);
        frameAggregationScene(waspVisualization);
        renderSetPreview(set.name, 0);
        updateSetPreviewNav(set.name);
        // loaded successfully
        renderPart(partIndex);
    } catch (error) {
        console.error('Error loading set:', error);
        console.error(`Failed to load ${set.name}: ${error.message}`);
    }
    setLoading(false);
}

function resetAggregationViewer() {
    aggCanvas.innerHTML = '';
    waspVisualization = new Visualizer('#agg-viewer', '#viewerArea');
}

function resetPartViewer() {
    partCanvas.innerHTML = '';
    partVisualization = new Visualizer('#part-viewer', '#viewerArea');
}

async function loadJson(path) {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Failed to load ${path}: ${response.status}`);
    }
    return response.json();
}

async function loadColors(path) {
    try {
        const response = await fetch(path);
        if (!response.ok) return null;
        return response.json();
    } catch (err) {
        console.warn(`Could not load colors from ${path}: ${err.message}`);
        return null;
    }
}

async function resolveColors(set) {
    const hasConfigColors = (set.colors && set.colors.length) || Object.keys(set.byPart || {}).length;
    if (hasConfigColors) {
        return {
            colors: set.colors || [],
            byPart: set.byPart || {},
        };
    }
    return loadColors(`${set.path}colors.json`);
}

function renderPart(nextIndex) {
    const inPartsMode = currentMode === 'parts';
    if (!partsList.length) {
        partCaptionName.textContent = 'No parts available';
        partCaptionCounter.textContent = '';
        partCaption.classList.toggle('is-hidden', !inPartsMode);
        partOverlay.classList.add('is-hidden');
        return;
    }

    const prevIndex = partIndex;
    const normalizedIndex = (nextIndex + partsList.length) % partsList.length;
    partIndex = normalizedIndex;
    const part = partsList[partIndex];

    resetPartViewer();
    // No transition for instant swaps; uncomment to re-enable slide-in
    // const direction = normalizedIndex > prevIndex || (prevIndex === partsList.length - 1 && normalizedIndex === 0) ? 'right' : 'left';
    // applyPartTransition(direction);

    const mesh = part.geo.clone();
    mesh.name = `${part.name}_preview`;
    partVisualization.scene.add(mesh);

    centerCameraOnMesh(partVisualization, mesh);

    partCaptionName.textContent = part.name;
    partCaptionCounter.textContent = `${partIndex + 1} / ${partsList.length}`;
    partCaption.classList.toggle('is-hidden', !inPartsMode);
    partOverlay.classList.toggle('is-hidden', !inPartsMode);
    syncColorPicker(part, partIndex, inPartsMode);
}

function centerCameraOnMesh(viz, mesh, distanceScale = 3) {
    const geom = mesh.geometry;
    if (!geom.boundingSphere) {
        geom.computeBoundingSphere();
    }
    const sphere = geom.boundingSphere;
    const radius = sphere.radius || 1;
    const center = sphere.center.clone().applyMatrix4(mesh.matrixWorld);
    const distance = radius * distanceScale;

    viz.camera.position.set(center.x + distance, center.y + distance, center.z + distance);
    if (viz.cameraControls) {
        viz.cameraControls.setLookAt(
            center.x + distance,
            center.y + distance,
            center.z + distance,
            center.x,
            center.y,
            center.z,
            false
        );
    }
}

function setMode(mode) {
    if (mode === currentMode) return;
    currentMode = mode;

    modeButtons.forEach(btn => btn.classList.toggle('is-active', btn.dataset.mode === mode));

    const isAgg = mode === 'aggregation';
    aggCanvas.classList.toggle('is-hidden', !isAgg);
    partCanvas.classList.toggle('is-hidden', isAgg);
    aggregationControls.classList.toggle('is-hidden', !isAgg);
    partOverlay.classList.toggle('is-hidden', isAgg || !partsList.length);
    partCaption.classList.toggle('is-hidden', isAgg || !partsList.length);
    partColorControls?.classList.toggle('is-hidden', isAgg || !partsList.length);
}

function logAvailableSetsValidity() {
    availableSets.forEach(set => {
        console.log(`[demo] Set: ${set.name} | path: ${set.path}${set.aggregation ?? ''} | author: ${set.author || 'n/a'}`);
    });
}

function setLoading(isLoading, message = '') {
    if (!loadingOverlay || !loadingText) return;
    loadingOverlay.style.opacity = isLoading ? '1' : '0';
    loadingOverlay.style.pointerEvents = isLoading ? 'auto' : 'none';
    loadingText.textContent = message;
}

function applyPartTransition(direction) {
    partCanvas.classList.remove('slide-in-left', 'slide-in-right');
    // force reflow to restart animation
    void partCanvas.offsetWidth;
    partCanvas.classList.add(direction === 'right' ? 'slide-in-right' : 'slide-in-left');
}

function applyColors(aggregation, colorsConfig) {
    if (!colorsConfig) return;
    const palette = colorsConfig.colors || colorsConfig.palette || [];
    const byPart = colorsConfig.byPart || {};
    const parts = Object.values(aggregation.parts || {});
    parts.forEach((part, idx) => {
        const color = byPart[part.name] || palette[idx % palette.length];
        if (color && part.geo?.material?.color) {
            part.geo.material.color.set(color);
        }
    });
}

function updateCurrentPartColor(hex) {
    const part = partsList[partIndex];
    if (!part) return;
    currentColors = currentColors || {};
    currentColors.byPart = currentColors.byPart || {};
    currentColors.byPart[part.name] = hex;
    partColorValue.textContent = hex.toUpperCase();
    partColorInput.value = hex;

    // Update base aggregation colors
    applyColors(aggregation, currentColors);
    const targetCount = Number(aggregationSlider.value);
    if (aggregation && waspVisualization) {
        aggregation.modifyParts(targetCount, waspVisualization);
    }

    // Update current part preview
    const previewMesh = partVisualization?.scene?.children?.find(child => child.name === `${part.name}_preview`);
    if (previewMesh?.material?.color) {
        previewMesh.material.color.set(hex);
    }
}

function syncColorPicker(part, idx, inPartsMode) {
    if (!partColorInput || !partColorValue) return;
    const palette = currentColors?.colors || currentColors?.palette || [];
    const byPart = currentColors?.byPart || {};
    const fallback = palette.length ? palette[idx % palette.length] : '#ffffff';
    const hex = normalizeHex(byPart[part.name] || fallback);
    partColorInput.value = hex;
    partColorValue.textContent = hex.toUpperCase();
    partColorName.textContent = part.name;
    partColorControls?.classList.toggle('is-hidden', !inPartsMode);
}

function normalizeHex(value) {
    if (!value) return '#ffffff';
    const v = value.trim();
    if (v.startsWith('#')) {
        return v.length === 7 ? v : v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : '#ffffff';
    }
    if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v}`;
    if (/^[0-9a-fA-F]{3}$/.test(v)) return `#${v[0]}${v[0]}${v[1]}${v[1]}${v[2]}${v[2]}`;
    return '#ffffff';
}

function frameAggregationScene(viz) {
    if (!viz?.scene || !viz?.camera) return;
    const box = new Box3().setFromObject(viz.scene);
    if (!isFinite(box.max.x) || box.isEmpty()) return;

    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const distance = maxDim * 0.8;

    viz.camera.position.set(center.x + distance, center.y + distance, center.z + distance);
    if (viz.cameraControls) {
        viz.cameraControls.setLookAt(
            center.x + distance,
            center.y + distance,
            center.z + distance,
            center.x,
            center.y,
            center.z,
            false
        );
    } else {
        viz.camera.lookAt(center);
    }
}

function getSetPreviewState(setName) {
    if (!setPreviewStates[setName]) {
        setPreviewStates[setName] = { index: 0, viz: null, mesh: null };
    }
    return setPreviewStates[setName];
}

function ensureSetPreviewViz(setName) {
    const set = availableSets.find(s => s.name === setName);
    if (!set) return null;
    const state = getSetPreviewState(setName);
    if (state.viz) return state.viz;
    const selector = `#set-preview-${set.slug}`;
    state.viz = new Visualizer(selector, selector);
    if (state.viz?.cameraControls) {
        state.viz.cameraControls.enabled = false;
    }
    return state.viz;
}

function renderSetPreview(setName, nextIndex = 0) {
    const parts = setPartsCache[setName];
    if (!parts || !parts.length) return;
    const state = getSetPreviewState(setName);
    const viz = ensureSetPreviewViz(setName);
    if (!viz) return;

    const normalized = ((nextIndex % parts.length) + parts.length) % parts.length;
    const part = parts[normalized];

    if (state.mesh && viz.scene) {
        viz.scene.remove(state.mesh);
    }

    const mesh = part.geo.clone();
    mesh.name = `${part.name}_set_preview`;
    viz.scene.add(mesh);
    centerCameraOnMesh(viz, mesh, 2.2);

    state.mesh = mesh;
    state.index = normalized;
}

function nudgeSetPreview(setName, delta) {
    const state = getSetPreviewState(setName);
    renderSetPreview(setName, state.index + delta);
    updateSetPreviewNav(setName);
}

function updateSetPreviewNav(setName) {
    const parts = setPartsCache[setName] || [];
    const card = Array.from(setList.querySelectorAll('.set-card')).find(el => el.dataset.set === setName);
    if (!card) return;
    const navs = card.querySelectorAll('.set-card__nav');
    navs.forEach(nav => nav.classList.toggle('is-hidden', parts.length <= 1));
}

async function warmAllPreviews() {
    for (const set of availableSets) {
        await warmPreview(set);
    }
}

async function warmPreview(set) {
    if (setPartsCache[set.name]) return;
    try {
        const data = await loadJson(`${set.path}${set.aggregation}`);
        const colorsConfig = await resolveColors(set);
        const agg = Aggregation.fromData(data);
        applyColors(agg, colorsConfig);
        const parts = Object.values(agg.parts || {});
        setPartsCache[set.name] = parts;
        renderSetPreview(set.name, 0);
        updateSetPreviewNav(set.name);
    } catch (err) {
        console.warn(`Preview warm failed for ${set.name}: ${err.message}`);
    }
}