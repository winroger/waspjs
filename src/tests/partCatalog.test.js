/** WaspJS — PartCatalog behavior measured in the pinned Rhino/GH core. */
import { describe, expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { PartCatalog, Part, Aggregation, Rule, createPartCatalog } from '../index.js';
import corpus from './fixtures/gh-catalog-cases.json';
import reference from './fixtures/gh-catalog-reference.json';
import geometry from './fixtures/gh-rules-cases.json';

const clone = value => globalThis.structuredClone(value);
const base = (name = 'A') => Part.fromData({ ...clone(geometry.parts[0]), name });
const model = spec => new PartCatalog(spec.parts, spec.amounts, spec.limited, spec.adaptive);
function compare(actual, expected) {
    if (typeof expected === 'number') expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1e-10);
    else if (Array.isArray(expected)) {
        expect(actual).toHaveLength(expected.length);
        expected.forEach((item, i) => compare(actual[i], item));
    } else if (expected && typeof expected === 'object') {
        expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
        Object.keys(expected).forEach(key => compare(actual[key], expected[key]));
    } else expect(actual).toEqual(expected);
}
function state(c, expected) {
    compare(c.parts, expected.parts);
    compare(c.dict, expected.stock);
    compare(c.parts_total, expected.total);
    expect(c.is_limited).toBe(expected.limited);
    expect(c.is_adaptive).toBe(expected.adaptive);
    // JS derives emptiness immediately instead of GH's initially false flag.
    expect(c.is_empty).toBe(expected.total === 0);
}
function fresh(amount = 3, limited = true, adaptive = false, noRules = false) {
    const a = new Aggregation('inventory', [base()], noRules ? [] : [new Rule('A', 0, 'A', 1)], 42, 0,
        new PartCatalog(['A'], [amount], limited, adaptive));
    a.coll_check = false;
    return a;
}
function invariant(a) {
    expect(a.graph.getNodes().map(String).sort()).toEqual(a.aggregated_parts.map(p => String(p.id)).sort());
    for (const p of a.aggregated_parts) {
        if (p.parent === null) continue;
        const parent = a.aggregated_parts.find(other => other.id === p.parent);
        expect(parent.children).toContain(p.id);
        expect(parent.active_connections).not.toContain(p.conn_on_parent);
        expect(p.active_connections).not.toContain(p.conn_to_parent);
    }
}

describe('native PartCatalog model', () => {
    it('declares the actual GH/runtime reference and component provenance', () => {
        expect(reference.provenance.kind).toBe('executed-gh-wasp-core-in-rhino');
        expect(reference.provenance.gh_commit).toBe('9bf05acd945e8581244a6ef3bf5a0733018c9b6d');
        expect(reference.provenance.component_body).toContain('original valid-input main');
    });
    for (const spec of corpus.catalogs) {
        const target = reference.models[spec.id === 'adaptive_integer' ? 'adaptive_float' : spec.id];
        it(`${spec.id}: construction, update, copy and JS roundtrip preserve measured stock`, () => {
            const c = model(spec);
            state(c, target.source);
            for (const [i, [name, change]] of spec.updates.entries()) {
                c.update(name, change);
                state(c, target.steps[i].state);
                state(c.copy(), target.steps[i].copy);
                const loaded = PartCatalog.fromData(c.toData());
                state(loaded, target.steps[i].state);
                compare(c.toData().amounts, c.parts.map(part => c.dict[part]));
            }
        });
        it(`${spec.id}: weighted intervals match controlled GH dictionary order`, () => {
            const native = reference.models[spec.id];
            const c = new PartCatalog(native.dict_order, native.dict_order.map(name => native.source.stock[name]),
                spec.limited, spec.adaptive);
            expect(corpus.fractions.map(draw => c.returnWeightedPart(() => draw))).toEqual(native.weighted);
            expect(c.returnRandomPart(() => 0)).toBe(native.dict_order.find(name => native.source.stock[name] > 0) ?? null);
        });
    }
    it('keeps component broadcast and default flags distinct from core defaults', () => {
        const cat = createPartCatalog([base(), base('B')], [3], null, null);
        state(cat, reference.component);
        expect(cat.toData()).toEqual(reference.component.data);
        expect(new PartCatalog(['A'], [3]).is_limited).toBe(true);
        expect(createPartCatalog([base()], [3]).is_limited).toBe(false);
    });
    it('exports current rather than stale native initial amounts', () => {
        const native = reference.models.limited.steps[2];
        expect(native.state.stock).toEqual({ A: 0, B: 0 });
        expect(native.state.data.amounts).toEqual([2, 1]);
        expect(native.imported.stock).toEqual({ A: 2, B: 1 });
        const c = model(corpus.catalogs[0]);
        c.update('A', -2); c.update('B', -1);
        expect(c.amounts).toEqual([2, 1]);
        expect(c.toData().amounts).toEqual([0, 0]);
        expect(PartCatalog.fromData(c.toData()).is_empty).toBe(true);
    });
    it('uses floating adaptive normalization instead of Python-2 integer truncation', () => {
        expect(reference.models.adaptive_integer.steps[0].state.stock).toEqual({ A: 4, B: 5 });
        const c = new PartCatalog(['A', 'B'], [5, 5], false, true);
        c.update('A', -1);
        compare(c.dict, reference.models.adaptive_float.steps[0].state.stock);
        expect(c.parts_total).toBeCloseTo(10);
        expect(PartCatalog.fromData(c.toData()).dict.A).toBeCloseTo(c.dict.A);
    });
    it('owns inputs, names, copied stock and unknown metadata independently', () => {
        const raw = { parts: ['A', 'B'], amounts: [3, 1], is_limited: true, is_adaptive: false, vendor: { keep: [1] } };
        const c = PartCatalog.fromData(raw); raw.parts[0] = 'changed'; raw.vendor.keep[0] = 2;
        const copy = c.copy(); copy.parts[0] = 'renamed'; copy.dict.A = 99;
        const data = c.toData(); data.vendor.keep[0] = 3;
        expect(c.parts).toEqual(['A', 'B']);
        expect(c.dict).toEqual({ A: 3, B: 1 });
        expect(c.toData().vendor).toEqual({ keep: [1] });
    });
    it('uses explicit list order safely for numeric and object-property names', () => {
        const c = new PartCatalog(['10', '2', '__proto__', 'constructor'], [1, 1, 1, 1]);
        expect(c.returnWeightedPart(() => 0)).toBe('10');
        expect(c.returnWeightedPart(() => 0.5)).toBe('__proto__');
        c.update('__proto__', -1);
        expect(c.dict.__proto__).toBe(0);
        expect(c.toData().parts).toEqual(['10', '2', '__proto__', 'constructor']);
    });
    for (const invalid of [[], ['A', 'A'], [''], [null]]) {
        it(`rejects malformed names/amounts ${JSON.stringify(invalid)}`, () => {
            expect(() => new PartCatalog(invalid, [1])).toThrow();
        });
    }
    for (const amount of [-1, NaN, Infinity, '1', 0.5, Number.MAX_SAFE_INTEGER + 1]) {
        it(`rejects invalid limited count ${amount}`, () => expect(() => new PartCatalog(['A'], [amount])).toThrow());
    }
    it('rejects malformed flags, transport and component inputs', () => {
        expect(() => PartCatalog.fromData({ parts: ['A'], amounts: [1] })).toThrow();
        expect(() => new PartCatalog(['A'], [1], 1)).toThrow();
        expect(() => createPartCatalog([], [])).toThrow();
        expect(() => createPartCatalog([base(), base('B')], [1, 2, 3])).toThrow();
    });
    it('fails invalid updates atomically instead of native negative stock or division by zero', () => {
        expect(reference.errors.negative_stock.state.stock.A).toBe(-1);
        expect(reference.errors.adaptive_division_zero.outcome.ok).toBe(false);
        expect(reference.errors.adaptive_negative_weight.state.stock.A).toBeLessThan(0);
        for (const c of [new PartCatalog(['A'], [0]), new PartCatalog(['A'], [1], false, true),
            new PartCatalog(['A', 'B'], [0.5, 3.5], false, true)]) {
            const before = c.toData();
            expect(() => c.update('A', -1)).toThrow();
            expect(c.toData()).toEqual(before);
        }
        const c = new PartCatalog(['A'], [1]);
        for (const difference of [NaN, Infinity, '1', 0.5]) expect(() => c.update('A', difference)).toThrow();
        expect(() => c.update('missing', 1)).toThrow();
    });
    for (const value of [-1, 1, NaN, Infinity]) {
        it(`rejects invalid RNG draw ${value}`, () => expect(() => new PartCatalog(['A'], [1]).returnWeightedPart(() => value)).toThrow(/RNG/));
    }
    it('returns null without drawing for depleted/filtered catalogs and keeps global stock intact', () => {
        const draw = vi.fn(() => 0);
        const c = new PartCatalog(['A'], [2]);
        expect(c.returnWeightedPart(draw, [])).toBe(null);
        expect(c.is_empty).toBe(false);
        const empty = new PartCatalog([], []);
        expect(empty.returnRandomPart(draw)).toBe(null);
        expect(empty.returnWeightedPart(draw)).toBe(null);
        expect(draw).not.toHaveBeenCalled();
    });
});

describe('mode-0 inventory integration', () => {
    for (const spec of corpus.aggregations) {
        it(`${spec.id}: actual random placement count and remaining stock agree with native valid cases`, () => {
            const native = reference.aggregations[spec.id];
            const a = fresh(spec.amount, spec.limited, spec.adaptive, spec.no_rules);
            const log = vi.spyOn(console, 'error').mockImplementation(() => {});
            try { a.aggregate_rnd(spec.num); } finally { log.mockRestore(); }
            expect(a.aggregated_parts).toHaveLength(native.count);
            compare(a.catalog.dict, native.catalog.stock);
            invariant(a);
            if (native.trimmed) {
                a.removePartFromAggregation(1);
                compare(a.catalog.dict, native.trimmed.stock);
                invariant(a);
            }
        });
    }
    it('previews/manual placements enforce stock without consuming failed attempts', () => {
        const a = fresh(2);
        expect(a.placeFirstPart('A').success).toBe(true);
        const before = a.catalog.toData();
        expect(a.getValidPlacementsForPart('A').length).toBeGreaterThan(0);
        expect(a.getValidPlacementsAtParent('A', 0).length).toBeGreaterThan(0);
        expect(a.getValidPlacementsAtConnection('A', 0, 0).length).toBeGreaterThan(0);
        expect(a.catalog.toData()).toEqual(before);
        expect(a.placePartAtConnection(0, 0, 'A', 0).success).toBe(false);
        expect(a.catalog.toData()).toEqual(before);
        expect(a.placePartAtConnection(0, 0, 'A', 1).success).toBe(true);
        expect(a.catalog.dict.A).toBe(0);
        expect(a.getValidPlacementsForPart('A')).toEqual([]);
        expect(a.getValidPlacementsAtParent('A', 1)).toEqual([]);
        expect(a.getValidPlacementsAtConnection('A', 1, 0)).toEqual([]);
        const state = a.toData();
        expect(a.placePartAtConnection(1, 0, 'A', 1).success).toBe(false);
        expect(a.addPartToAggregation()).toBe(false);
        expect(a.toData()).toEqual(state);
    });
    it('does not debit collisions or failed transformations', () => {
        const a = fresh(2); a.placeFirstPart('A');
        const before = a.catalog.toData();
        a._checkCollision = () => true;
        expect(a.placePartAtConnection(0, 0, 'A', 1).success).toBe(false);
        const log = vi.spyOn(console, 'error').mockImplementation(() => {});
        try { expect(a.addPartToAggregation()).toBe(false); } finally { log.mockRestore(); }
        expect(a.catalog.toData()).toEqual(before);
        a._checkCollision = () => false;
        a.parts.A.transform = () => null;
        expect(a.placePartAtConnection(0, 0, 'A', 1).success).toBe(false);
        expect(a.catalog.toData()).toEqual(before);
        expect(a.aggregated_parts).toHaveLength(1);
    });
    for (const full of [true, false]) {
        it(`Full=${full}: JS remaining stock survives import, continuation and subtree refunds`, () => {
            const a = fresh(4); a.placeFirstPart('A'); a.placePartAtConnection(0, 0, 'A', 1);
            const exported = a.toData(full); const before = clone(exported);
            const loaded = Aggregation.fromData(exported);
            expect(loaded.catalog.dict.A).toBe(2);
            expect(loaded.placePartAtConnection(1, 0, 'A', 1).success).toBe(true);
            expect(loaded.catalog.dict.A).toBe(1);
            loaded.removePartFromAggregation(1);
            expect(loaded.catalog.dict.A).toBe(3);
            expect(loaded.aggregated_parts).toHaveLength(1);
            invariant(loaded);
            expect(exported).toEqual(before);
            expect(a.catalog.dict.A).toBe(2);
            expect(Aggregation.fromData(loaded.toData(full)).catalog.dict.A).toBe(3);
        });
        it(`Full=${full}: GH stale amount export is accepted as supplied, not heuristically deducted`, () => {
            const native = reference.aggregations.limited_two[full ? 'full' : 'light'];
            const a = Aggregation.fromData(clone(native));
            expect(a.aggregated_parts).toHaveLength(2);
            expect(a.catalog.dict.A).toBe(2); // Native writer exported initial, not remaining, amounts.
        });
    }
    it('preserves fractional adaptive weights through full/light imports', () => {
        const cat = new PartCatalog(['A', 'B'], [5, 5], false, true);
        const a = new Aggregation('adaptive', [base(), base('B')], [], 42, 0, cat);
        a.placeFirstPart('A');
        for (const full of [true, false]) compare(Aggregation.fromData(a.toData(full)).catalog.dict, a.catalog.dict);
        expect(cat.dict).toEqual({ A: 5, B: 5 });
    });
    it('copies incoming inventory and keeps base Part helpers distinct from the inventory', () => {
        const cat = new PartCatalog(['A'], [2]);
        const a = new Aggregation('copy', [base(), base('B')], [], 42, 0, cat);
        const b = new Aggregation('copy2', [base()], [], 42, 0, cat);
        expect(a.placeFirstPart('B').success).toBe(false);
        a.placeFirstPart('A');
        expect(cat.dict.A).toBe(2); expect(b.catalog.dict.A).toBe(2);
        expect(a.getBaseParts().map(p => p.name)).toEqual(['A', 'B']);
        expect(a.getValidPlacementsForPart('B')).toEqual([]);
        expect(a.placeFirstPart('B').success).toBe(false);
    });
    it('applies active random-type filters together with stock, without spending excluded types', () => {
        const a = new Aggregation('filtered', [base(), base('B')], [], 42, 0,
            new PartCatalog(['A', 'B'], [100, 1]));
        const draw = vi.fn(a.randomFn); a.randomFn = draw;
        a.setActivePartTypes(['B']);
        expect(a.addFirstPartToAggregation()).toBe(true);
        expect(a.aggregated_parts[0].name).toBe('B');
        expect(a.catalog.dict).toEqual({ A: 100, B: 0 });
        const before = draw.mock.calls.length;
        expect(a.addPartToAggregation()).toBe(false);
        expect(draw).toHaveBeenCalledTimes(before);
    });
    it('restores exhausted stock after removing all parts and supports a new seed', () => {
        const a = fresh(1); a.placeFirstPart('A');
        expect(a.catalog.is_empty).toBe(true);
        a.removePartFromAggregation(0);
        expect(a.catalog.dict.A).toBe(1);
        expect(a.placeFirstPart('A').part.id).toBe(1);
        invariant(a);
    });
    it('validates an overflowing refund before changing the model', () => {
        const a = fresh(Number.MAX_SAFE_INTEGER); a.placeFirstPart('A');
        a.catalog.update('A', 1);
        const before = a.toData();
        expect(() => a.removePartFromAggregation(0)).toThrow();
        expect(a.toData()).toEqual(before);
    });
    it('does not infer a debit/refund for imported Part types outside the inventory', () => {
        const a = new Aggregation('previous', [base(), base('B')], [], 42, 0, new PartCatalog(['B'], [3]));
        const previous = base(); previous.id = 0; a.aggregated_parts = [previous];
        const loaded = Aggregation.fromData(a.toData());
        expect(loaded.catalog.dict).toEqual({ B: 3 });
        loaded.removePartFromAggregation(0);
        expect(loaded.catalog.dict).toEqual({ B: 3 });
    });
    it('treats unsafe adaptive decrements as unavailable instead of invalidating model state', () => {
        const a = new Aggregation('unsafe', [base()], [], 42, 0, new PartCatalog(['A'], [1], false, true));
        const before = a.toData();
        expect(a.placeFirstPart('A').success).toBe(false);
        expect(a.addFirstPartToAggregation()).toBe(false);
        expect(a.toData()).toEqual(before);
    });
    for (const mode of [1, 2, 3]) {
        it(`rejects catalog with mode ${mode} instead of enabling constraints`, () => {
            expect(() => new Aggregation('mode', [base()], [], 42, mode, new PartCatalog(['A'], [2]))).toThrow();
            const raw = fresh().toData(); raw.mode = mode;
            expect(() => Aggregation.fromData(raw)).toThrow();
        });
    }
    it('guards later mode mutation, unknown definitions and unsupported compact export', () => {
        expect(() => new Aggregation('missing', [base()], [], 42, 0, new PartCatalog(['missing'], [1]))).toThrow(/Unknown/);
        const a = fresh(); expect(() => a.toFileData()).toThrow(/Compact/);
        a.mode = 1;
        expect(() => a.toData()).toThrow(/mode 0/);
        expect(() => a.placeFirstPart('A')).toThrow(/mode 0/);
        expect(() => a.getValidPlacementsForPart('A')).toThrow(/mode 0/);
        expect(() => a.addPartToAggregation()).toThrow(/mode 0/);
    });
    it('retains reproducible JS random growth for the same catalog and seed', () => {
        const make = () => {
            const a = new Aggregation('rng', [base(), base('B')], [new Rule('A', 0, 'B', 1), new Rule('B', 0, 'A', 1)], 42, 0,
                new PartCatalog(['A', 'B'], [3, 3]));
            a.coll_check = false; a.aggregate_rnd(6);
            expect(a.aggregated_parts).toHaveLength(6);
            expect(a.catalog.dict).toEqual({ A: 0, B: 0 });
            invariant(a);
            return a;
        };
        expect(make().toData()).toEqual(make().toData());
    });
});

if (process.env.WASP_CATALOG_OUTPUT) {
    const limited = fresh(3); limited.placeFirstPart('A'); limited.placePartAtConnection(0, 0, 'A', 1);
    const adaptive = new PartCatalog(['A', 'B'], [5, 5], false, true); adaptive.update('A', -1);
    writeFileSync(process.env.WASP_CATALOG_OUTPUT, JSON.stringify({ catalogs: { limited: limited.catalog.toData(), adaptive: adaptive.toData() },
        aggregations: { limited: { full: limited.toData(), light: limited.toData(false) } } }, null, 2) + '\n');
}
