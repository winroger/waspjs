/** WaspJS — Attribute comparisons measured in the pinned Rhino/GH core. */
import { describe, expect, it } from 'vitest';
import { Matrix4 } from 'three';
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import * as api from '../index.js';
import { Attribute, Part, Aggregation } from '../index.js';
import corpus from './fixtures/gh-attribute-cases.json';
import reference from './fixtures/gh-attribute-reference.json';
import fixture from './fixtures/minimal-part.json';
import dockingCorpus from './fixtures/gh-rules-cases.json';

const clone = value => globalThis.structuredClone(value);
const transforms = corpus.transforms.map(rows => new Matrix4().set(...rows.flat()));
const attrs = () => corpus.attributes.map(spec => clone(spec.data));
const base = () => Part.fromData({ ...clone(fixture), attributes: attrs() });
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

describe('GH Attribute counterpart', () => {
    it('uses actual pinned Rhino execution and declares the capture-only scalar adapter', () => {
        expect(reference.provenance.kind).toBe('executed-gh-wasp-core-in-rhino');
        expect(reference.provenance.gh_commit).toBe('9bf05acd945e8581244a6ef3bf5a0733018c9b6d');
        expect(reference.provenance.capture_adapter).toContain('System integral');
    });
    for (const spec of corpus.attributes) {
        for (const path of ['source', 'copied', 'placed', 'chained', 'imported']) {
            it(`${spec.id} ${path}: matches GH typed values`, () => {
                const a = Attribute.fromData(clone(spec.data));
                const source = a.toData();
                const result = path === 'source' ? a : path === 'copied' ? a.copy()
                    : path === 'chained' ? a.transform(transforms[0]).transform(transforms[1])
                        : path === 'imported' ? Attribute.fromData(a.transform(transforms[0]).toData())
                            : a.transform(transforms[0]);
                numeric(result.toData(), reference.cases[spec.id][path]);
                expect(a.toData()).toEqual(source);
            });
        }
    }
    it('retains independent static values instead of the GH alias', () => {
        expect(reference.ownership.static_copy_mutates_source).toBe(true);
        const a = Attribute.fromData(corpus.attributes[0].data);
        const b = a.copy();
        b.values[3].value.nested[2].label = 'changed';
        expect(a.values[3].value.nested[2].label).toBe('keep');
        const c = a.transform(transforms[0]);
        c.values[3].value.nested[2].label = 'moved';
        expect(a.values[3].value.nested[2].label).toBe('keep');
    });
    it('copies unknown envelope/value metadata without normalizing invalid or vendor payloads', () => {
        const raw = { class_type: 'Attribute', name: 'unknown', transformable: false,
            vendor: { nested: [1, 2] }, values: [{ type: 'VendorGeometry', valid: false,
                value: { points: [[1, 2, 3]] }, metadata: { keep: true } }] };
        const a = Attribute.fromData(raw);
        expect(a.toData()).toEqual(raw);
        expect(a.transform(transforms[0]).toData()).toEqual(raw);
        const result = a.toData();
        result.vendor.nested[0] = 7;
        result.values[0].value.points[0][0] = 9;
        expect(a.toData()).toEqual(raw);
        expect(reference.unsupported_reader.values.map(v => v.value)).toEqual([null, null]);
    });
    for (const type of ['String', 'Number', 'Vector', 'BoundingBox', 'Box', 'RhinoCommonObject', 'VendorGeometry']) {
        it(`${type}: rejects unsupported transformable values while retaining static JSON`, () => {
            const value = reference.inventory.find(v => v.data.type === type)?.data
                ?? { type, value: { opaque: true }, valid: true };
            const a = new Attribute('unsupported', [value], true);
            const before = a.toData();
            expect(() => a.transform(transforms[0])).toThrow(/Unsupported transformable attribute/);
            expect(a.toData()).toEqual(before);
            expect(new Attribute('static', [value], false).transform(transforms[0]).values).toEqual([value]);
        });
    }
    it('preserves metadata on a transformed Point and leaves embedded dictionary coordinates static', () => {
        const raw = clone(corpus.attributes[1].data);
        raw.extra = { keep: 1 };
        raw.values[0].extra = { keep: 2 };
        const moved = Attribute.fromData(raw).transform(transforms[0]).toData();
        expect(moved.extra).toEqual(raw.extra);
        expect(moved.values[0].extra).toEqual(raw.values[0].extra);
        expect(moved.values[0].value).toEqual([8, 21, 33]);
        const metadata = new Attribute('dictionary', [{ type: 'Dictionary', valid: true,
            value: { position: [1, 2, 3] } }], false);
        expect(metadata.transform(transforms[0]).toData()).toEqual(metadata.toData());
    });
    it('rejects invalid points, invalid records and affine/reflected placements explicitly', () => {
        const a = Attribute.fromData(corpus.attributes[1].data);
        expect(() => a.transform(new Matrix4().makeScale(2, 1, 1))).toThrow(/rigid/);
        expect(() => a.transform(new Matrix4().makeScale(-1, 1, 1))).toThrow(/rigid/);
        a.values[0].valid = false;
        expect(() => a.transform(transforms[0])).toThrow(/Unsupported/);
        a.values[0].valid = true;
        a.values[0].value = [NaN, 2, 3];
        expect(() => a.transform(transforms[0])).toThrow(/coordinates/);
        expect(() => new Attribute('bad', {}, false)).toThrow(/array/);
    });
    it('inventories SmartAttribute and InternalTransform without claiming their support', () => {
        expect(reference.deferred.smart.class_type).toBe('SmartAttribute');
        expect(reference.deferred.smart_connections_shared).toBe(true);
        expect(reference.deferred.internal.class_type).toBe('Attribute');
        expect(reference.deferred.internal_source_position).toBe(0.25);
        expect(reference.deferred.internal_copy_position).toBe(0.5);
        expect(reference.deferred.internal_transform_position).toBe(0.5);
        expect(api).not.toHaveProperty('SmartAttribute');
        expect(api).not.toHaveProperty('InternalTransform');
        expect(api).not.toHaveProperty('transformAttributeValue');
        expect(api).not.toHaveProperty('copyAttributes');
        expect(api).not.toHaveProperty('transformAttributes');
    });
});

describe('Part attribute integration', () => {
    for (const path of ['base', 'copied', 'placed', 'full', 'light']) {
        it(`${path}: matches actual GH Part attributes and preserves input/base`, () => {
            const source = base();
            const before = source.toData();
            const placed = source.transform(transforms[0]);
            const result = path === 'base' ? source : path === 'copied' ? source.copy()
                : path === 'placed' ? placed : path === 'full' ? Part.fromData(placed.toData())
                    : Part.fromData(placed.toData(false, false), source);
            numeric(result.attributes, reference.part_paths[path]);
            expect(source.toData()).toEqual(before);
        });
    }
    it('accepts Attribute instances but retains the public JSON-array shape', () => {
        const original = Attribute.fromData(corpus.attributes[1].data);
        const p = new Part('A', base().geo, [], base().collider, [original]);
        expect(p.attributes[0]).toEqual(original.toData());
        expect(p.attributes[0]).not.toBeInstanceOf(Attribute);
        original.values[0].value[0] = 99;
        expect(p.attributes[0].values[0].value[0]).toBe(1);
    });
    it('reconstructs missing legacy Light attributes with placement exactly once', () => {
        const source = base();
        const raw = source.transform(transforms[0]).toData(false, false);
        delete raw.attributes;
        const loaded = Part.fromData(raw, source);
        numeric(loaded.attributes, reference.part_paths.placed);
        expect(reference.part_paths.legacy_missing).toEqual([]);
        raw.attributes = [];
        expect(Part.fromData(raw, source).attributes).toEqual([]);
    });
    it('keeps opaque legacy JSON metadata unchanged and isolated', () => {
        const raw = [{ values: [{ position: [1, 2, 3] }], transformable: true }, null, 7, 'label'];
        const p = new Part('A', base().geo, [], base().collider, raw);
        const result = p.transform(transforms[0]);
        expect(result.attributes).toEqual(raw);
        result.attributes[0].values[0].position[0] = 99;
        expect(p.attributes).toEqual(raw);
    });
    it('retains static Smart payloads but rejects unimplemented declared Smart transformation', () => {
        const raw = clone(reference.deferred.smart);
        const p = new Part('A', base().geo, [], base().collider, [raw]);
        expect(() => p.transform(transforms[0])).toThrow(/SmartAttribute/);
        raw.transformable = false;
        const staticPart = new Part('A', base().geo, [], base().collider, [raw]);
        expect(staticPart.transform(transforms[0]).attributes).toEqual([raw]);
    });
    it.each([true, false])('retains transformed attributes through core aggregation roundtrip (Full=%s)', full => {
        const p = base();
        const placed = p.transform(transforms[0]);
        placed.id = 0;
        const a = new Aggregation('attributes', [p], [], 42);
        a.aggregated_parts = [placed];
        const exported = a.toData(full);
        const before = clone(exported);
        const loaded = Aggregation.fromData(exported);
        numeric(loaded.aggregated_parts[0].attributes, reference.part_paths.placed);
        numeric(Aggregation.fromData(loaded.toData(full)).aggregated_parts[0].attributes, reference.part_paths.placed);
        expect(exported).toEqual(before);
    });
    it('moves attributes in actual manual docking alongside geometry and frames', () => {
        const part = Part.fromData({ ...clone(dockingCorpus.parts[0]), attributes: [clone(corpus.attributes[1].data)] });
        const a = new Aggregation('dock', [part], api.generateRules([part]), 42);
        a.placeFirstPart('A');
        const placed = a.placePartAtConnection(0, 0, 'A', 1);
        expect(placed.success).toBe(true);
        expect(placed.part.attributes[0].values[0].value).toEqual([3, 2, 3]);
        expect(a.parts.A.attributes[0].values[0].value).toEqual([1, 2, 3]);
    });
});

if (process.env.WASP_ATTRIBUTE_OUTPUT) {
    const source = base();
    const placed = source.transform(transforms[0]);
    writeFileSync(process.env.WASP_ATTRIBUTE_OUTPUT, JSON.stringify({ full: placed.toData(),
        light: placed.toData(false, false) }, null, 2) + '\n');
}
