// [main.js](http://_vscodecontentref_/#%7B%22uri%22%3A%7B%22%24mid%22%3A1%2C%22fsPath%22%3A%22%2FUsers%2Frogerwinkler%2FDocuments%2FGitHub%2Fwebwaspvisualizer%2Fmain.js%22%2C%22path%22%3A%22%2FUsers%2Frogerwinkler%2FDocuments%2FGitHub%2Fwebwaspvisualizer%2Fmain.js%22%2C%22scheme%22%3A%22file%22%7D%7D)
import { initThreeJsVisualization, addEntity, removeEntity } from './waspjs/waspVisualizer.js';
import { Part } from './waspjs/waspPart.js';
import { Aggregation } from './waspjs/waspAggregation.js';
import { Rule, generateRules } from './waspjs/waspRules.js';
import { readJSONFiles } from './waspjs/utilities.js';
import * as THREE from 'three';



let threeJsContext;
let newParts = [];
let rules = [];
let aggregation = null;
let aggregatedParts = [];
const partNameMap = {};
let aggregationCounter = 1;
let activeParts;

let fixedAggregation = false;

// Define a color map for parts

const colorMap = {
    "0": 0xFF5733,  // Vibrant Orange
    "1": 0x33FF57,  // Lime Green
    "2": 0x3357FF,  // Bright Blue
    "3": 0xFF33A1,  // Hot Pink
    "4": 0x33FFF1,  // Aqua Mint
    "5": 0xF1FF33,  // Neon Yellow
    "6": 0xFF5733,  // Deep Coral
    "7": 0x5733FF,  // Electric Purple
    "8": 0x33FFA8,  // Mint Green
    "9": 0xFF33D1   // Magenta
};


// Cache DOM elements
const partFileInput = document.getElementById('partFile');
const ruleFileInput = document.getElementById('ruleFile');
const triggerAggregationButton = document.getElementById('triggerAggregation');
const aggregationFileInput = document.getElementById('aggregationFile');

const aggregationSlider = document.getElementById('aggregationSlider');
const aggregationCounterDisplay = document.getElementById('aggregationCounter');

const statusValue = document.getElementById('statusValue');

const dropdown = document.getElementById('partFileSelect');

const sets = 
[
    { 
        name: "Hexagon", 
        baseurl: "./assets/example_hexa/", 
        fileNames: ["HEXA.json"] 
    },
    { 
        name: "Brio Rails", 
        baseurl: "./assets/example_brio/", 
        fileNames: ["YSHAPE.json", "STICK.json", "CORNER2.json", "CORNER1.json", "BRIDGE.json"] 
    },
];

function populateDropdown() {

    sets.forEach(set => {
        const option = document.createElement('option');
        option.value = set.name;
        option.textContent = set.name;
        dropdown.appendChild(option);
    });
}

populateDropdown();

dropdown.addEventListener('change', async event => {
    const setName = event.target.value;
    const selectedSet = sets.find(set => set.name === setName);
    try {
        for (const fileName of selectedSet.fileNames) {
            const response = await fetch(`${selectedSet.baseurl}${fileName}`);
            const data = await response.json();
            const newPart = Part.fromData(data);
            newPart.assignId(newParts.length);
            newPart.geo.material.color.setHex(colorMap[newParts.length % 10] || colorMap[0]);
            newParts.push(newPart);
            partNameMap[newPart.name] = newPart;
        }
        rules = generateRules(newParts);
        console.log("newParts: ", newParts);
    } catch (error) {
        console.error("Error fetching file: ", error);
    }
    triggerAggregation();
});



// THREE JS INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    const containerId = '#threejs-container';
    threeJsContext = initThreeJsVisualization(containerId); 
    //threeJsContext.scene.background = new THREE.Color(0x06402B); // Set to black, change to any color you prefer
    threeJsContext.scene.userData = { camera: threeJsContext.camera, controls: threeJsContext.controls };
    updateAggregationCounter(aggregationCounter);
});

/*// ON PART FILE UPLOAD
partFileInput.addEventListener('change', async event => {
    const partFiles = event.target.files;
    try {
        const partData = await readJSONFiles(partFiles);
        partData.forEach((data, index) => {
            const newPart = Part.fromData(data);
            newPart.assignId(index);
            newPart.geo.material.color.setHex(colorMap[index % 10]);
            newParts.push(newPart);
            partNameMap[newPart.name] = newPart;
            //addEntity(threeJsContext.scene, newPart, true);
        });
        rules = generateRules(newParts);
        console.log("newParts: ", newParts);
    } catch (error) {
        console.error("Error reading files: ", error);
    }
});

// ON RULE FILE UPLOAD
ruleFileInput.addEventListener('change', async event => {
    const rulesFile = event.target.files;
    try {
        rules = await readJSONFiles(rulesFile);
        rules = rules[0].map(rule => new Rule().fromData(rule));
        console.log("rules: ", rules);
    } catch (error) {
        console.error("Error reading files: ", error);
    }
    triggerAggregation()
});

*/
// ON AGGREGATION TRIGGER
/*triggerAggregationButton.addEventListener('click', () => {*/
function triggerAggregation() {
    aggregation = new Aggregation("myNewAggregation", newParts, rules);
    if (fixedAggregation) {
        console.log("Triggered fixed aggregation");
        aggregation.aggregate_rnd(50);
    }
    else {
        console.log("Triggered controlled aggregation");
        aggregation.aggregate_rnd_ctrl(aggregationCounter)
    }
    aggregatedParts = aggregation.getParts();
    for (let i = 0; i < aggregationCounter; i++) {
        addEntity(threeJsContext.scene, aggregatedParts[i], false);
    }
    updateAggregationCounter(aggregationCounter);
    activeParts = aggregationCounter;
    //statusValue.innerHTML = aggregatedParts.length;
}
/*});*/

// ON AGGREGATION SLIDER INPUT
aggregationSlider.addEventListener('input', event => {
    const newCount = parseInt(event.target.value, 10);
    updateAggregationCounter(newCount);
    const scene = threeJsContext.scene;
    if (!aggregation) {
        console.warn("Aggregation not yet triggered");
        return;
    } else {
        aggregatedParts = aggregation.getParts();
    }
    modifyParts(scene, newCount);
});

function modifyParts(scene, newCount) {
    console.log("current aggregation parts: ", aggregation.getParts())
    let isCount = aggregation.getParts().length;
    const difference = newCount - isCount;

    if (difference > 0) {
        for (let i = 0; i < difference; i++) {
            //console.log("difference before add: ", difference);
            let added = aggregation.addPartToAggregation();
            if (!added) {
                //console.error("Failed to add part to aggregation");
                return;
            }
            const newPart = aggregation.getParts()[aggregation.getParts().length - 1];
            //console.log("newPart: ", newPart);
            addEntity(scene, newPart, false);
            isCount = aggregation.getParts().length;
        }
    } else if (difference < 0) {
        for (let i = difference; i < 0; i++) {
            //console.log("difference before remove: ", difference);
            let partToRemove = aggregatedParts[isCount - 1];
            removeEntity(scene, partToRemove);
            aggregation.removePartFromAggregation(aggregation.getParts().length - 1);
            isCount = aggregation.getParts().length;
            //console.log("New number of parts: ", aggregation.getParts().length)

        }
    }

    isCount = aggregation.getParts().length;
    //console.log("isCount", isCount);
    //console.log("newCount", newCount); 
}

// ON AGGREGATION FILE UPLOAD
/*
aggregationFileInput.addEventListener('change', async event => {
    const aggregationFiles = event.target.files;
    try {
        const aggregationData = await readJSONFiles(aggregationFiles);
        aggregationData.forEach(data => {
            Object.keys(data.parts).forEach(partKey => {
                const part = data.parts[partKey];
                const transData = transformFromData(part.transform);
                const correspondingPart = partNameMap[part.name];
                if (correspondingPart) {
                    const newPart = correspondingPart.copy();
                    newPart.transGeoOnly(transData);
                    aggregatedParts.push(newPart);
                } else {
                    console.warn(`Part with name ${part.name} not found in newParts`);
                }
            });
        });
    } catch (error) {
        console.error("Error reading aggregationFile: ", error);
    }
    visualizeParts(threeJsContext.scene, aggregatedParts, false);
});

*/

export function updateAggregationCounter(count) {
    aggregationCounter = count;
    aggregationCounterDisplay.innerHTML = count;
}