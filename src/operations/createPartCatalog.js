/**
 * WaspJS — PartCatalog creation operation.
 * GH-Wasp component counterpart: src/ghComp/Wasp_Parts Catalog.py::main.
 * Broadcast a single amount and apply component defaults without Grasshopper UI.
 */
import { PartCatalog } from '../core/part.js';

/**
 * @param {import('../core/part.js').Part[]} parts
 * @param {number[]} amounts One for all types, or one per Part
 * @param {boolean|null} [limited=false] Component default differs from core class
 * @param {boolean|null} [adaptive=false]
 * @returns {PartCatalog}
 */
export function createPartCatalog(parts, amounts, limited = false, adaptive = false) {
    if (!Array.isArray(parts) || parts.length === 0 || !Array.isArray(amounts) || amounts.length === 0) {
        throw new Error('Provide Parts and amounts for the catalog');
    }
    const counts = amounts.length === 1 ? parts.map(() => amounts[0]) : amounts;
    return new PartCatalog(parts.map(part => part.name), counts, limited ?? false, adaptive ?? false);
}
