/** WaspJS — actual GH Graph and aggregation-state comparisons; DisCo excluded. */
import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { Matrix4 } from 'three';
import { Aggregation, Graph, Part, Rule, loadAggregation } from '../index.js';
import corpus from './fixtures/gh-rules-cases.json';
import reference from './fixtures/gh-aggregation-reference.json';

const clone = value => globalThis.structuredClone(value);
const bases = () => corpus.parts.map(p => Part.fromData(clone(p)));
const rules = () => corpus.rules.map(Rule.fromData);
function fresh(size = 3) {
    const a = new Aggregation('state', bases(), rules(), 42);
    expect(a.placeFirstPart('A').success).toBe(true);
    for (let i = 1; i < size; i++) expect(a.placePartAtConnection(i - 1, 0, 'B', 1).success).toBe(true);
    return a;
}

// Existing BVH construction reorders triangle lists; preserve vertex/winding data.
// GH transports X/Y only; JS also includes the derived Z axis.
function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'zaxis')
        .map(([key, v]) => [key, key === 'faces' ? [...v].sort((a, b) => a.join(',').localeCompare(b.join(','))) : canonical(v)]));
}
function numeric(actual, expected) {
    if (typeof expected === 'number') expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1e-5);
    else if (Array.isArray(expected)) {
        expect(actual).toHaveLength(expected.length);
        expected.forEach((v, i) => numeric(actual[i], v));
    } else if (expected && typeof expected === 'object') {
        expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
        for (const key of Object.keys(expected)) numeric(actual[key], expected[key]);
    } else expect(actual).toEqual(expected);
}
function placementState(data) {
    return canonical({ graph: data.graph, sequence: data.aggregated_parts_sequence,
        parts: data.aggregated_parts });
}
function invariants(a) {
    const data = a.toData();
    const byId = new Map(a.aggregated_parts.map(p => [p.id, p]));
    expect(a.graph.getNodes().map(String).sort()).toEqual([...byId.keys()].map(String).sort());
    for (const p of a.aggregated_parts) {
        expect(new Set(p.active_connections).size).toBe(p.active_connections.length);
        for (const id of p.children) expect(byId.get(id).parent).toBe(p.id);
        if (p.parent !== null) {
            expect(byId.get(p.parent).children).toContain(p.id);
            expect(byId.get(p.parent).active_connections).not.toContain(p.conn_on_parent);
            expect(p.active_connections).not.toContain(p.conn_to_parent);
            expect(data.graph[p.parent][p.id]).toEqual({ start: p.parent, end: p.id,
                conn_start: p.conn_on_parent, conn_end: p.conn_to_parent });
        }
    }
}

describe('GH Graph counterpart', () => {
    it('uses an actual pinned Rhino execution', () => {
        expect(reference.provenance.kind).toBe('executed-gh-wasp-core-in-rhino');
        expect(reference.provenance.gh_commit).toBe('9bf05acd945e8581244a6ef3bf5a0733018c9b6d');
    });
    it('matches directed queries, groups, edge attributes and duplicate-pair behavior', () => {
        const g = Graph.fromData(reference.full.graph);
        const expected = reference.graph_queries;
        expect(g.getNodes()).toEqual(expected.nodes);
        expect(g.getEdges()).toEqual(expected.edges);
        expect(g.getEdges(false)).toEqual(expected.grouped);
        expect(g.getEdgesAttributes()).toEqual(expected.attributes);
        expect(g.getEdgesAttributes(false)).toEqual(expected.grouped_attributes);
        expect(g.countEdges()).toBe(expected.count);
        g.addEdge(0, 1, 9, 9);
        g.removeNode(1);
        expect(g.toData()).toEqual(reference.graph_after_remove);
        // GH's JSON reader leaves string keys, so removing an integer ID can miss.
        expect(reference.graph_reader_after_remove).toHaveProperty('1');
    });
    for (const [key, options] of [['full_graph', []], ['filtered_graph', [true, 0.002, true]],
        ['custom_graph', [true, 0.002, true, [new Rule('B', 1, 'A', 0)]]]]) {
        it(`matches GH ${key} from connection origins`, () => {
            expect(Graph.fromAggregation(fresh(), ...options).toData()).toEqual(reference[key]);
        });
    }
    it('returns the existing sequence graph without geometry recomputation', () => {
        const a = fresh();
        expect(Graph.fromAggregation(a, false)).toBe(a.graph);
    });
    it('uses model-unit tolerance and keeps isolated nodes', () => {
        const a = fresh(2);
        a.aggregated_parts[1] = a.aggregated_parts[1].transform(new Matrix4().makeTranslation(0, 0.0015, 0));
        expect(Graph.fromAggregation(a, true, 0.002).countEdges()).toBe(2);
        const g = Graph.fromAggregation(a, true, 0.001);
        expect(g.countEdges()).toBe(0);
        expect(g.getNodes()).toEqual([0, 1]);
    });
    it('keeps the first connection pair for a part pair, as GH does', () => {
        const a = fresh(2);
        a.aggregated_parts[0].connections.push(a.aggregated_parts[0].connections[0].copy());
        const g = Graph.fromAggregation(a);
        expect(g.countEdges()).toBe(2);
        expect(g.graph_dict[0][1].conn_start).toBe(0);
    });
    it('does not alias inputs, exported snapshots or queried edge attributes', () => {
        const raw = clone(reference.full.graph);
        raw[0][1].metadata = { label: 'keep' };
        const g = Graph.fromData(raw);
        raw[0][1].metadata.label = 'input changed';
        const output = g.toData();
        output[0][1].metadata.label = 'output changed';
        g.getEdgesAttributes()[0].metadata.label = 'query changed';
        expect(g.toData()[0][1].metadata.label).toBe('keep');
    });
    it('supports arbitrary string IDs, including object-property names', () => {
        const g = new Graph();
        g.addNode('__proto__');
        g.addNode('42-beam');
        g.addEdge('__proto__', '42-beam', 0, 1);
        const restored = Graph.fromData(JSON.parse(JSON.stringify(g.toData())));
        expect(restored.getNodes()).toEqual(['__proto__', '42-beam']);
        expect(restored.getEdges()).toEqual([['__proto__', '42-beam']]);
    });
    it('explicitly rejects unsupported attribute export and invalid adjacency data', () => {
        expect(() => new Graph().toData(true)).toThrow(/not implemented/);
        expect(() => Graph.fromData([])).toThrow(/dictionary/);
        expect(() => Graph.fromData({ 0: [] })).toThrow(/neighbours/);
        expect(() => Graph.fromData({ 0: { 1: { start: 9, end: 1 } } })).toThrow(/edge/);
        expect(() => Graph.fromAggregation(fresh(), true, -1)).toThrow(/tolerance/);
    });
});

describe('aggregation state and roundtrips', () => {
    it('automatically records the same sequence graph and placed state as GH', () => {
        const a = fresh();
        numeric(placementState(a.toData()), placementState(reference.full));
        invariants(a);
    });
    for (const mode of ['full', 'light']) {
        it(`${mode}: imports actual GH data and continues like the direct GH trace`, () => {
            const input = clone(reference[mode]);
            const before = clone(input);
            const a = Aggregation.fromData(input);
            numeric(placementState(a.toData()), placementState(reference.full));
            expect(a.placePartAtConnection(2, 0, 'B', 1).success).toBe(true);
            numeric(placementState(a.toData()), placementState(reference.continued));
            invariants(a);
            expect(input).toEqual(before);
        });
        it(`${mode}: JS roundtrip retains pruned free connections, graph and additional metadata`, () => {
            const raw = fresh().toData(mode === 'full');
            raw.metadata = { custom: { values: [1, false] } };
            raw.aggregated_parts[0].active_connections = [];
            raw.graph[0][1].label = 'retained';
            const a = Aggregation.fromData(raw);
            expect(a.aggregated_parts[0].active_connections).toEqual([]);
            expect(a.toData().metadata).toEqual(raw.metadata);
            expect(a.graph.toData()[0][1].label).toBe('retained');
            raw.metadata.custom.values[0] = 9;
            expect(a.toData().metadata.custom.values[0]).toBe(1);
        });
    }
    for (const graph of [undefined, {}]) {
        it(`reconstructs legacy ${graph === undefined ? 'missing' : 'empty'} graph from parenting`, () => {
            const raw = fresh().toData();
            raw.graph = graph;
            expect(Aggregation.fromData(raw).graph.toData()).toEqual(reference.full.graph);
        });
    }
    it('exports directly supplied previous parts without mutating the legacy live graph', () => {
        const a = fresh();
        a.graph = new Graph();
        expect(a.toData().graph).toEqual(reference.full.graph);
        expect(a.graph.toData()).toEqual({});
    });
    it('characterizes GH reader/reset defects while keeping JS occupancy and correct rules', () => {
        expect(reference.native_imports.full.aggregated_parts[0].active_connections).toEqual([0, 1]);
        expect(reference.native_imports.full.rules[0].part2).toBe('A');
        const a = Aggregation.fromData(reference.full);
        expect(a.aggregated_parts[0].active_connections).toEqual([1]);
        expect(a.rules[0].partB).toBe('B');
        expect(reference.trimmed.aggregated_parts[1].children).toEqual([2]);
    });
    it('removes a leaf without stale graph edges/children or reopening other used connections', () => {
        const a = fresh();
        a.removePartFromAggregation(2);
        expect(a.aggregated_parts.map(p => p.id)).toEqual([0, 1]);
        expect(a.graph.toData()).toEqual(reference.trimmed.graph);
        expect(a.aggregated_parts[0].active_connections).toEqual([1]);
        expect(a.aggregated_parts[1].children).toEqual([]);
        expect(a.aggregated_parts[1].active_connections).toEqual([0]);
        expect(a.removePartFromAggregation(2)).toBe(false);
        expect(a.placePartAtConnection(1, 0, 'B', 1).part.id).toBe(3);
        invariants(a);
    });
    it('removes a dependent subtree and preserves a separate branch', () => {
        const a = fresh();
        const retainedList = a.getParts();
        expect(a.placePartAtConnection(0, 1, 'B', 0).success).toBe(true);
        expect(a.removePartFromAggregation(1)).toBe(true);
        expect(a.aggregated_parts.map(p => p.id)).toEqual([0, 3]);
        expect(a.getParts()).toBe(retainedList);
        expect(a.removed_parts.map(p => p.id)).toEqual([1, 2]);
        expect(a.aggregated_parts[0].children).toEqual([3]);
        expect(a.aggregated_parts[0].active_connections).toEqual([0]);
        invariants(a);
        const loaded = Aggregation.fromData(a.toData(false));
        expect(loaded.placePartAtConnection(0, 0, 'B', 1).part.id).toBe(4);
        invariants(loaded);
    });
    it('removes a root and all descendants while retaining monotonic IDs in memory', () => {
        const a = fresh();
        a.removePartFromAggregation(0);
        expect(a.graph.toData()).toEqual({});
        expect(a.aggregated_parts).toEqual([]);
        expect(a.placeFirstPart('A').part.id).toBe(3);
        invariants(a);
    });
    it('does not alias exported parenting or occupancy arrays', () => {
        const a = fresh();
        const out = a.toData();
        out.aggregated_parts[0].children.push(99);
        out.aggregated_parts[0].active_connections.push(0);
        expect(a.aggregated_parts[0].children).toEqual([1]);
        expect(a.aggregated_parts[0].active_connections).toEqual([1]);
    });
    it('normalizes only complete integer strings and retains sparse/string IDs and sequence', () => {
        const raw = fresh().toData();
        const ids = ['42-root', 10, 70];
        const mapped = id => id === null ? null : ids[id];
        const entries = Object.values(raw.aggregated_parts).map(p => ({ ...p, id: mapped(p.id),
            parent: mapped(p.parent), children: p.children.map(mapped) }));
        raw.aggregated_parts = Object.fromEntries(entries.map(p => [p.id, p]));
        raw.aggregated_parts_sequence = ids;
        raw.graph = {};
        const a = Aggregation.fromData(raw);
        expect(a.aggregated_parts.map(p => p.id)).toEqual(ids);
        expect(a.toData().aggregated_parts_sequence).toEqual(ids);
        expect(a.placePartAtConnection(70, 0, 'B', 1).part.id).toBe(71);
        invariants(a);
    });
    it('retains object-property names as IDs through core and compact exports', () => {
        const raw = fresh(1).toData();
        raw.aggregated_parts[0].id = '__proto__';
        raw.aggregated_parts = Object.fromEntries([['__proto__', raw.aggregated_parts[0]]]);
        raw.aggregated_parts_sequence = ['__proto__'];
        raw.graph = {};
        const a = Aggregation.fromData(raw);
        expect(Object.keys(a.toData().aggregated_parts)).toEqual(['__proto__']);
        expect(Aggregation.fromData(JSON.parse(JSON.stringify(a.toData()))).aggregated_parts[0].id).toBe('__proto__');
        expect(loadAggregation(a.toFileData(), bases(), rules()).aggregated_parts[0].id).toBe('__proto__');
    });
    const invalid = {
        missing_sequence_entry: d => d.aggregated_parts_sequence.push(999),
        duplicate_sequence: d => { d.aggregated_parts_sequence = [0, 0, 2]; },
        duplicate_id: d => { d.aggregated_parts[1].id = 0; },
        missing_base: d => { delete d.aggregated_parts[1].geometry; d.aggregated_parts[1].name = 'Missing'; },
        unknown_parent: d => { d.aggregated_parts[1].parent = 99; },
        stale_child: d => { d.aggregated_parts[0].children.push(99); },
        bad_connection: d => { d.aggregated_parts[1].conn_on_parent = 99; },
        missing_graph_node: d => { delete d.graph[2]; },
        unknown_graph_node: d => { d.graph[99] = {}; },
        bad_graph_edge: d => { d.graph[0][1].conn_start = 99; },
        duplicate_active: d => { d.aggregated_parts[0].active_connections = [1, 1]; },
        invalid_active: d => { d.aggregated_parts[0].active_connections = [99]; },
        unsupported_mode: d => { d.mode = 2; },
        unsupported_field: d => { d.field = [{ name: 'field' }]; },
        unsupported_constraints: d => { d.global_constraints = [{ type: 'plane' }]; },
        invalid_catalog: d => { d.catalog = {}; },
        invalid_graph: d => { d.graph = []; },
        invalid_constraint_shape: d => { d.global_constraints = {}; },
    };
    for (const [name, mutate] of Object.entries(invalid)) {
        it(`rejects ${name} instead of silently discarding state`, () => {
            const raw = fresh().toData();
            mutate(raw);
            expect(() => Aggregation.fromData(raw)).toThrow();
        });
    }
    it('honors explicit sequence for legacy array input', () => {
        const raw = fresh().toData();
        raw.aggregated_parts = Object.values(raw.aggregated_parts).reverse();
        expect(Aggregation.fromData(raw).aggregated_parts.map(p => p.id)).toEqual([0, 1, 2]);
    });
    it('rejects a cyclic hierarchy even when all graph edges and reciprocal links exist', () => {
        const raw = fresh(2).toData();
        raw.aggregated_parts[0].parent = 1;
        raw.aggregated_parts[0].conn_on_parent = 0;
        raw.aggregated_parts[0].conn_to_parent = 1;
        raw.aggregated_parts[1].children = [0];
        raw.graph[1][0] = { start: 1, end: 0, conn_start: 0, conn_end: 1 };
        expect(() => Aggregation.fromData(raw)).toThrow(/Cyclic/);
    });
    it('preserves and actually obeys coll_check=false in manual and random placement', () => {
        const raw = fresh(1).toData();
        raw.coll_check = false;
        const a = Aggregation.fromData(raw);
        expect(a.placePartAtConnection(0, 0, 'C', 1).success).toBe(true);
        expect(a.toData().coll_check).toBe(false);
        const b = Aggregation.fromData(raw);
        b.rules = [new Rule('A', 0, 'C', 1)];
        b.aggregated_parts[0].resetPart(b.rules);
        b.aggregated_parts[0].active_connections = [0];
        expect(b.addPartToAggregation()).toBe(true);
        expect(b.graph.getEdges()).toEqual([[0, 1]]);
    });
    it('records nodes and edges through random growth without changing the PRNG', () => {
        const a = fresh(1);
        a.aggregated_parts[0].active_connections = [0];
        a.aggregated_parts[0].connections[0].active_rules = [0];
        expect(a.addPartToAggregation()).toBe(true);
        invariants(a);
        const empty = new Aggregation('empty', [], [], 42);
        expect(empty.addPartToAggregation()).toBe(false);
        expect(empty.graph.toData()).toEqual({});
    });
    it('keeps Mulberry32 seed mapping and restarts the seed on import, not its cursor', () => {
        const a = fresh();
        const baseline = new Aggregation('seed', [], [], 42);
        expect(Array.from({ length: 4 }, () => baseline.randomFn())).toEqual([
            0.6011037519201636, 0.44829055899754167, 0.8524657934904099, 0.6697340414393693,
        ]);
        const first = a.randomFn();
        a.randomFn();
        const loaded = Aggregation.fromData(a.toData());
        expect(loaded.randomFn()).toBe(first);
        expect(new Aggregation('seed', [], [], 42 + 2 ** 32).randomFn()).toBe(first);
        expect(a.randomFn()).not.toBe(loaded.randomFn());
    });
});

describe('compact Save/Load is a separate operation', () => {
    it('sorts negative and sparse numeric IDs as the GH compact loader does', () => {
        const raw = clone(reference.compact);
        const ids = [10, -1, 70];
        raw.parts = Object.fromEntries(Object.entries(raw.parts).map(([id, p]) => [ids[id], {
            ...p, parent: p.parent === null ? null : ids[p.parent], children: p.children.map(child => ids[child]),
        }]));
        const a = loadAggregation(raw, bases(), rules(), 42);
        expect(a.aggregated_parts.map(p => p.id)).toEqual([-1, 10, 70]);
        expect(a.placePartAtConnection(70, 0, 'B', 1).part.id).toBe(71);
        invariants(a);
    });
    it('matches the actual GH Save function and loads with external bases and rules', () => {
        const a = fresh();
        numeric(a.toFileData(), reference.compact);
        const raw = clone(reference.compact);
        const loaded = loadAggregation(raw, bases(), rules(), 42);
        numeric(placementState(loaded.toData()), placementState(reference.full));
        expect(raw).toEqual(reference.compact);
        expect(loaded.placePartAtConnection(2, 0, 'B', 1).success).toBe(true);
        numeric(placementState(loaded.toData()), placementState(reference.continued));
    });
    it('matches actual GH compact-load geometry and hierarchy, while adding recovered connection IDs', () => {
        const loaded = loadAggregation(reference.compact, bases(), rules(), 42);
        for (const [i, gh] of reference.compact_loaded.entries()) {
            const js = loaded.aggregated_parts[i].toData();
            for (const key of ['geometry', 'collider', 'transform', 'id', 'parent', 'children', 'active_connections']) {
                numeric(canonical(js[key]), canonical(gh[key]));
            }
            expect(gh.conn_on_parent).toBe(null);
        }
    });
    it('rejects implicit compact import without bases and ambiguous connection reconstruction', () => {
        expect(() => Aggregation.fromData(reference.compact)).toThrow(/loadAggregation/);
        expect(() => loadAggregation(reference.compact, [], rules())).toThrow(/base part/);
        const parts = bases();
        parts[0].connections.push(parts[0].connections[0].copy());
        expect(() => loadAggregation(reference.compact, parts, rules())).toThrow(/ambiguous/);
    });
    it('rejects constrained, reflected or scaled compact transforms explicitly', () => {
        const raw = clone(reference.compact);
        raw.parts[0].transform.M00 = -1;
        expect(() => loadAggregation(raw, bases(), rules())).toThrow(/rigid/);
        raw.parts[0].transform.M00 = 2;
        expect(() => loadAggregation(raw, bases(), rules())).toThrow(/rigid/);
        raw.parts[0].transform.M00 = 1;
        raw.parts[0].is_constrained = true;
        expect(() => loadAggregation(raw, bases(), rules())).toThrow(/Constrained/);
    });
});

if (process.env.WASP_STATE_OUTPUT) {
    const a = fresh();
    const full = a.toData();
    const light = a.toData(false);
    const continued = {};
    for (const [name, data] of [['full', full], ['light', light]]) {
        const loaded = Aggregation.fromData(data);
        loaded.placePartAtConnection(2, 0, 'B', 1);
        continued[name] = loaded.toData();
    }
    writeFileSync(process.env.WASP_STATE_OUTPUT, JSON.stringify({ full, light, continued, compact: a.toFileData() }, null, 2) + '\n');
}
