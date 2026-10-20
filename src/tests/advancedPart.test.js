/** WaspJS — AdvancedPart and additional-collider behavior measured in the GH core. */
import { describe, it, expect } from 'vitest';
import { Matrix4 } from 'three';
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import * as api from '../index.js';
import { AdvancedPart, Part, Aggregation, Collider, Rule, loadAggregation } from '../index.js';
import corpus from './fixtures/gh-advanced-part-cases.json';
import reference from './fixtures/gh-advanced-part-reference.json';

const clone = value => globalThis.structuredClone(value);
const transforms = corpus.transforms.map(rows => new Matrix4().set(...rows.flat()));
const base = id => AdvancedPart.fromData(clone(reference.parts[id].source.data));
function parented(id) {
    const p = base(id); p.parent = 42; p.conn_on_parent = 0; p.conn_to_parent = 0; p.children = [77];
    return p;
}
function data(p) {
    const raw = p.toData();
    for (const c of raw.connections) delete c.plane.zaxis;
    for (const c of raw.add_collider?.connections ?? []) delete c.plane.zaxis;
    return raw;
}
const snapshot = p => ({ data: data(p), is_constrained: p.is_constrained, hierarchy_level: p.hierarchy_level });
function numeric(actual, expected) {
    if (typeof expected === 'number') expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1e-5);
    else if (Array.isArray(expected)) {
        expect(actual).toHaveLength(expected.length);
        expected.forEach((v, i) => numeric(actual[i], v));
    } else if (expected && typeof expected === 'object') {
        expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
        Object.keys(expected).forEach(k => numeric(actual[k], expected[k]));
    } else expect(actual).toEqual(expected);
}
function fresh(spec) {
    const parts = reference.placements[spec.id].bases.map(d => Part.fromData(clone(d)));
    const a = new Aggregation('advanced-placement', parts, [new Rule('A', 0, 'B', 0)], 42, spec.mode);
    a.coll_check = spec.coll_check;
    a.placeFirstPart('A');
    if (spec.posed_root) {
        a.aggregated_parts[0] = Part.fromData(clone(reference.placements[spec.id].root));
        a.aggregated_parts[0].resetPart(a.rules);
    }
    return a;
}
const valid = p => p?.add_collider ? [...p.add_collider.validConnections] : null;
const observations = { parts: {}, part_exports: {}, placements: {}, seeds: {} };

describe('GH AdvancedPart model and transport', () => {
    it('exports the class from the same module as Part and uses executed pinned measurements', () => {
        expect(new AdvancedPart('B', base('plain').geo, [], new Collider([]))).toBeInstanceOf(Part);
        expect(reference.provenance.kind).toBe('executed-gh-wasp-core-in-rhino');
        expect(reference.provenance.gh_commit).toBe('9bf05acd945e8581244a6ef3bf5a0733018c9b6d');
        expect('advancedFromPart' in api).toBe(false);
        expect('assertAdvancedCollections' in api).toBe(false);
    });
    for (const spec of corpus.parts) {
        for (const path of Object.keys(reference.parts[spec.id])) {
            it(`${spec.id} ${path}: matches the native class, placed collider and attributes`, () => {
                const source = base(spec.id); const before = source.toData();
                let result;
                if (path === 'source') result = source;
                else if (path === 'copied') result = parented(spec.id).copy();
                else if (path === 'copy_parenting') result = parented(spec.id).copy(true);
                else if (path === 'placed') result = source.transform(transforms[0]);
                else if (path === 'chained') result = source.transform(transforms[0]).transform(transforms[1]);
                else if (path === 'transformed_parenting') result = parented(spec.id).transform(transforms[0], false, 0, true);
                else if (path === 'full_import') result = AdvancedPart.fromData(source.transform(transforms[0]).toData());
                else result = AdvancedPart.fromData(source.transform(transforms[0]).toData(false), source);
                expect(result).toBeInstanceOf(AdvancedPart);
                numeric(snapshot(result), reference.parts[spec.id][path]);
                expect(source.toData()).toEqual(before);
                (observations.parts[spec.id] ??= {})[path] = snapshot(result);
            });
        }
        it(`${spec.id}: JS Light recovers omitted primary buffers without moving inline additional geometry twice`, () => {
            const source = base(spec.id); const placed = source.transform(transforms[0]).transform(transforms[1]);
            const raw = placed.toData(false, false); const before = clone(raw);
            const restored = AdvancedPart.fromData(raw, source);
            numeric(data(restored), data(placed));
            expect(raw).toEqual(before);
            if (restored.add_collider) {
                expect(restored.add_collider).not.toBe(source.add_collider);
                for (let i = 0; i < restored.add_collider.geometry.length; i++) {
                    expect(restored.add_collider.geometry[i].geometry).not.toBe(source.add_collider.geometry[i].geometry);
                }
            }
            observations.part_exports[spec.id] = { base: source.toData(), full: placed.toData(), light: placed.toData(false) };
        });
    }
});

describe('GH additional-collider placement paths', () => {
    for (const spec of corpus.placements) {
        it(`${spec.id}: query, manual and random growth agree with GH without changing the JS catalog`, () => {
            const expected = reference.placements[spec.id];
            const a = fresh(spec); const before = a.parts.B.toData();
            const candidates = a.getValidPlacementsForPart('B');
            expect(candidates.length).toBe(expected.query_count);
            expect(a.parts.B.toData()).toEqual(before);
            const child = candidates[0]?.transformedPart;
            expect(valid(child)).toEqual(expected.query_child_valid);
            if (child) expect(child.active_connections).toEqual([0]);
            const manual = fresh(spec); const placed = manual.placePartAtConnection(0, 0, 'B', 0);
            expect(placed.success).toBe(expected.random_placed);
            if (placed.success) {
                expect(valid(placed.part)).toEqual(expected.random_valid);
                expect(placed.part.active_connections).toEqual(expected.active_connections);
                expect(manual.graph.getEdges()).toEqual([[0, 1]]);
            }
            const random = fresh(spec); const success = random.addPartToAggregation();
            expect(success).toBe(expected.random_placed);
            if (success) expect(valid(random.aggregated_parts[1])).toEqual(expected.random_valid);
            expect(random.parts.B.toData()).toEqual(before);
            observations.placements[spec.id] = { query_count: candidates.length, query_child_valid: valid(child),
                manual_placed: placed.success, manual_valid: placed.success ? valid(placed.part) : null,
                random_placed: success, random_valid: success ? valid(random.aggregated_parts[1]) : null,
                js_base_valid: valid(a.parts.B), gh_query_base_valid: expected.query_base_valid };
        });
        for (const full of [true, false]) {
            it(`${spec.id} ${full ? 'full' : 'light'}: imported mode and AdvancedPart remain effective`, () => {
                const a = fresh(spec); const raw = a.toData(full);
                const loaded = Aggregation.fromData(clone(raw));
                expect(loaded.mode).toBe(spec.mode);
                expect(loaded.parts.B).toBeInstanceOf(AdvancedPart);
                expect(loaded.placePartAtConnection(0, 0, 'B', 0).success).toBe(reference.placements[spec.id].random_placed);
                if (loaded.aggregated_parts.length === 2) {
                    const again = Aggregation.fromData(loaded.toData(full));
                    expect(again.aggregated_parts[1]).toBeInstanceOf(AdvancedPart);
                    numeric(data(again.aggregated_parts[1]), data(loaded.aggregated_parts[1]));
                    expect(again.aggregated_parts[1].active_connections).toEqual([]);
                }
            });
        }
    }
    for (const [key, expected] of Object.entries(reference.seeds)) {
        it(`${key}: first seed bypasses additional checks as GH does`, () => {
            const [mode, ...name] = key.split('-'); const b = base(name.join('-'));
            const a = new Aggregation('seed', [b], [], 42, Number(mode));
            expect(a.addPartToAggregation()).toBe(true);
            expect(a.aggregated_parts).toHaveLength(expected.count);
            expect(valid(a.aggregated_parts[0])).toEqual(expected.valid);
            const manual = new Aggregation('seed', [base(name.join('-'))], [], 42, Number(mode));
            expect(manual.placeFirstPart('B').success).toBe(true);
            expect(valid(manual.aggregated_parts[0])).toEqual(expected.valid);
            observations.seeds[key] = { count: a.aggregated_parts.length, valid: valid(a.aggregated_parts[0]) };
        });
    }
});

describe('AdvancedPart support boundaries and ownership', () => {
    for (const field of ['supports', 'sub_parts', 'adjacency_const', 'orientation_const']) {
        for (const value of [[{ unsupported: true }], null, {}]) {
            it(`rejects unsupported ${field} input ${JSON.stringify(value)}`, () => {
                const raw = clone(reference.parts.alternatives.source.data); raw[field] = value;
                expect(() => AdvancedPart.fromData(raw)).toThrow(/not implemented/);
                const spec = corpus.placements.find(p => p.id === 'alternatives-mode1');
                const input = fresh(spec).toData(); input.parts[1][field] = value;
                expect(() => Aggregation.fromData(input)).toThrow(/not implemented/);
            });
        }
        it(`rejects a mutated ${field} at copy, transform, export and placement`, () => {
            const p = base('alternatives'); p[field] = [{}];
            expect(() => p.copy()).toThrow(/not implemented/);
            expect(() => p.transform(transforms[0])).toThrow(/not implemented/);
            expect(() => p.toData()).toThrow(/not implemented/);
            const a = fresh(corpus.placements.find(s => s.id === 'alternatives-mode1'));
            a.aggregated_parts[0] = p;
            expect(() => a._checkCollision(base('plain'))).toThrow(/not implemented/);
        });
    }
    it('guards constructor inputs before assigning Connection ownership', () => {
        const source = base('plain'); const conn = source.connections[0]; const before = conn.toData();
        expect(() => new AdvancedPart('Other', source.geo, [conn], source.collider, [], null, [{}])).toThrow(/supports/);
        expect(conn.toData()).toEqual(before);
        expect(() => new AdvancedPart('B', source.geo, [], source.collider, [], {})).toThrow(/add_collider/);
        expect(() => new AdvancedPart('B', source.geo, [], null)).toThrow(/primary Collider/);
    });
    it('does not pretend to implement hierarchy or silently downcast AdvancedPart data', () => {
        const p = base('plain');
        expect(() => p.transform(transforms[0], true)).toThrow(/sub-part/);
        expect(() => p.transform(transforms[0], false, 2)).toThrow(/sub-part/);
        expect(() => AdvancedPart.fromData({ ...p.toData(), hierarchy_level: 1 })).toThrow(/hierarchy/);
        expect(Part.fromData(p.toData())).toBeInstanceOf(AdvancedPart);
        expect(() => AdvancedPart.fromData({ ...p.toData(), class_type: 'Part' })).toThrow(/class_type/);
    });
    it('retains independent primary/additional meshes, attributes, parenting and unknown JSON metadata', () => {
        const raw = base('alternatives').toData(); raw.vendor = { nested: [1, 2] };
        const p = AdvancedPart.fromData(raw); p.parent = 42; p.children = [77];
        const result = p.transform(transforms[0], false, 0, true);
        result.geo.geometry.attributes.position.setX(0, 999);
        result.collider.geometry[0].geometry.attributes.position.setX(0, 999);
        result.add_collider.geometry[0].geometry.attributes.position.setX(0, 999);
        result.add_collider.connections[0].pln.origin.x = 999;
        result.add_collider.validConnections.push(2);
        result.attributes[0].values[0].value[0] = 999;
        result.children.push(88); result._extraData.vendor.nested[0] = 999;
        expect(p.geo.geometry.attributes.position.getX(0)).not.toBe(999);
        expect(p.collider.geometry[0].geometry.attributes.position.getX(0)).not.toBe(999);
        expect(p.add_collider.geometry[0].geometry.attributes.position.getX(0)).not.toBe(999);
        expect(p.add_collider.connections[0].pln.origin.x).toBe(0);
        expect(p.add_collider.validConnections).toEqual([99]);
        expect(p.attributes[0].values[0].value[0]).toBe(1);
        expect(p.children).toEqual([77]); expect(p.toData().vendor).toEqual(raw.vendor);
        expect(p.copy(true).toData().vendor).toEqual(raw.vendor);
    });
    it('recovers omitted legacy additional geometry once while explicit null clears it', () => {
        const p = base('alternatives'); const placed = p.transform(transforms[0]);
        const legacy = placed.toData(false, false); delete legacy.add_collider;
        numeric(data(AdvancedPart.fromData(legacy, p)), data(placed));
        legacy.add_collider = null;
        expect(AdvancedPart.fromData(legacy, p).add_collider).toBeNull();
        expect(() => AdvancedPart.fromData(legacy)).toThrow(/AdvancedPart base/);
        expect(() => AdvancedPart.fromData(legacy, new Part('B', p.geo, [], p.collider, []))).toThrow(/AdvancedPart base/);
        const unsupportedBase = p.copy(); unsupportedBase.supports.push({});
        expect(() => AdvancedPart.fromData(legacy, unsupportedBase)).toThrow(/supports/);
    });
    it('preserves explicit connection occupancy instead of the native AdvancedPart reader reset', () => {
        const p = base('alternatives'); const raw = p.toData(); raw.active_connections = [];
        expect(AdvancedPart.fromData(raw).active_connections).toEqual([]);
    });
    it('keeps the old seed position and adds mode as a fifth constructor argument', () => {
        const p = base('plain');
        expect(new Aggregation('old', [p], [], 1).mode).toBe(0);
        const a = new Aggregation('new', [p], [], 42, 1);
        expect(a.rnd_seed).toBe(42); expect(a.mode).toBe(1);
        expect(Aggregation.fromData(a.toData()).mode).toBe(1);
    });
    it('matches the GH automatic collider radius while explicit GH dim survives import', () => {
        const p = base('plain');
        const advanced = new AdvancedPart('B', p.geo, [], p.collider);
        const ordinary = new Part('B', p.geo, [], p.collider, [], null);
        expect(advanced.dim).toBe(ordinary.dim);
        expect(advanced.dim).toBeCloseTo(reference.reader_limits.default_dim, 7);
        expect(p.dim).toBe(100);
    });
    for (const mode of [2, 3, 4, -1]) {
        it(`continues rejecting unsupported mode ${mode}`, () => {
            expect(() => new Aggregation('bad', [], [], 42, mode)).toThrow(/modes/);
            const a = fresh(corpus.placements[0]); const raw = a.toData(); raw.mode = mode;
            expect(() => Aggregation.fromData(raw)).toThrow(/modes/);
            a.mode = mode;
            expect(() => a.toData()).toThrow(/modes/);
            expect(() => a.addPartToAggregation()).toThrow(/modes/);
        });
    }
    it('continues rejecting Fields, global constraints and inventory catalog in mode 1', () => {
        const raw = fresh(corpus.placements.find(s => s.mode === 1)).toData();
        for (const [field, value] of [['field',[{}]], ['global_constraints',[{type:'plane'}]], ['catalog',{}]]) {
            expect(() => Aggregation.fromData({ ...raw, [field]: value })).toThrow(/not implemented/);
        }
    });
    it('does not silently reconstruct AdvancedPart through the separate compact loader', () => {
        const a = new Aggregation('compact', [base('plain')], [], 42, 1); a.placeFirstPart('B');
        expect(() => loadAggregation(a.toFileData(), [base('plain')], [], 42)).toThrow(/AdvancedPart compact/);
    });
    it('returns the additional collider through the core runtime query', () => {
        const p = base('free'); expect(p.returnPartData().add_collider).toBe(p.add_collider);
    });
    it('writes actual JS exports for optional GH reader verification', () => {
        if (process.env.WASP_ADVANCED_OUTPUT) writeFileSync(process.env.WASP_ADVANCED_OUTPUT, JSON.stringify(observations, null, 2) + '\n');
    });
});
