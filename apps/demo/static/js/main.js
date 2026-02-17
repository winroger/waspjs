import { Visualizer, Aggregation } from 'webwaspjs';
import { availableSets, demoTheme } from './config.js';

let aggregation;
let waspVisualization;
let statusEl;

// Cache DOM elements
const aggregationSlider = document.getElementById('aggregationSlider');
const aggregationCounterDisplay = document.getElementById('aggregationCounter');
const setSelector = document.getElementById('setSelector');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');

document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    statusEl = document.getElementById('statusMessage');
    populateSetSelector();
    logAvailableSetsValidity();
    const initialSetName = availableSets[0]?.name;
    if (!initialSetName) {
        throw new Error('No available sets configured');
    }
    aggregationCounterDisplay.innerHTML = aggregationSlider.value;
    loadSet(initialSetName);
});

setSelector.addEventListener('change', event => {
    loadSet(event.target.value);
});

aggregationSlider.addEventListener('input', event => {
    const targetCount = Number(event.target.value);
    aggregationCounterDisplay.innerHTML = targetCount;
    if (aggregation) {
        aggregation.modifyParts(targetCount, waspVisualization);
    }
});

function populateSetSelector() {
    setSelector.innerHTML = '';
    availableSets.forEach((set, idx) => {
        const option = document.createElement('option');
        option.value = set.name;
        option.textContent = set.name;
        if (idx === 0) {
            option.selected = true;
        }
        setSelector.appendChild(option);
    });
}

async function loadSet(setName) {
    const set = availableSets.find(s => s.name === setName);
    if (!set) {
        console.error(`Set with name ${setName} not found`);
        return;
    }

    aggregation = null;
    resetVisualizer();
    const targetCount = Number(aggregationSlider.value);

    try {
        if (!set.aggregation) {
            throw new Error(`Set ${set.name} is missing aggregation filename`);
        }

        setLoading(true, `Loading ${set.name}…`);
        const data = await loadJson(`${set.path}${set.aggregation}`);
        aggregation = Aggregation.fromData(data);

        aggregation.modifyParts(targetCount, waspVisualization);
        setStatus(`Loaded ${set.name}`, 'success');
    } catch (error) {
        console.error('Error loading set:', error);
        setStatus(`Failed to load ${set.name}: ${error.message}`, 'error');
    }
    setLoading(false);
}

function resetVisualizer() {
    const container = document.querySelector('#threejs-container');
    container.innerHTML = '';
    waspVisualization = new Visualizer('#threejs-container');
}

async function loadJson(path) {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Failed to load ${path}: ${response.status}`);
    }
    return response.json();
}

function logAvailableSetsValidity() {
    availableSets.forEach(set => {
        console.log(`[demo] Set: ${set.name} | mode: aggregation | path: ${set.path}${set.aggregation ?? ''}`);
    });
}

function setLoading(isLoading, message = '') {
    if (!loadingOverlay || !loadingText) return;
    loadingOverlay.style.opacity = isLoading ? '1' : '0';
    loadingOverlay.style.pointerEvents = isLoading ? 'auto' : 'none';
    loadingText.textContent = message;
}

function setStatus(message, variant = 'info') {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.dataset.variant = variant;
}

function applyTheme() {
    const root = document.documentElement;
    Object.entries(demoTheme).forEach(([key, value]) => {
        root.style.setProperty(`--${key}`, value);
    });
}