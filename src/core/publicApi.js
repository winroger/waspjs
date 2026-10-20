/**
 * WaspJS — compatibility exports for previous direct source imports.
 * Implementations live in operations/aggregation.js; use the package root in apps.
 */
export {
    createAggregationFromData,
    getAggregationCatalogParts,
    getValidPlacementsAtParent,
    getValidPlacementsAtConnection,
    getOpenConnectionsForPart,
    setActivePartTypes,
} from '../operations/aggregation.js';
