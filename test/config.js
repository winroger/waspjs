// How to do that correctly?
export const availableSets = [
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
        Name: "Brio Rails Colliders Chamfered", 
        Path: "./examples/example_brio_chamfer/", 
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


export const colorMap = {
    "0": 0xD9FF00,  // Lime Green
    "1": 0xFF007F,  // Neon Pink
    "2": 0x00FFFF,  // Neon Blue
    "3": 0xFF00FF,  // Neon Magenta
    "4": 0x00FF00,  // Neon Green
};