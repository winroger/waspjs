let threeJsContext;
let partData = [];
let newParts = [];
let aggreatedParts = [];
let partNameMap = {};
let aggregationCounter = 3;


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
  }

const examplePartFile = 'https://github.com/winroger/webwaspvisualizer/blob/main/assets/example01/HEXA.json';

async function loadPartFileFromAssets() {
    try {
        const response = await fetch(examplePartFile);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const partData = await response.json();
        let count = 0;
        for (const data of partData) {
            const newPart = Part.fromData(data);
            newPart.assignId(count);
            console.log("count: ", count);
            newPart.geo.material.color.setHex(colorMap[count]);
            count++;
            newParts.push(newPart);
            partNameMap[newPart.name] = newPart;
            for (const conn of newPart.connections) {
                console.log(count);
            }
        }
        const rules = generateRules(newParts);
        visualizeParts(threeJsContext.scene, newParts, true);
        console.log("newParts: ", newParts);
    } catch (error) {
        console.error("Error loading part file from assets: ", error);
    }
}


// THREE INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    const containerId = '#threejs-container';
    threeJsContext = initThreeJsVisualization(containerId);
    threeJsContext.scene.userData = { camera: threeJsContext.camera, controls: threeJsContext.controls };
    updateAggregationCounter(aggregationCounter);
});


// ON PART FILE UPLOAD
document.getElementById('partFile').addEventListener('change', async event => {
    const partFiles = event.target.files;
    try {
        partData = await readJSONFiles(partFiles);
        let count = 0;
        for (const data of partData) {
            const newPart = Part.fromData(data);
            newPart.assignId(count);
            console.log("count: ", count);
            newPart.geo.material.color.setHex(colorMap[count]);
            count++;
            newParts.push(newPart);
            partNameMap[newPart.name] = newPart; // Map part by name
            for (conn of newPart.connections) {
                console.log(count);
                //addConnectionArrowsToScene(conn);
            }
        }
        const rules = generateRules(newParts);
        //visualizeParts(threeJsContext.scene, newParts, true);
        console.log("newParts: ", newParts);

    } catch (error) {
        console.error("Error reading files: ", error);
    }
});


// ON AGGREGATION TRIGGER
document.getElementById('triggerAggregation').addEventListener('click', async () => {


    //console.log("Init Aggregation");
    const aggregationName = "myNewAggregation"
    const rules = generateRules(newParts);
    const aggreation = new Aggregation(aggregationName, newParts, rules);
    console.log("Aggregation: ", aggreation);
    aggreation.aggregate_rnd(aggregationCounter);
    aggreatedParts = aggreation.getParts();
    visualizeParts(threeJsContext.scene, aggreatedParts, false);
    updateAggregationCounter(aggreatedParts.length);
});

// ON AGGREGATION FILE UPLOAD
document.getElementById('aggregationFile').addEventListener('change', async event => {
    const aggreationFile = event.target.files;
    try {
        let aggreationData = await readJSONFiles(aggreationFile);
        for (const data of aggreationData) {
            Object.keys(data.parts).forEach(partKey => {
                const part = data.parts[partKey];
                const transData = transformFromData(part.transform);

                const correspondingPart = partNameMap[part.name]; // Get the correct part by name
                if (correspondingPart) {
                    const newPart = correspondingPart.copy();
                    newPart.transGeoOnly(transData);
                    aggreatedParts.push(newPart);
                } else {
                    console.warn(`Part with name ${part.name} not found in newParts`);
                }
            });
        }
    } catch (error) {
        console.error("Error reading aggreationFile: ", error);
    }

    console.log("Aggreated Parts: ", aggreatedParts);
    visualizeParts(threeJsContext.scene, aggreatedParts, false)
});


function updateAggregationCounter(count) {
    aggregationCounter = count;
    console.log("Count: ", count);
    aggregationCounterDisplay = document.getElementById('aggregationCounter');
    aggregationCounterDisplay.innerHTML = count;
}


// change the inp


/*
document.getElementById('fileInput').addEventListener('change', async event => {
    let datasets = [];
    let newParts = [];
    const files = event.target.files;
    try {
        datasets = await readJSONFiles(files);
        let count = 0
        for (const data of datasets) {
            const newPart = Part.fromData(data);
            newPart.assignId(count)
            count++
            newParts.push(newPart)
            //console.log("PART ADDED: ", newPart)
        }
        //visualizeParts(threeJsContext.scene, newParts)
        const rules = generateRules(newParts)
        const aggregationName = "My New Aggregation"
        //console.log("newParts: ", newParts)
        const aggreation = new Aggregation(aggregationName, newParts, rules)
        aggreation.aggregate_rnd(2)
        console.log("aggreation: ", aggreation)
        visualizeParts(threeJsContext.scene, aggreation.getParts())
    } catch (error) {
        console.error("Error reading files: ", error);
    }
});
*/

/*
function addConnectionArrowsToScene(connection) {
    const origin = connection.pln.origin;
    const xDir = connection.pln.xaxis.normalize();
    const yDir = connection.pln.yaxis.normalize();
    const zDir = connection.pln.zaxis.normalize();

    const xArrow = new THREE.ArrowHelper(xDir, origin, 2, 0xff0000); // Red for X-axis
    const yArrow = new THREE.ArrowHelper(yDir, origin, 2, 0x0000ff); // Green for Y-axis
    const zArrow = new THREE.ArrowHelper(zDir, origin, 2, 0x00ff00); // Blue for Z-axis

    threeJsContext.scene.add(xArrow);
    threeJsContext.scene.add(yArrow);
    threeJsContext.scene.add(zArrow);
}
*/