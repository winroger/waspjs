import { Visualizer } from 'webwaspjs';
import { Aggregation } from 'webwaspjs';
import { availableSets } from './config.js';

let aggregation;
let waspVisualization;

const SELECTED_SET_NAME=  "Corner";

// Cache DOM elements
const aggregationSlider = document.getElementById('aggregationSlider');
const aggregationCounterDisplay = document.getElementById('aggregationCounter');

// THREE JS INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    let targetCount = aggregationSlider.value;
    aggregationCounterDisplay.innerHTML = targetCount;
    const containerId = '#threejs-container';
    waspVisualization = new Visualizer(containerId);

    const selectedSet = availableSets.find(set => set.Name === SELECTED_SET_NAME);
    if (!selectedSet) {
        throw new Error(`Set with name ${SELECTED_SET_NAME} not found`);
    }
    initializeWaspJs(selectedSet, targetCount);
});

/////////// INITIALIZE FROM AGGREGATION FILE ///////////
async function initializeWaspJs(set, count) {
    if (set.aggregationFile) {
        try {
            console.log("Loading aggregation from file: ", set.aggregationFile);
            const response = await fetch(`${set.Path}${set.aggregationFile}`);
            const data = await response.json();
            aggregation = Aggregation.fromData(data);
            aggregation.modifyParts(count, waspVisualization);
        } catch (error) {
            console.error("Error loading aggregation: ", error);
        }
    } else {
        console.log("No aggregation file found.");
    }
}

/////////// LOCAL UTILITY FUNCTIONS ///////////

aggregationSlider.addEventListener('input', event => {
    let targetCount = event.target.value;
    aggregationCounterDisplay.innerHTML = targetCount;
    if (aggregation) {
        aggregation.modifyParts(targetCount, waspVisualization);
    }
});
