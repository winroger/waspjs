//import { Visualizer } from '../../../src/waspVisualizer.js';
//import { Aggregation } from '../../../src/waspAggregation.js';
import { Visualizer, Aggregation, buildAggregationFromPartsAndRules } from 'webwaspjs';
import { availableSets } from './config.js';

let aggregation;
let waspVisualization;

// Cache DOM elements
const aggregationSlider = document.getElementById('aggregationSlider');
const aggregationCounterDisplay = document.getElementById('aggregationCounter');
const setSelector = document.getElementById('setSelector');

document.addEventListener('DOMContentLoaded', () => {
    populateSetSelector();
    logAvailableSetsValidity();
    const initialSetName = availableSets[0]?.Name;
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
        option.value = set.Name;
        option.textContent = set.Name;
        if (idx === 0) {
            option.selected = true;
        }
        setSelector.appendChild(option);
    });
}

async function loadSet(setName) {
    const set = availableSets.find(s => s.Name === setName);
    if (!set) {
        console.error(`Set with name ${setName} not found`);
        return;
    }

    aggregation = null;
    resetVisualizer();
    const targetCount = Number(aggregationSlider.value);

    try {
        if (set.aggregationFile) {
            const data = await loadJson(`${set.Path}${set.aggregationFile}`);
            aggregation = Aggregation.fromData(data);
        } else {
            const partsData = await loadPartData(set);
            const rulesData = set.ruleFile ? await loadJson(`${set.Path}${set.ruleFile}`) : null;
            const result = buildAggregationFromPartsAndRules({
                name: set.Name,
                partsData,
                rulesData,
                autoGenerateRules: !set.ruleFile,
                allowSelf: true,
                allowSelfConnection: false,
                useTypes: true,
            });
            aggregation = result.aggregation;
        }

        aggregation.modifyParts(targetCount, waspVisualization);
    } catch (error) {
        console.error('Error loading set:', error);
    }
}

function resetVisualizer() {
    const container = document.querySelector('#threejs-container');
    container.innerHTML = '';
    waspVisualization = new Visualizer('#threejs-container');
}

async function loadPartData(set) {
    const parts = [];
    for (const fileName of set.partFiles) {
        if (!fileName) continue;
        const data = await loadJson(`${set.Path}${fileName}`);
        parts.push(data);
    }
    return parts;
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
        const mode = set.aggregationFile ? 'aggregation' : (set.ruleFile ? 'parts+rules' : 'parts (auto rules)');
        console.log(`[demo] Set: ${set.Name} | mode: ${mode} | path: ${set.Path}`);
    });
}