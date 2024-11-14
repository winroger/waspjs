// Stored for later use

async function initializeWaspJs(set, count) {
    // if there is an aggregation file, load it
    if (set.aggregationFile) {
        try {
            console.log("Loading aggregation from file: ", set.aggregationFile);
            const data = await readJsonData(set.Path, set.aggregationFile);
            aggregation = Aggregation.fromData(data);
            aggregation.modifyParts(count, waspVisualization);
        } catch (error) {
            console.error("Error loading aggregation: ", error);
        }
    } else {
        // else, initialize the parts and rules from the parts and rules files
        console.log("Initializing parts and rules from files: ", set.partFiles, set.ruleFile);
        const parts = await initializeParts(set);
        const rules = await initializeRules(set, parts);
        aggregation = new Aggregation("myNewAggregation", parts, rules)
        aggregation.modifyParts(count, waspVisualization);
    }
}

async function initializeParts(set) {
    let parts = [];
    try {
        for (const fileName of set.partFiles) {
            const data = await readJsonData(set.Path, fileName);
            const newPart = Part.fromData(data);
            newPart.assignId(parts.length);
            newPart.geo.material.color.setHex(colorMap[parts.length % 10] || colorMap[0]);
            parts.push(newPart);
            console.log("Loading Part from file: ", fileName);
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
            console.log("Loading Rules from file: ", set.ruleFile);
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