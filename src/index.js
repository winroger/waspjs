/**
 * WaspJS — public package exports. Internal host adapters remain private.
 */
// UTILITIES
export {
    checkMeshesIntersection, meshToData, meshFromData,
    transformToData, transformFromData, PlaneToPlane,
} from './core/utilities.js';

// CORE CLASSES
export { Aggregation } from './core/aggregation.js';
export { Attribute, SmartAttribute } from './core/attributes.js';
export { Graph } from './core/graph.js';
export { Collider } from './core/collider.js';
export { Connection } from './core/connection.js';
export { Part, AdvancedPart, PartCatalog } from './core/part.js';
export { Plane } from './core/plane.js';
export { Rule } from './core/rule.js';
export { Visualizer } from './core/visualizer.js';
export * from './types/index.js';

// OPERATIONS
export { generateRules } from './operations/generateRules.js';
export { loadAggregation } from './operations/loadAggregation.js';
export { getValidSmartAttributes } from './operations/getValidSmartAttributes.js';
export { createPartCatalog } from './operations/createPartCatalog.js';
