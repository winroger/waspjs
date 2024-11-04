// [main.js](http://_vscodecontentref_/#%7B%22uri%22%3A%7B%22%24mid%22%3A1%2C%22fsPath%22%3A%22%2FUsers%2Frogerwinkler%2FDocuments%2FGitHub%2Fwebwaspvisualizer%2Fmain.js%22%2C%22path%22%3A%22%2FUsers%2Frogerwinkler%2FDocuments%2FGitHub%2Fwebwaspvisualizer%2Fmain.js%22%2C%22scheme%22%3A%22file%22%7D%7D)
import { initThreeJsVisualization, addEntity, removeEntity } from './waspjs/waspVisualizer.js';
import { Part } from './waspjs/waspPart.js';
import { Aggregation } from './waspjs/waspAggregation.js';
import { Rule, generateRules } from './waspjs/waspRules.js';

let threeJsContext;
let scene;

let aggregation;
let aggregationCounter = 10;

let fixedAggregation = false;

// Cache DOM elements
const aggregationSlider = document.getElementById('aggregationSlider');
const aggregationCounterDisplay = document.getElementById('aggregationCounter');

// Define available sets
const availableSets = 
[
    { 
        Name: "Hexagon", 
        Path: "./examples/example_hexa/", 
        partFiles: ["HEXA.json"],
        ruleFile: null,
        aggregationFiles: []
    },
    { 
        Name: "Brio Rails Simple", 
        Path: "./examples/example_brio/", 
        partFiles: ["YSHAPE.json", "STICK.json", "CORNER2.json", "CORNER1.json", "BRIDGE.json"],
        ruleFile: null,
        aggregationFiles: []
    },
    { 
        Name: "Brio Rails Colliders", 
        Path: "./examples/example_brio_colliders/", 
        partFiles: ["YSHAPE.json", "STICK.json", "CORNER2.json", "CORNER1.json", "BRIDGE.json"],
        ruleFile: null,
        aggregationFiles: []
    },
    { 
        Name: "Example Rules", 
        Path: "./examples/example_rules/", 
        partFiles: ["BOX.json", "HEXA.json", "TRI.json"],
        ruleFile: "rules.json",
        aggregationFiles: []
    },
];

// Define a color map for parts
const colorMap = {
    "0": 0xD9FF00,  // Lime Green
    "1": 0xC4E666,  // Soft Lime
    "2": 0xAFCC99,  // Muted Greenish Gray
    "3": 0x718500,  // Light Pinkish
    "4": 0xFFFFFF,   // Light Gray
};


// THREE JS INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    const containerId = '#threejs-container';
    threeJsContext = initThreeJsVisualization(containerId); 
    scene = threeJsContext.scene;
    scene.userData = { camera: threeJsContext.camera, controls: threeJsContext.controls };
    updateAggregationCounter(aggregationCounter);
    const selectedSetName=  "Example Rules";
    const selectedSet = availableSets.find(set => set.Name === selectedSetName);
    if (!selectedSet) {
        throw new Error(`Set with name ${selectedSetName} not found`);
    }
    initializeSet(selectedSet);
});


async function initializeSet(set) {
    let parts = [];
    let rules = [];
    try {
        // initialize Parts
        for (const fileName of set.partFiles) {
            const response = await fetch(`${set.Path}${fileName}`);
            const data = await response.json();
            const newPart = Part.fromData(data);
            newPart.assignId(parts.length);
            newPart.geo.material.color.setHex(colorMap[parts.length % 10] || colorMap[0]);
            parts.push(newPart);
        }
        // initialize Rules
        if (set.rules) {
            console.log("Generating Rules from file: ", set.rules);
            const response = await fetch(`${set.Path}${set.rules}`);
            const data = await response.json();
            rules = data.map(rule => new Rule().fromData(rule));
        } else {
            console.log("Generating Rules from file: ", set.ruleFile);
            rules = generateRules(parts, true, false);
        }
    } catch (error) {
        console.error("Error fetching file: ", error);
    }

    aggregation = new Aggregation("myNewAggregation", parts, rules);
    triggerAggregation(aggregation, aggregationCounter);
}

// initialize the aggregation with the current preset count
function triggerAggregation(aggregation, targetCount) {

    if (fixedAggregation) {
        aggregation.aggregate_rnd(50);
    }
    else {
        aggregation.aggregate_rnd_ctrl(targetCount)
    }
    for (let i = 0; i < targetCount; i++) {
        addEntity(scene, aggregation.getParts()[i]);
    }
    updateAggregationCounter(targetCount);
}

// ON AGGREGATION SLIDER CHANGE
aggregationSlider.addEventListener('input', event => {
    const newCount = parseInt(event.target.value, 10);
    updateAggregationCounter(newCount);
    modifyParts(scene, newCount);
});

// Modify the current aggregation based on the new count
function modifyParts(scene, newCount) {
    let isCount = aggregation.getParts().length;
    const difference = newCount - isCount;

    if (difference > 0) {
        for (let i = 0; i < difference; i++) {
            let added = aggregation.addPartToAggregation();
            if (!added) {
                return;
            }
            const newPart = aggregation.getParts()[aggregation.getParts().length - 1];
            addEntity(scene, newPart);
            isCount = aggregation.getParts().length;
        }
    } else if (difference < 0) {
        for (let i = difference; i < 0; i++) {
            let partToRemove = aggregation.getParts()[isCount - 1];
            removeEntity(scene, partToRemove);
            aggregation.removePartFromAggregation(aggregation.getParts().length - 1);
            isCount = aggregation.getParts().length;

        }
    }
    isCount = aggregation.getParts().length;
}

export function updateAggregationCounter(count) {
    aggregationCounter = count;
    aggregationCounterDisplay.innerHTML = count;
}