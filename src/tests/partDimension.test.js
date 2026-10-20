/**
 * WaspJS — automatic primary-collider radius and graph candidate bounds.
 * Upstream: src/wasp/core/parts.py::Part.__init__, core/graph.py::from_aggregation.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Part, AdvancedPart, Collider, Connection, Plane, Graph } from '../index.js';
import { meshFromData } from '../core/utilities.js';
import corpus from './fixtures/gh-line-dimension-cases.json';
import reference from './fixtures/gh-dimension-reference.json';

const pose = new THREE.Matrix4().set(0, -1, 0, 10, 1, 0, 0, 20, 0, 0, 1, 30, 0, 0, 0, 1);
function create(spec, indexed = true, placed = false) {
    const mesh = data => {
        const m = meshFromData(data);
        if (!indexed) m.geometry = m.geometry.toNonIndexed();
        if (placed) m.applyMatrix4(pose);
        return m;
    };
    const body = new Collider(spec.colliders.map(mesh), spec.multiple ?? false);
    const args = [spec.id, mesh(spec.display), [], body, []];
    if (spec.advanced) args.push(new Collider(spec.additional.map(mesh)), []);
    if (Object.hasOwn(spec, 'dim')) args.push(spec.dim);
    return new (spec.advanced ? AdvancedPart : Part)(...args);
}
function numeric(p, expected) {
    p.center.toArray().forEach((v, i) => expect(v).toBeCloseTo(expected.center[i], 6));
    expect(p.dim).toBeCloseTo(expected.dim, 6);
}
function graphParts(dim) {
    const g = corpus.graph;
    return [0, 1].map(id => {
        const display = meshFromData(g.display), body = meshFromData(g.collider);
        display.position.x = id * g.separation; body.position.x = id * g.separation;
        const conn = new Connection(new Plane(new THREE.Vector3(...g.connection), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)), 'x', 'P', 0);
        return new Part('P', display, [conn], new Collider([body]), [], dim, id);
    });
}

describe('GH automatic primary-collider Part dimension', () => {
    it('uses an actual pinned native execution', () => {
        expect(reference.provenance.kind).toBe('executed-gh-wasp-core-in-rhino');
        expect(reference.provenance.source_files_verified).toBe(15);
        expect(reference.provenance.gh_commit).toBe('9bf05acd945e8581244a6ef3bf5a0733018c9b6d');
    });
    for (const spec of corpus.dimension_cases.filter(s => s.id !== 'empty_collider')) {
        for (const indexed of [true, false]) {
            // Converting to a triangle soup intentionally drops unreferenced vertices.
            if (!indexed && spec.raw_mesh) continue;
            for (const placed of [false, true]) {
                it(`${spec.id}, indexed=${indexed}, placed=${placed}: matches native dim and centroid`, () => {
                    numeric(create(spec, indexed, placed), placed ? reference.cases[spec.id].posed : reference.cases[spec.id]);
                });
            }
        }
    }
    it('retains a documented finite display-radius fallback for no primary vertices', () => {
        const spec = corpus.dimension_cases.find(s => s.id === 'empty_collider');
        expect(reference.cases.empty_collider.dim).toBeNull();
        expect(create(spec).dim).toBeCloseTo(Math.sqrt(3.25), 8);
        expect(new Part('no-collider', meshFromData(spec.display), [], null, []).dim).toBeCloseTo(Math.sqrt(3.25), 8);
    });
    for (const dim of [0, 23]) {
        for (const advanced of [false, true]) {
            it(`preserves explicit ${dim}, advanced=${advanced}, through copy/transform and full/light`, () => {
                const spec = { ...corpus.dimension_cases.find(s => s.id === (advanced ? 'advanced' : 'default')), dim };
                const p = create(spec), t = p.transform(pose);
                expect(p.copy().dim).toBe(dim); expect(t.dim).toBe(dim);
                const type = advanced ? AdvancedPart : Part;
                expect(type.fromData(t.toData()).dim).toBe(dim);
                expect(type.fromData(t.toData(false), p).dim).toBe(dim);
            });
        }
    }
    it('does not change caller matrices, vertices, indices or geometry bounds', () => {
        const display = meshFromData(corpus.graph.display), body = meshFromData(corpus.graph.collider);
        display.position.set(10, 20, 30); body.position.copy(display.position);
        const matrices = [display.matrix.clone(), body.matrix.clone()];
        const position = body.geometry.getAttribute('position'), index = body.geometry.index;
        const before = Array.from(position.array), indices = Array.from(index.array);
        const p = new Part('ownership', display, [], new Collider([body]), []);
        expect(p.dim).toBeCloseTo(Math.sqrt(37), 7);
        expect(display.matrix).toEqual(matrices[0]); expect(body.matrix).toEqual(matrices[1]);
        expect(body.geometry.getAttribute('position')).toBe(position); expect(body.geometry.index).toBe(index);
        expect(Array.from(position.array)).toEqual(before); expect(Array.from(index.array)).toEqual(indices);
        expect(display.geometry.boundingBox).toBeNull(); expect(display.geometry.boundingSphere).toBeNull();
    });
    it('uses manual mesh matrices without including scene-parent presentation', () => {
        const spec = corpus.dimension_cases.find(s => s.id === 'default');
        const display = meshFromData(spec.display), body = meshFromData(spec.colliders[0]);
        for (const m of [display, body]) { m.matrixAutoUpdate = false; m.matrix.copy(pose); }
        const scene = new THREE.Group(); scene.position.x = 100; scene.add(display, body);
        numeric(new Part('manual', display, [], new Collider([body]), []), reference.cases.default.posed);
    });
    it('rejects nonfinite automatic collider dimensions without recalculating explicit values', () => {
        const display = meshFromData(corpus.graph.display), body = meshFromData(corpus.graph.collider);
        body.geometry.getAttribute('position').setX(0, Infinity);
        const collider = new Collider([body]);
        expect(() => new Part('invalid-radius', display, [], collider, [])).toThrow(/nonfinite collider/);
        expect(new Part('explicit-radius', display, [], collider, [], 7).dim).toBe(7);
        display.geometry.getAttribute('position').setX(0, Infinity);
        expect(() => new Part('invalid-fallback', display, [], null, [])).toThrow(/nonfinite display/);
    });
});

describe('native graph counterexample for automatic dim', () => {
    it('finds the two directed edges previously lost by the default radius of 1', () => {
        const parts = graphParts(undefined);
        expect(Graph.fromAggregation({ aggregated_parts: parts, rules: [] }).toData()).toEqual(reference.graph);
        expect(Graph.fromAggregation({ aggregated_parts: graphParts(1), rules: [] }).toData()).toEqual(reference.explicit_small_graph);
    });
    it('also finds the edges with explicit null automatic dimensions', () => {
        expect(Graph.fromAggregation({ aggregated_parts: graphParts(null), rules: [] }).toData()).toEqual(reference.graph);
    });
});
