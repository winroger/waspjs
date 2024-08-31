let threeJsContext;
let partData = [];
let newParts = [];
let aggreatedParts = [];
let partNameMap = {};


document.addEventListener('DOMContentLoaded', () => {
    const containerId = '#threejs-container';
    threeJsContext = initThreeJsVisualization(containerId);
    threeJsContext.scene.userData = { camera: threeJsContext.camera, controls: threeJsContext.controls };
});

document.getElementById('partFile').addEventListener('change', async event => {
    const partFiles = event.target.files;
    try {
        partData = await readJSONFiles(partFiles);
        let count = 0;
        for (const data of partData) {
            const newPart = Part.fromData(data);
            newPart.assignId(count);
            count++;
            newParts.push(newPart);
            partNameMap[newPart.name] = newPart; // Map part by name
        }
        const rules = generateRules(newParts);
        visualizeParts(threeJsContext.scene, newParts, true);
        console.log("newParts: ", newParts);

    } catch (error) {
        console.error("Error reading files: ", error);
    }
});

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