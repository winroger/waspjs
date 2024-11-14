// How to do that correctly?
export const availableSets = [
    { 
        Name: "Hexagon", 
        Path: "./examples/example_hexa/", 
        partFiles: ["HEXA.json"],
        ruleFile: null,
        aggregationFile: null,
    },
    { 
        Name: "Corner", 
        Path: "./examples/example_corner/", 
        partFiles: [""],
        ruleFile: null,
        aggregationFile: "aggregation.json",
    },
    { 
        Name: "Brio Rails Simple", 
        Path: "./examples/example_brio/", 
        partFiles: ["YSHAPE.json", "STICK.json", "CORNER2.json", "CORNER1.json", "BRIDGE.json"],
        ruleFile: null,
        aggregationFile: null,
    },
    { 
        Name: "Brio Rails Colliders", 
        Path: "./examples/example_brio_colliders/", 
        partFiles: ["YSHAPE.json", "STICK.json", "CORNER2.json", "CORNER1.json", "BRIDGE.json"],
        ruleFile: null,
        aggregationFile: null,
    },
    { 
        Name: "Brio Rails Colliders Chamfered", 
        Path: "./examples/example_brio_chamfer/", 
        partFiles: ["YSHAPE.json", "STICK.json", "CORNER2.json", "CORNER1.json", "BRIDGE.json"],
        ruleFile: null,
        aggregationFile: "aggregation.json",
    },
    { 
        Name: "Example Rules", 
        Path: "./examples/example_rules/", 
        partFiles: ["BOX.json", "HEXA.json", "TRI.json"],
        ruleFile: "rules.json",
        aggregationFile: null,
    },
];


export const colorMap = {
    "0": 0x5E5D57,  // Lime Green
    "1": 0xEFD1A5,  // Neon Pink
    "2": 0x5885E9,  // Neon Blue
    "3": 0xFF00FF,  // Neon Magenta
    "4": 0x00FF00,  // Neon Green
};