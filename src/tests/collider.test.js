/** WaspJS — Collider comparisons against executed GH-Wasp and JS ownership contracts. */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { Collider, Connection, Part, Aggregation, Rule, checkMeshesIntersection, meshFromData, meshToData } from '../index.js';
import corpus from './fixtures/gh-collider-cases.json';
import reference from './fixtures/gh-collider-reference.json';

const clone = value => globalThis.structuredClone(value);
const matrix = rows => new THREE.Matrix4().set(...rows.flat());
function mesh(key, rows) {
    const result = meshFromData(corpus.meshes[key]);
    if (rows) result.applyMatrix4(matrix(rows));
    return result;
}
function collider(spec) {
    const connections = reference.transform_paths.source.connections;
    return new Collider(spec.own.map(key => mesh(key)), spec.multiple, spec.check_all,
        connections.slice(0, spec.connections).map(c => Connection.fromData(c)), [...spec.valid]);
}
const obstacles = spec => spec.obstacles.map(keys => ({ collider: new Collider(keys.map(k => mesh(k))) }));
function freshPlacement(spec) {
    const parts = reference.placements[spec.id].bases.map(data => Part.fromData(clone(data)));
    const agg = new Aggregation('collider-placement', parts, [new Rule('A', 0, 'B', 0)], 42);
    agg.coll_check = spec.coll_check;
    expect(agg.placeFirstPart('A').success).toBe(true);
    return agg;
}
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
function transport(c) {
    const data = c.toData();
    for (const conn of data.connections) delete conn.plane.zaxis;
    return data;
}

const observations = { pairs: {}, colliders: {}, placements: {}, part_exports: {}, transform_paths: {} };
describe('GH Collider surface reference', () => {
    it('uses a pinned executed Rhino reference and keeps unstable diagnostics explicit', () => {
        expect(reference.provenance.kind).toBe('executed-gh-wasp-core-in-rhino');
        expect(reference.provenance.gh_commit).toBe('9bf05acd945e8581244a6ef3bf5a0733018c9b6d');
        expect(corpus.pairs.filter(p => p.diagnostic_only)).toHaveLength(1);
    });
    for (const spec of corpus.pairs.filter(p => !p.diagnostic_only)) {
        it(`${spec.id}: surface checks match GH without changing the source`, () => {
            const a = mesh(spec.a, spec.matrixA); const b = mesh(spec.b, spec.matrixB);
            const before = [meshToData(a), meshToData(b)];
            const c = new Collider([a]); const parts = [{ collider: new Collider([b]) }];
            const actual = { with_parts: c.checkCollisionsWithParts(parts), by_id: c.checkCollisionsById(parts, [0]),
                utility: checkMeshesIntersection(a, b) };
            expect(actual.with_parts).toBe(reference.pairs[spec.id].with_parts);
            expect(actual.by_id).toBe(reference.pairs[spec.id].by_id);
            // GH-Wasp difference: the native tilted-coplanar query is asymmetric;
            // keep the JS surface predicate symmetric rather than copy that defect.
            expect(checkMeshesIntersection(b, a)).toBe(spec.reverse_difference
                ? reference.pairs[spec.id].with_parts : reference.pairs[spec.id].reverse);
            if (spec.reverse_difference) expect(reference.pairs[spec.id].reverse).toBe(true);
            expect(actual.utility).toBe(actual.with_parts);
            expect([meshToData(a), meshToData(b)]).toEqual(before);
            expect(a.geometry.boundsTree).toBeUndefined();
            observations.pairs[spec.id] = actual;
        });
    }
    it('records the precision-boundary difference without adopting query-history-dependent results', () => {
        const spec = corpus.pairs.find(p => p.diagnostic_only);
        const recorded = reference.pairs[spec.id];
        expect(new Set(recorded.repeated_counts).size).toBeGreaterThan(1);
        const a = mesh(spec.a, spec.matrixA); const b = mesh(spec.b, spec.matrixB);
        const results = Array.from({ length: 4 }, () => checkMeshesIntersection(a, b));
        expect(results).toEqual([false, false, false, false]);
        observations.pairs[spec.id] = { diagnostic_only: true, js_repeated: results, gh_repeated_counts: recorded.repeated_counts };
    });
});

describe('GH composite and alternative colliders', () => {
    for (const spec of corpus.colliders) {
        it(`${spec.id}: flags, selected obstacles and valid geometry indices match GH`, () => {
            const c = collider(spec); const parts = obstacles(spec);
            const withParts = c.checkCollisionsWithParts(parts); const valid = [...c.validConnections];
            const byId = collider(spec);
            const actual = { with_parts: withParts, valid_after_parts: valid,
                by_id: byId.checkCollisionsById(parts, spec.ids), valid_after_by_id: [...byId.validConnections],
                faces_count: c.facesCount, set_connections: c.setConnections };
            expect(actual).toEqual(reference.colliders[spec.id]);
            observations.colliders[spec.id] = actual;
        });
    }
    for (const path of Object.keys(reference.transform_paths)) {
        it(`${path}: copying/placement retains the GH collider payload and options`, () => {
            const source = Collider.fromData(clone(reference.transform_paths.source));
            const before = source.toData();
            const result = path === 'source' ? source : path === 'copied' ? source.copy()
                : source.transform(matrix(reference.transform_matrix), path.split('-')[1] === 'True', path.split('-')[2] === 'True');
            numeric(transport(result), reference.transform_paths[path]);
            expect(source.toData()).toEqual(before);
            observations.transform_paths[path] = result.toData();
        });
    }
});

describe('GH collider placement decisions', () => {
    for (const spec of corpus.placements) {
        it(`${spec.id}: query, manual and random placement use the same decision as GH`, () => {
            const expected = reference.placements[spec.id];
            const query = freshPlacement(spec);
            const before = query.parts.B.toData();
            const count = query.getValidPlacementsForPart('B').length;
            expect(count).toBe(expected.query_count);
            expect(query.parts.B.toData()).toEqual(before);
            expect(query.aggregated_parts).toHaveLength(1);
            const manual = freshPlacement(spec); const result = manual.placePartAtConnection(0, 0, 'B', 0);
            expect(result.success).toBe(!expected.blocked);
            expect(manual.graph.getEdges()).toHaveLength(result.success ? 1 : 0);
            const random = freshPlacement(spec); const placed = random.addPartToAggregation();
            expect(placed).toBe(expected.random_placed);
            expect(random.aggregated_parts).toHaveLength(placed ? 2 : 1);
            observations.placements[spec.id] = { query_count: count, manual_placed: result.success, random_placed: placed };
            if (result.success) observations.part_exports[spec.id] = { base: manual.parts.B.toData(),
                full: result.part.toData(), light: result.part.toData(false) };
        });
        for (const full of [true, false]) {
            it(`${spec.id} ${full ? 'full' : 'light'}: reconstructed colliders retain the placement decision`, () => {
                const a = freshPlacement(spec);
                const raw = a.toData(full); const restored = Aggregation.fromData(clone(raw));
                expect(restored.parts.B.collider.multiple).toBe(spec.multiple);
                expect(restored.placePartAtConnection(0, 0, 'B', 0).success).toBe(!reference.placements[spec.id].blocked);
                numeric(restored.parts.B.collider.toData(), a.parts.B.collider.toData());
            });
        }
    }
});

describe('JS collision host adapter contracts', () => {
    it('uses local placement and excludes scene-parent presentation transforms', () => {
        const a = mesh('unit'); const b = mesh('overlap');
        const parent = new THREE.Group(); parent.position.set(100, 200, 300); parent.add(a); parent.updateMatrixWorld(true);
        const before = a.matrixWorld.toArray();
        expect(checkMeshesIntersection(a, b)).toBe(true);
        expect(a.matrixWorld.toArray()).toEqual(before);
    });
    it('includes pending TRS and manual matrices without updating source matrices', () => {
        const a = mesh('unit'); const b = mesh('overlap');
        a.position.x = 100; const old = a.matrix.toArray();
        expect(checkMeshesIntersection(a, b)).toBe(false);
        expect(a.matrix.toArray()).toEqual(old);
        a.matrixAutoUpdate = false; a.matrix.identity();
        expect(checkMeshesIntersection(a, b)).toBe(true);
        a.matrix.makeTranslation(100, 0, 0);
        expect(checkMeshesIntersection(a, b)).toBe(false);
    });
    it('rebuilds after versioned position edits and does not mutate original indices or BVHs', () => {
        const a = mesh('unit'); const b = mesh('overlap');
        const before = Array.from(a.geometry.index.array); const sentinel = { owner: 'user' };
        a.geometry.boundsTree = sentinel;
        expect(checkMeshesIntersection(a, b)).toBe(true);
        a.geometry.translate(100, 0, 0);
        expect(checkMeshesIntersection(a, b)).toBe(false);
        expect(a.geometry.boundsTree).toBe(sentinel);
        expect(Array.from(a.geometry.index.array)).toEqual(before);
    });
    it('rebuilds after replacing geometry, position attributes and index attributes', () => {
        const a = mesh('unit'); const b = mesh('overlap');
        expect(checkMeshesIntersection(a, b)).toBe(true);
        const shifted = mesh('separated').geometry.getAttribute('position');
        a.geometry.setAttribute('position', shifted);
        expect(checkMeshesIntersection(a, b)).toBe(false);
        a.geometry = mesh('unit').geometry;
        expect(checkMeshesIntersection(a, b)).toBe(true);
        a.geometry.setIndex([]);
        expect(checkMeshesIntersection(a, b)).toBe(false);
    });
    it('invalidates an interleaved position cache when its shared buffer changes', () => {
        const a = mesh('unit'); const b = mesh('overlap');
        const data = new THREE.InterleavedBuffer(a.geometry.attributes.position.array.slice(), 3);
        const position = new THREE.InterleavedBufferAttribute(data, 3, 0);
        a.geometry.setAttribute('position', position);
        expect(checkMeshesIntersection(a, b)).toBe(true);
        for (let i = 0; i < position.count; i++) position.setX(i, position.getX(i) + 100);
        position.needsUpdate = true;
        expect(checkMeshesIntersection(a, b)).toBe(false);
    });
    it('handles nonindexed geometry and counts triangles without render-group filtering', () => {
        const a = mesh('unit'); const b = mesh('overlap');
        a.geometry = a.geometry.toNonIndexed(); a.geometry.setDrawRange(0, 0);
        expect(new Collider([a]).facesCount).toBe(12);
        expect(checkMeshesIntersection(a, b)).toBe(true);
        expect(a.geometry.index).toBeNull();
    });
    it('keeps the JS empty-simple-collider fallback without a percentage shrink', () => {
        const spec = corpus.placements.find(p => p.id === 'surface_overlap');
        const a = freshPlacement(spec);
        const candidate = a.parts.B.copy();
        candidate.collider = new Collider([]); candidate.geo = mesh('unit');
        expect(a._checkCollision(candidate)).toBe(true);
        candidate.geo = mesh('touch_face'); a.aggregated_parts[0].collider = new Collider([mesh('unit')]);
        expect(a._checkCollision(candidate)).toBe(false);
        // A real thin overlap remains a collision instead of being shrunk away.
        candidate.geo = mesh('penetrate_1e-06');
        expect(a._checkCollision(candidate)).toBe(true);
    });
    it('keeps the existing surface-only JS center contract and coll_check=false bypass', () => {
        const spec = corpus.placements.find(p => p.id === 'surface_overlap');
        const a = freshPlacement(spec); a.aggregated_parts[0].geo = mesh('unit');
        a.aggregated_parts[0].collider = new Collider([mesh('unit')]);
        const b = a.parts.B.copy(); b.geo = mesh('contained'); b.collider = new Collider([mesh('contained')]);
        a.aggregated_parts[0].center.set(0,0,0); b.center.set(0,0,0);
        expect(a._checkCollision(b)).toBe(false);
        b.collider = new Collider([mesh('overlap')]); a.coll_check = false;
        expect(a._checkCollision(b)).toBe(false);
    });
    it('does not use display-mesh radius to discard a distant explicit collider', () => {
        const spec = corpus.placements.find(p => p.id === 'surface_overlap');
        const a = freshPlacement(spec); a.parts.B.dim = 0.001; a.aggregated_parts[0].dim = 0.001;
        expect(a._checkCollision(a.parts.B)).toBe(true);
    });
    it('keeps source vertex/connection buffers independent after collider transformations', () => {
        const a = Collider.fromData(clone(reference.transform_paths.source));
        const b = a.transform(matrix(reference.transform_matrix), true, true);
        b.geometry[0].geometry.attributes.position.setX(0,999);
        b.connections[0].pln.origin.x = 999; b.validConnections.push(3);
        expect(a.geometry[0].geometry.attributes.position.getX(0)).toBe(-1);
        expect(a.connections[0].pln.origin.x).toBe(0);
        expect(a.validConnections).toEqual([1]);
    });
    it('exports actual JS observations for optional native GH reader checks', () => {
        if (process.env.WASP_COLLIDER_OUTPUT) writeFileSync(process.env.WASP_COLLIDER_OUTPUT, JSON.stringify(observations, null, 2) + '\n');
    });
});
