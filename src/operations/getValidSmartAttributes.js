/**
 * WaspJS — SmartAttribute validity operation.
 * GH-Wasp component counterpart: src/ghComp/Wasp_Get Valid Smart Attributes.py::main.
 * Uses the core's geometric query; Grasshopper UI and DataTree are omitted.
 */
import { SmartAttribute } from '../core/attributes.js';

/**
 * Return valid typed value groups per placed Part, in requested-name order.
 * The first SmartAttribute with a matching name wins, even if invalid; duplicate
 * requested names produce duplicate groups. Missing/invalid matches add no group.
 * 1 requires a geometrically free slot, -1 a blocked slot, 0 ignores the slot.
 * Stored attribute Connection.id refers to the free Part connection INDEX, as GH.
 * @param {import('../core/aggregation.js').Aggregation} aggregation
 * @param {string[]} ids Attribute names, not numeric connection IDs
 * @param {number} [tolerance=0.002] Strict surface-distance threshold in model units
 * @returns {import('../types/index.js').AttributeValueData[][][]} Independent typed JSON values
 * @throws {Error} Names, masks, geometry or tolerance are outside the supported contract
 */
export function getValidSmartAttributes(aggregation, ids, tolerance = 0.002) {
    if (!Array.isArray(ids) || ids.length === 0 || ids.some(id => typeof id !== 'string')) {
        throw new Error('Provide at least one SmartAttribute name');
    }
    if (!Number.isFinite(tolerance) || tolerance < 0) throw new Error('Invalid connection tolerance');
    return aggregation.aggregated_parts.map(part => {
        const free = aggregation.checkBlockedConnections(part, false, null, tolerance);
        const values = [];
        for (const id of ids) {
            const data = part.attributes.find(attribute => attribute?.class_type === 'SmartAttribute' && attribute.name === id);
            if (!data) continue;
            const attribute = SmartAttribute.fromData(data);
            if (attribute.conn_mask.every((mask, i) => mask === 0
                || free.includes(attribute.connections[i].id) === (mask === 1))) {
                values.push(globalThis.structuredClone(attribute.values));
            }
        }
        return values;
    });
}
