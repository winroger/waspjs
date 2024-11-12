import { initThreeJsVisualization, addEntity, removeEntity } from '../src/waspVisualizer.js';
import { Part } from '../src/waspPart.js';
import { Aggregation } from '../src/waspAggregation.js';
import { Rule } from '../src/waspRules.js';
import { generateRules } from '../src/utilities.js';

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
        Path: "../examples/example_hexa/", 
        partFiles: ["HEXA.json"],
        ruleFile: null,
        aggregationFiles: []
    },
    { 
        Name: "Brio Rails Simple", 
        Path: "../public/examples/example_brio/", 
        partFiles: ["YSHAPE.json", "STICK.json", "CORNER2.json", "CORNER1.json", "BRIDGE.json"],
        ruleFile: null,
        aggregationFiles: []
    },
    { 
        Name: "Brio Rails Colliders", 
        Path: "../public/examples/example_brio_colliders/", 
        partFiles: ["YSHAPE.json", "STICK.json", "CORNER2.json", "CORNER1.json", "BRIDGE.json"],
        ruleFile: null,
        aggregationFiles: []
    },
    { 
        Name: "Brio Rails Colliders Chamfered", 
        Path: "../public/examples/example_brio_chamfer/", 
        partFiles: ["YSHAPE.json", "STICK.json", "CORNER2.json", "CORNER1.json", "BRIDGE.json"],
        ruleFile: null,
        aggregationFiles: []
    },
    { 
        Name: "Example Rules", 
        Path: "../public/examples/example_rules/", 
        partFiles: ["BOX.json", "HEXA.json", "TRI.json"],
        ruleFile: "rules.json",
        aggregationFiles: []
    },
];

const colorMap = {
    "0": 0xD9FF00,  // Lime Green
    "1": 0xFF007F,  // Neon Pink
    "2": 0x00FFFF,  // Neon Blue
    "3": 0xFF00FF,  // Neon Magenta
    "4": 0x00FF00,  // Neon Green
};

/*
const colorMap = {
    "0": 0xDBBC91,  // Lime Green
};
*/

// THREE JS INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    const containerId = '#threejs-container';
    threeJsContext = initThreeJsVisualization(containerId); 
    scene = threeJsContext.scene;
    scene.userData = { camera: threeJsContext.camera, controls: threeJsContext.controls };
    updateAggregationCounter(aggregationCounter);
    const selectedSetName=  "Hexagon";
    const selectedSet = availableSets.find(set => set.Name === selectedSetName);
    if (!selectedSet) {
        throw new Error(`Set with name ${selectedSetName} not found`);
    }
    initializeSet(selectedSet);
});

// Call the test function to add the cube
//addTestCube();


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
            console.log("Generating Part from file: ", fileName);
        }
        // initialize Rules
        if (set.ruleFile !== null) {
            console.log("Generating Rules from file: ", set.ruleFile);
            const response = await fetch(`${set.Path}${set.ruleFile}`);
            const data = await response.json();
            rules = data.map(rule => new Rule().fromData(rule));
        } else {
            console.log("Generating Rules with Rule Generator");
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