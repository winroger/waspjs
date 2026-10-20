/**
 * WaspJS — reconstruct compact aggregation data with external base parts.
 * GH-Wasp component counterpart: src/ghComp/Wasp_Load Aggregation from File.py::main.
 * File access and Grasshopper UI are supplied by the caller. No DisCo support.
 */
import { Aggregation } from '../core/aggregation.js';
import { AdvancedPart } from '../core/part.js';
import { transformFromData } from '../core/utilities.js';

/**
 * Rebuild the compact Save/Load format, retaining IDs without renumbering.
 * GH-Wasp difference: recover unique parent/child connection IDs from frames,
 * allowing validated graph reconstruction and subsequent JS placement.
 * Compact data has no rules, RNG cursor or graph; pass rules separately.
 * @param {import('../types/index.js').AggregationFileData} data
 * @param {import('../core/part.js').Part[]} baseParts
 * @param {import('../core/rule.js').Rule[]} rules
 * @param {number|null} [seed=null]
 * @param {number} [tolerance=0.002] Model units, for matching connection origins.
 * @returns {Aggregation}
 */
export function loadAggregation(data, baseParts, rules, seed = null, tolerance = 0.002) {
    if (!data.parts || !Array.isArray(baseParts) || !Array.isArray(rules)) {
        throw new Error('Compact load requires data, base parts and rules');
    }
    if (!Number.isFinite(tolerance) || tolerance <= 0) throw new Error('Invalid compact load tolerance');
    const byName = new Map(baseParts.map(part => [part.name, part]));
    const idOf = value => typeof value === 'string' && /^[+-]?\d+$/.test(value) ? Number(value) : value;
    // GH compact loading sorts numeric IDs. String IDs are a JS-only extension.
    const entries = Object.entries(data.parts).sort(([a], [b]) => {
        const first = idOf(a), second = idOf(b);
        if (typeof first === 'number' && typeof second === 'number') return first - second;
        if (typeof first === 'number') return -1;
        if (typeof second === 'number') return 1;
        return a.localeCompare(b);
    });
    const parts = entries.map(([id, raw]) => {
        const base = byName.get(raw.name);
        if (!base) throw new Error(`Missing base part for ${raw.name}`);
        if (base instanceof AdvancedPart) throw new Error('AdvancedPart compact loading is not implemented; use full/light core data');
        if (raw.is_constrained) throw new Error('Constrained compact parts are not implemented');
        const transform = transformFromData(raw.transform);
        // Compatibility limitation: reflected/scaled compact reconstruction is
        // outside the measured rigid-frame contract; do not guess its normals.
        const e = transform.elements;
        const cols = [[e[0], e[1], e[2]], [e[4], e[5], e[6]], [e[8], e[9], e[10]]];
        if (!e.every(Number.isFinite) || Math.abs(transform.determinant() - 1) > 1e-5
            || cols.some(c => Math.abs(c.reduce((sum, x) => sum + x * x, 0) - 1) > 1e-5)
            || [e[3], e[7], e[11], e[15] - 1].some(v => Math.abs(v) > 1e-5)) {
            throw new Error('Compact load currently supports rigid positive transforms only');
        }
        const part = base.transform(transform);
        part.id = idOf(id);
        part.parent = idOf(raw.parent ?? null);
        part.children = (raw.children ?? []).map(idOf);
        if (!Array.isArray(raw.active_connections)) throw new Error('Missing compact active_connections');
        part.active_connections = [...raw.active_connections];
        return part;
    });
    const byId = new Map(parts.map(part => [String(part.id), part]));
    if (byId.size !== parts.length) throw new Error('Duplicate compact part IDs');
    for (const part of parts) {
        if (part.parent === null) continue;
        const parent = byId.get(String(part.parent));
        if (!parent) throw new Error(`Missing parent for ${part.id}`);
        const matches = [];
        for (const [i, target] of parent.connections.entries()) {
            for (const [j, source] of part.connections.entries()) {
                if (target.pln.origin.distanceTo(source.flip_pln.origin) < tolerance
                    && target.pln.xaxis.distanceTo(source.flip_pln.xaxis) < 1e-5
                    && target.pln.yaxis.distanceTo(source.flip_pln.yaxis) < 1e-5) matches.push([i, j]);
            }
        }
        if (matches.length !== 1) throw new Error(`Compact connection for ${part.id} is missing or ambiguous`);
        [part.conn_on_parent, part.conn_to_parent] = matches[0];
    }
    const definition = new Aggregation(data.aggregation_name, baseParts, rules, seed).toData();
    definition.aggregated_parts = Object.fromEntries(parts.map(part => [part.id, part.toData()]));
    definition.aggregated_parts_sequence = parts.map(part => part.id);
    return Aggregation.fromData(definition);
}
