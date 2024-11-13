import { waspVisualizer } from '../src/waspVisualizer.js';
import { Part } from '../src/waspPart.js';
import { Aggregation } from '../src/waspAggregation.js';
import { Rule } from '../src/waspRules.js';
import { generateRules } from '../src/utilities.js';
import { availableSets, colorMap } from './config.js';

let aggregation;
let waspVisualization;

const SELECTED_SET_NAME=  "Example Rules";

// Cache DOM elements
const aggregationSlider = document.getElementById('aggregationSlider');
const aggregationCounterDisplay = document.getElementById('aggregationCounter');

// THREE JS INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    let targetCount = aggregationSlider.value;
    aggregationCounterDisplay.innerHTML = targetCount;
    const containerId = '#threejs-container';
    waspVisualization = new waspVisualizer(containerId);

    
    const selectedSet = availableSets.find(set => set.Name === SELECTED_SET_NAME);
    if (!selectedSet) {
        throw new Error(`Set with name ${SELECTED_SET_NAME} not found`);
    }
    initializeWaspJs(selectedSet, targetCount);
});

async function initializeParts(set) {
    let parts = [];
    try {
        for (const fileName of set.partFiles) {
            const data = await readJsonData(set.Path, fileName);
            const newPart = Part.fromData(data);
            newPart.assignId(parts.length);
            newPart.geo.material.color.setHex(colorMap[parts.length % 10] || colorMap[0]);
            parts.push(newPart);
            console.log("Generating Part from file: ", fileName);
        }
    } catch (error) {
        console.error("Error initializing parts: ", error);
    }
    return parts;
}

async function initializeRules(set, parts) {
    let rules = [];
    try {
        if (set.ruleFile !== null) {
            console.log("Generating Rules from file: ", set.ruleFile);
            const data = await readJsonData(set.Path, set.ruleFile);
            rules = data.map(rule => new Rule().fromData(rule));
        } else {
            console.log("Generating Rules with Rule Generator");
            rules = generateRules(parts, true, false);
        }
    } catch (error) {
        console.error("Error initializing rules: ", error);
    }
    return rules;
}

async function initializeAggregation(parts, rules) {
    return new Aggregation("myNewAggregation", parts, rules);
}   

async function initializeWaspJs(set, count) {
    const parts = await initializeParts(set);
    const rules = await initializeRules(set, parts);
    aggregation = await initializeAggregation(parts, rules, count);
    aggregation.modifyParts(count, waspVisualization);
}

// ON AGGREGATION SLIDER CHANGE
aggregationSlider.addEventListener('input', event => {
    const newCount = parseInt(event.target.value, 10);
    aggregationCounterDisplay.innerHTML = newCount;
    aggregation.modifyParts(newCount, waspVisualization);
});

async function readJsonData(path, fileName) {
    try {
        const response = await fetch(`${path}${fileName}`);
        return await response.json();
    } catch (error) {
        console.error(`Error fetching JSON file ${fileName}: `, error);
        throw error;
    }
}