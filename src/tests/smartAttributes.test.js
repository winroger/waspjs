/** WaspJS — actual GH SmartAttribute and surface-query comparisons. */
import { describe, expect, it } from 'vitest';
import { Matrix4, BufferGeometry, Float32BufferAttribute, Mesh, Group } from 'three';
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import * as api from '../index.js';
import { Attribute, SmartAttribute, Part, Aggregation, Collider, Connection,
    meshFromData, getValidSmartAttributes } from '../index.js';
import corpus from './fixtures/gh-smart-attribute-cases.json';
import reference from './fixtures/gh-smart-attribute-reference.json';
import dockingCorpus from './fixtures/gh-rules-cases.json';

const clone = value => globalThis.structuredClone(value);
const transforms = corpus.transforms.map(rows => new Matrix4().set(...rows.flat()));
const base = () => Part.fromData(clone(reference.base));
// GH omits redundant Z in planes. This comparison does not hide other fields.
function normalized(value) {
    if (Array.isArray(value)) return value.map(normalized);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'zaxis'
        || !('origin' in value && 'xaxis' in value && 'yaxis' in value))
        .map(([key, item]) => [key, normalized(item)]));
}
function numeric(actual, expected) {
    if (typeof expected === 'number') expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1e-5);
    else if (Array.isArray(expected)) {
        expect(actual).toHaveLength(expected.length);
        expected.forEach((value, i) => numeric(actual[i], value));
    } else if (expected && typeof expected === 'object') {
        expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
        Object.keys(expected).forEach(key => numeric(actual[key], expected[key]));
    } else expect(actual).toEqual(expected);
}
function compare(actual, expected) { numeric(normalized(actual), normalized(expected)); }
function make(spec) {
    const part = base();
    if ('connection0_z' in spec) part.connections[0].pln.origin.z = spec.connection0_z;
    let parts = [part, ...spec.blockers.map((blocker, i) => {
        const mesh = meshFromData(corpus.meshes[blocker.mesh]);
        mesh.position.fromArray(blocker.offset);
        return new Part('obstacle' + i, mesh, [], new Collider([]), [], 100, blocker.same_id ? 0 : i + 1);
    })];
    if ('pose' in spec) parts = parts.map(p => p.transform(transforms[spec.pose]));
    const aggregation = new Aggregation('smart', [base()], [], 42);
    aggregation.coll_check = false;
    aggregation.aggregated_parts = parts;
    return aggregation;
}

describe('SmartAttribute model measured in GH', () => {
    it('identifies native source/runtime and the component-only capture adapter', () => {
        expect(reference.provenance.kind).toBe('executed-gh-wasp-core-in-rhino');
        expect(reference.provenance.gh_commit).toBe('9bf05acd945e8581244a6ef3bf5a0733018c9b6d');
        expect(reference.provenance.component_body).toContain('verified original main');
        expect(reference.provenance.wasp_global_tolerance).toBe(0.002);
    });
    for (const spec of corpus.attributes) {
        for (const path of ['source', 'copied', 'placed', 'chained', 'full']) {
            it(`${spec.name} / ${path}: preserves the measured class, values, frames and mask`, () => {
                const source = SmartAttribute.fromData(clone(spec));
                const before = source.toData();
                const result = path === 'source' ? source : path === 'copied' ? source.copy()
                    : path === 'placed' ? source.transform(transforms[0])
                        : path === 'chained' ? source.transform(transforms[0]).transform(transforms[1])
                            : Attribute.fromData(source.transform(transforms[0]).toData());
                expect(result).toBeInstanceOf(SmartAttribute);
                compare(result.toData(), reference.part_paths[path].find(a => a.name === spec.name));
                expect(source.toData()).toEqual(before);
            });
        }
    }
    it('keeps the established JSON-array Part API and accepts explicit SmartAttribute instances', () => {
        const attr = SmartAttribute.fromData(corpus.attributes[0]);
        const p = new Part('A', base().geo, [], base().collider, [attr]);
        expect(p.attributes[0]).toEqual(attr.toData());
        expect(p.attributes[0]).not.toBeInstanceOf(SmartAttribute);
    });
    it('provides independent connections/masks/static values rather than GH aliases', () => {
        expect(reference.ownership).toMatchObject({ connections_shared: true, mask_shared: true, values_shared: true });
        const a = SmartAttribute.fromData(corpus.attributes[0]);
        for (const copy of [a.copy(), a.transform(transforms[0])]) {
            copy.connections[0].id = 77;
            copy.connections[0].pln.origin.x = 123;
            copy.conn_mask[0] = -1;
            copy.values[0].value = 'changed';
        }
        compare(a.toData(), corpus.attributes[0]);
    });
    it('preserves unknown envelope, connection, plane and value metadata independently', () => {
        const data = clone(corpus.attributes[0]);
        data.vendor = { nested: [1] };
        data.connections[0].vendor = { nested: [2] };
        data.connections[0].plane.vendor = { nested: [3] };
        data.values[0].vendor = { nested: [4] };
        const a = SmartAttribute.fromData(data);
        const copy = a.copy().transform(transforms[0]).toData();
        compare(copy, data);
        copy.vendor.nested[0] = 8;
        copy.connections[0].vendor.nested[0] = 8;
        copy.connections[0].plane.vendor.nested[0] = 8;
        compare(a.toData(), data);
    });
    for (const spec of corpus.invalid) {
        it(`${spec.id}: rejects malformed masks with a deliberate GH difference`, () => {
            const data = clone(corpus.attributes[0]);
            data.conn_mask = spec.mask;
            data.connections = data.connections.slice(0, spec.connections ?? 3);
            expect(() => SmartAttribute.fromData(data)).toThrow(/mask/);
        });
    }
    it('requires declared transport fields and valid connection IDs', () => {
        const data = clone(corpus.attributes[0]);
        delete data.conn_mask;
        expect(() => SmartAttribute.fromData(data)).toThrow(/conn_mask/);
        data.conn_mask = [1];
        data.connections[0].id = 'invalid';
        expect(() => SmartAttribute.fromData(data)).toThrow(/connection ID/);
    });
});

describe('geometric free slots and component validity', () => {
    for (const spec of corpus.cases) {
        if (spec.id === 'empty_mesh') continue;
        it(`${spec.id}: matches GH geometry and valid typed values without changing state`, () => {
            const a = make(spec);
            const before = a.aggregated_parts.map(p => p.toData());
            const p = a.aggregated_parts[0];
            expect(a.checkBlockedConnections(p)).toEqual(reference.cases[spec.id].free);
            compare(getValidSmartAttributes(a, corpus.attribute_ids)[0], reference.cases[spec.id].valid);
            expect(a.aggregated_parts.map(p => p.toData())).toEqual(before);
            expect(reference.cases[spec.id].query_unchanged).toBe(true);
        });
    }
    for (const full of [true, false]) {
        for (const id of ['alone', 'blocked0', 'blocked02', 'all_blocked', 'blocked0_pose0', 'blocked02_pose1']) {
            it(`${id}: full=${full} aggregation import preserves masks, placed attributes and validity`, () => {
                const a = make(corpus.cases.find(s => s.id === id));
                // Include independent bases for Light geometry recovery.
                a.parts = Object.fromEntries(a.aggregated_parts.map(p => [p.name, p.copy()]));
                // Root base is the original definition; blockers use their unposed local shapes.
                a.parts.A = base();
                for (const spec of corpus.cases.find(s => s.id === id).blockers.entries()) {
                    const [i, b] = spec;
                    const mesh = meshFromData(corpus.meshes[b.mesh]);
                    mesh.position.fromArray(b.offset);
                    a.parts['obstacle' + i] = new Part('obstacle' + i, mesh, [], new Collider([]), [], 100, i + 1);
                }
                const raw = a.toData(full);
                const loaded = Aggregation.fromData(raw);
                compare(getValidSmartAttributes(loaded, corpus.attribute_ids)[0], reference.cases[id].valid);
                compare(loaded.aggregated_parts[0].attributes, a.aggregated_parts[0].attributes);
                compare(getValidSmartAttributes(Aggregation.fromData(loaded.toData(full)), corpus.attribute_ids)[0], reference.cases[id].valid);
            });
        }
    }
    it('queries geometry independently of active_connections, collider, mode and occupancy graph', () => {
        const a = make(corpus.cases.find(s => s.id === 'blocked0'));
        a.mode = 1;
        a.aggregated_parts[0].active_connections = [];
        expect(a.checkBlockedConnections(a.aggregated_parts[0])).toEqual([1, 2]);
        const free = make(corpus.cases[0]);
        free.aggregated_parts[0].active_connections = [];
        expect(free.checkBlockedConnections(free.aggregated_parts[0])).toEqual([0, 1, 2]);
    });
    it('transforms Smart values in real manual docking, preserving stored slot frames and the base', () => {
        const attribute = clone(corpus.attributes.find(a => a.name === 'typed_point'));
        const p = Part.fromData({ ...clone(dockingCorpus.parts[0]), attributes: [attribute] });
        const a = new Aggregation('dock-smart', [p], api.generateRules([p]), 42);
        a.placeFirstPart('A');
        const result = a.placePartAtConnection(0, 0, 'A', 1);
        expect(result.success).toBe(true);
        expect(result.part.attributes[0].values[0].value).toEqual([3, 2, 3]);
        compare(result.part.attributes[0].connections, attribute.connections);
        compare(a.parts.A.attributes, [attribute]);
    });
    it('recovers missing legacy Light attributes once and retains explicit empty arrays', () => {
        const b = base();
        const p = b.transform(transforms[0]);
        const raw = p.toData(false, false);
        delete raw.attributes;
        compare(Part.fromData(raw, b).attributes, reference.part_paths.placed);
        raw.attributes = [];
        expect(Part.fromData(raw, b).attributes).toEqual([]);
    });
    it('uses attribute connection IDs as returned slot indices, preserving GH noncontiguous-ID semantics', () => {
        const a = make(corpus.cases[0]);
        a.aggregated_parts[0].connections.forEach((c, i) => { c.id = 99 + i; });
        a.aggregated_parts[0].attributes = [new SmartAttribute('ids', [{ type: 'Point', value: [1, 2, 3], valid: true }], true,
            [new Connection(a.aggregated_parts[0].connections[0].pln, 'x', 'A', 99)], [1]).toData()];
        expect(a.checkBlockedConnections(a.aggregated_parts[0])).toEqual([0, 1, 2]);
        expect(getValidSmartAttributes(a, ['ids'])[0]).toEqual(reference.noncontiguous_id_values);
    });
    it('keeps the first matching attribute even when invalid; repeated names and missing names follow GH', () => {
        const a = make(corpus.cases[0]);
        const first = clone(corpus.attributes[0]);
        first.name = 'same'; first.conn_mask = [-1];
        const second = clone(first); second.conn_mask = [1];
        a.aggregated_parts[0].attributes = [first, second];
        expect(getValidSmartAttributes(a, ['same', 'same', 'missing'])[0]).toEqual(reference.duplicate_name_values);
        a.aggregated_parts[0].attributes = [second];
        expect(getValidSmartAttributes(a, ['same', 'same'])[0]).toHaveLength(2);
    });
    it('returns independent values and preserves row alignment, including Parts without attributes', () => {
        const a = make(corpus.cases.find(s => s.id === 'blocked0'));
        const result = getValidSmartAttributes(a, ['ignore']);
        expect(result).toHaveLength(2);
        expect(result[1]).toEqual([]);
        result[0][0][0].value = 'changed';
        expect(getValidSmartAttributes(a, ['ignore'])[0][0][0].value).toBe('ignore');
        expect(getValidSmartAttributes(new Aggregation('empty', [], []), ['ignore'])).toEqual([]);
    });
    it('does not reproduce GH empty-mesh false blocking and rejects unsupported query variants', () => {
        const a = make(corpus.cases.find(s => s.id === 'empty_mesh'));
        expect(reference.cases.empty_mesh.free).toEqual([]);
        expect(() => a.checkBlockedConnections(a.aggregated_parts[0])).toThrow(/empty mesh/);
        expect(() => getValidSmartAttributes(a, ['ignore'])).toThrow(/empty mesh/);
        expect(() => a.checkBlockedConnections(a.aggregated_parts[0], true)).toThrow(/standard/);
        expect(() => a.checkBlockedConnections(a.aggregated_parts[0], false, new api.Graph())).toThrow(/standard/);
    });
    it('rejects invalid masks in the operation, invalid names and invalid tolerances', () => {
        const a = make(corpus.cases[0]);
        a.aggregated_parts[0].attributes[0].conn_mask = [2];
        expect(() => getValidSmartAttributes(a, ['free0'])).toThrow(/mask/);
        for (const ids of [[], null, [1]]) expect(() => getValidSmartAttributes(a, ids)).toThrow(/name/);
        for (const tolerance of [-1, NaN, Infinity, '0.002']) {
            expect(() => a.checkBlockedConnections(a.aggregated_parts[0], false, null, tolerance)).toThrow(/tolerance/);
            expect(() => getValidSmartAttributes(new Aggregation('empty', [], []), ['ignore'], tolerance)).toThrow(/tolerance/);
        }
        expect(a.checkBlockedConnections(a.aggregated_parts[0], false, null, 0)).toEqual([0, 1, 2]);
    });
});

describe('surface adapter ownership and model coordinates', () => {
    it('invalidates private caches for changed local pose and marked buffers, preserving the source BVH/index', () => {
        const a = make(corpus.cases.find(s => s.id === 'blocked0'));
        const mesh = a.aggregated_parts[1].geo;
        const geometry = mesh.geometry;
        const sentinel = { caller: true }; geometry.boundsTree = sentinel;
        const indices = Array.from(geometry.index.array);
        const positions = Array.from(geometry.attributes.position.array);
        expect(a.checkBlockedConnections(a.aggregated_parts[0])).toEqual([1, 2]);
        mesh.position.x = 10;
        expect(a.checkBlockedConnections(a.aggregated_parts[0])).toEqual([0, 1, 2]);
        mesh.position.x = 0;
        const attr = geometry.attributes.position;
        for (let i = 0; i < attr.count; i++) attr.setX(i, attr.getX(i) + 4);
        attr.needsUpdate = true;
        expect(a.checkBlockedConnections(a.aggregated_parts[0])).toEqual([0, 2]);
        expect(geometry.boundsTree).toBe(sentinel);
        expect(Array.from(geometry.index.array)).toEqual(indices);
        expect(geometry.attributes.position.array[0]).toBe(positions[0] + 4);
    });
    it('ignores scene parents and render visibility/material sides; nonindexed surfaces work', () => {
        const a = make(corpus.cases.find(s => s.id === 'blocked0'));
        const mesh = a.aggregated_parts[1].geo;
        const group = new Group(); group.position.set(100, 100, 100); group.add(mesh); group.updateMatrixWorld(true);
        mesh.visible = false;
        mesh.geometry = mesh.geometry.toNonIndexed();
        mesh.geometry.setDrawRange(0, 0);
        expect(a.checkBlockedConnections(a.aggregated_parts[0])).toEqual([1, 2]);
    });
    it('keeps double point coordinates distinct at the strict tolerance boundary', () => {
        const a = make(corpus.cases.find(s => s.id === 'blocked0'));
        const p = a.aggregated_parts[0];
        p.connections[0].pln.origin.z = 0.002;
        expect(a.checkBlockedConnections(p)).toEqual([0, 1, 2]);
        p.connections[0].pln.origin.z = 0.002 - 1e-10;
        expect(a.checkBlockedConnections(p)).toEqual([1, 2]);
    });
    it('handles matrixAutoUpdate=false without mutating mesh transforms or source buffers', () => {
        const a = make(corpus.cases.find(s => s.id === 'blocked0'));
        const mesh = a.aggregated_parts[1].geo;
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 0, 1, 0], 3));
        mesh.geometry = geometry; mesh.matrixAutoUpdate = false; mesh.matrix.makeTranslation(4, 0, 0);
        expect(a.checkBlockedConnections(a.aggregated_parts[0])).toEqual([0, 2]);
        expect(mesh.matrix.elements[12]).toBe(4);
        expect(mesh.geometry.attributes.position.getX(0)).toBe(-1);
        expect(mesh).toBeInstanceOf(Mesh);
    });
    it('does not expose the internal distance adapter or storage helpers', () => {
        expect(api).not.toHaveProperty('distanceToMesh');
        expect(api).not.toHaveProperty('copyAttributes');
        expect(api).not.toHaveProperty('transformAttributes');
    });
});

if (process.env.WASP_SMART_OUTPUT) {
    const source = base();
    const exports = {};
    for (const [key, p] of [['placed', source.transform(transforms[0])],
        ['chained', source.transform(transforms[0]).transform(transforms[1])]]) {
        exports[key] = { base: source.toData(), full: p.toData(), light: p.toData(false, false) };
    }
    writeFileSync(process.env.WASP_SMART_OUTPUT, JSON.stringify({ part_exports: exports }, null, 2) + '\n');
}
