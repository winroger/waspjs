/**
 * WaspJS — directed aggregation graph.
 * Upstream module: src/wasp/core/graph.py. DisCo is outside the port scope.
 */

// ==================== Graph ====================

/** Stores part IDs and directed edges with their two connection IDs. */
export class Graph {
    /**
     * Create an empty adjacency dictionary; graph-attribute support remains reserved.
     */
    constructor() {
        this.graph_dict = {};
        // Reserved in GH; attribute-driven graph operations are not implemented.
        this.nodes_attributes = {};
        this.edges_attributes = {};
    }

    /**
     * Read a GH adjacency dictionary without sharing its JSON objects.
     * @param {Record<string, Record<string, import('../types/index.js').GraphEdgeData>>} data
     * @returns {Graph}
     */
    static fromData(data) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('Graph must be an adjacency dictionary');
        }
        const graph = new Graph();
        for (const [node, neighbours] of Object.entries(data)) {
            if (!neighbours || typeof neighbours !== 'object' || Array.isArray(neighbours)) {
                throw new Error(`Invalid graph neighbours for ${node}`);
            }
            graph.addNode(node);
            for (const [end, edge] of Object.entries(neighbours)) {
                if (!edge || String(edge.start) !== node || String(edge.end) !== end
                    || !Number.isInteger(edge.conn_start) || !Number.isInteger(edge.conn_end)) {
                    throw new Error(`Invalid graph edge ${node} -> ${end}`);
                }
                Object.defineProperty(graph.graph_dict[node], end, {
                    value: globalThis.structuredClone(edge), enumerable: true, writable: true, configurable: true,
                });
            }
        }
        return graph;
    }

    /** @param {boolean} [useAttributes=false] Reserved GH feature. @returns {Object} */
    toData(useAttributes = false) {
        if (useAttributes) throw new Error('Graph attribute export is not implemented');
        // GH-Wasp difference: export a snapshot rather than its live dictionary.
        return globalThis.structuredClone(this.graph_dict);
    }

    /**
     * Match GH Graph.from_aggregation: full mode compares connection origins,
     * not plane normals; sequence mode returns the aggregation's live graph.
     * @param {import('./aggregation.js').Aggregation} aggregation
     * @param {boolean} [fullGraph=true]
     * @param {number} [tolerance=0.002] In model units; pinned GH global default.
     * @param {boolean} [filterByRules=false]
     * @param {import('./rule.js').Rule[]} [customRules=[]]
     * @returns {Graph}
     */
    static fromAggregation(aggregation, fullGraph = true, tolerance = 0.002, filterByRules = false, customRules = []) {
        if (!fullGraph) return aggregation.graph;
        if (!Number.isFinite(tolerance) || tolerance < 0) throw new Error('Invalid graph tolerance');
        const graph = new Graph();
        const rules = customRules.length ? customRules : aggregation.rules;
        for (const part of aggregation.aggregated_parts) {
            graph.addNode(part.id);
            const neighbours = aggregation.aggregated_parts.filter(other => other.id !== part.id
                && part.center.distanceTo(other.center) < part.dim + other.dim + tolerance);
            for (const [i, connection] of part.connections.entries()) {
                for (const other of neighbours) {
                    for (const [j, otherConnection] of other.connections.entries()) {
                        if (connection.pln.origin.distanceTo(otherConnection.pln.origin) >= tolerance) continue;
                        if (filterByRules && !rules.some(rule => rule.partA === part.name
                            && rule.connectionA === i && rule.partB === other.name && rule.connectionB === j)) continue;
                        graph.addEdge(part.id, other.id, i, j);
                    }
                }
            }
        }
        return graph;
    }

    /** @param {number|string} id @returns {void} */
    addNode(id) {
        if (!Object.hasOwn(this.graph_dict, id)) {
            Object.defineProperty(this.graph_dict, id, {
                value: {}, enumerable: true, writable: true, configurable: true,
            });
        }
    }

    /**
     * Add a directed edge; an existing pair retains its original attributes.
     * @param {number|string} startId
     * @param {number|string} endId
     * @param {number} startConnection
     * @param {number} endConnection
     * @returns {void}
     */
    addEdge(startId, endId, startConnection, endConnection) {
        this.addNode(startId);
        if (!Object.hasOwn(this.graph_dict[startId], endId)) {
            Object.defineProperty(this.graph_dict[startId], endId, {
                value: { start: startId, end: endId, conn_start: startConnection, conn_end: endConnection },
                enumerable: true, writable: true, configurable: true,
            });
        }
    }

    /** @param {number|string} id @returns {void} */
    removeNode(id) {
        delete this.graph_dict[id];
        for (const neighbours of Object.values(this.graph_dict)) delete neighbours[id];
    }

    /** @returns {number} Directed edge count, as in GH. */
    countEdges() {
        return Object.values(this.graph_dict).reduce((count, neighbours) => count + Object.keys(neighbours).length, 0);
    }

    /** @returns {Array<number|string>} Numeric JSON keys are restored to integer IDs. */
    getNodes() {
        return Object.keys(this.graph_dict).map(key => /^[+-]?\d+$/.test(key) ? Number(key) : key);
    }

    /** @param {boolean} [flatten=true] @returns {Array} Directed pairs, optionally grouped per node. */
    getEdges(flatten = true) {
        const groups = Object.values(this.graph_dict).map(neighbours => Object.values(neighbours)
            .map(edge => [edge.start, edge.end]));
        return flatten ? groups.flat() : groups;
    }

    /** @param {boolean} [flatten=true] @returns {Array} Edge snapshots, optionally grouped per node. */
    getEdgesAttributes(flatten = true) {
        const groups = Object.values(this.graph_dict).map(neighbours => globalThis.structuredClone(Object.values(neighbours)));
        return flatten ? groups.flat() : groups;
    }
}
