/**
 * WaspJS — right-handed connection frames measured against Rhino/GH-Wasp.
 * Reference: wasp-workspace/validation/WASP-010/README.md
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { Plane } from '../core/plane.js';
import { Connection } from '../core/connection.js';
import { Part } from '../core/part.js';
import { Collider } from '../core/collider.js';
import { Rule } from '../core/rule.js';
import { Aggregation } from '../core/aggregation.js';
import { PlaneToPlane, meshToData, transformFromData, transformToData } from '../core/utilities.js';
import corpus from './fixtures/gh-plane-cases.json';
import reference from './fixtures/gh-plane-reference.json';
import legacy from './fixtures/gh-plane-legacy.json';
import minimalPart from './fixtures/minimal-part.json';

const clone = value => globalThis.structuredClone(value);
const vector = values => new THREE.Vector3().fromArray(values);
const frame = plane => plane.toData();
const determinant = plane => new THREE.Matrix4()
    .makeBasis(plane.xaxis, plane.yaxis, plane.zaxis).determinant();
const rigid = transformFromData(Object.fromEntries(corpus.rigid_transform.flatMap(
    (row, r) => row.map((value, c) => [`M${r}${c}`, value])
)));

function expectNumeric(actual, expected, epsilon = 1e-8) {
    if (typeof expected === 'number') {
        expect(Math.abs(actual - expected)).toBeLessThanOrEqual(epsilon);
    } else if (Array.isArray(expected)) {
        expect(actual).toHaveLength(expected.length);
        expected.forEach((value, index) => expectNumeric(actual[index], value, epsilon));
    } else if (expected && typeof expected === 'object') {
        expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
        Object.entries(expected).forEach(([key, value]) => expectNumeric(actual[key], value, epsilon));
    } else {
        expect(actual).toEqual(expected);
    }
}

function fromXZ(data) {
    return new Plane(vector(data.origin), vector(data.xaxis), vector(data.zaxis));
}

function makeFacePart(name, mode) {
    const connections = ['positive', 'negative'].map((key, id) => {
        const old = legacy.face_planes[key];
        const canonical = { ...clone(old), zaxis: old.zaxis.map(value => -value) };
        const plane = mode === 'xz' ? fromXZ(canonical)
            : Plane.fromData(mode === 'legacy' ? old : canonical);
        return new Connection(plane, 'any', name, id);
    });
    return new Part(name, new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1)), connections,
        new Collider([], false, false, [], []), [], 1, null, null);
}

const observations = { provenance: { kind: 'waspjs-plane-observation' }, planes: {}, placements: {} };
for (const spec of corpus.planes) {
    const conn = new Connection(Plane.fromData(spec), 'default', 'A', 0);
    observations.planes[spec.id] = {
        plane: frame(conn.pln), flip: frame(conn.flip_pln),
        copy: frame(conn.copy().pln), transformed: frame(conn.transform(rigid).pln),
    };
}
for (const spec of corpus.placements) {
    const sourceData = corpus.planes.find(item => item.id === spec.source);
    const targetData = corpus.planes.find(item => item.id === spec.target);
    const source = new Connection(Plane.fromData(sourceData), 'default', 'A', 0);
    const target = new Connection(Plane.fromData(targetData), 'default', 'B', 0);
    const transform = PlaneToPlane(source.flip_pln, target.pln);
    const raw = { ...clone(minimalPart), connections: [{
        plane: sourceData, type: 'default', part: 'A', id: 0,
    }] };
    observations.placements[spec.id] = {
        matrix: transformToData(transform), connection: frame(source.transform(transform).pln),
        geometry: meshToData(Part.fromData(raw).transform(transform).geo),
    };
}
if (process.env.WASP_PLANE_OUTPUT) {
    writeFileSync(process.env.WASP_PLANE_OUTPUT, `${JSON.stringify(observations, null, 2)}\n`);
}

describe('GH-Wasp connection plane convention', () => {
    it('uses executed Rhino reference results', () => {
        expect(reference.provenance.kind).toBe('executed-gh-wasp-core-in-rhino');
        expect(reference.provenance.gh_version).toBe('0.7.003');
        expect(reference.provenance.gh_commit).toBe('9bf05acd945e8581244a6ef3bf5a0733018c9b6d');
    });

    for (const spec of corpus.planes) {
        const expected = reference.planes[spec.id];
        it(`${spec.id}: imports GH X/Y as a right-handed plane`, () => {
            const plane = Plane.fromData(spec);
            expectNumeric(frame(plane), expected.plane);
            expect(determinant(plane)).toBeCloseTo(1, 10);
        });
        it(`${spec.id}: direct X/Z construction preserves the requested normal`, () => {
            expectNumeric(frame(fromXZ(expected.plane)), expected.plane);
        });
        it(`${spec.id}: imports consistent X/Y/Z and X/Z-only data`, () => {
            expectNumeric(frame(Plane.fromData(expected.plane)), expected.plane);
            const { origin, xaxis, zaxis } = expected.plane;
            expectNumeric(frame(Plane.fromData({ origin, xaxis, zaxis })), expected.plane);
        });
        it(`${spec.id}: normalizes an actual old XYZ export while preserving origin and X/Y`, () => {
            const input = clone(legacy.planes[spec.id]);
            const before = clone(input);
            const restored = Plane.fromData(input);
            expectNumeric(frame(restored), expected.plane);
            expect(input).toEqual(before);
            expectNumeric(frame(Plane.fromData(restored.toData())), expected.plane);
        });
        it(`${spec.id}: copies and flips the connection as GH does`, () => {
            const actual = observations.planes[spec.id];
            expectNumeric(actual.copy, expected.copy);
            expectNumeric(actual.flip, expected.flip);
            const connection = new Connection(Plane.fromData(spec), 'default', 'A', 0);
            const doubleFlip = new Connection(connection.flip_pln, 'default', 'A', 0).flip_pln;
            expectNumeric(frame(doubleFlip), expected.plane);
        });
        it(`${spec.id}: rigidly transforms the full frame without changing its source`, () => {
            const source = Plane.fromData(spec);
            const before = frame(source);
            expectNumeric(observations.planes[spec.id].transformed, expected.transformed);
            source.applyMatrix4onPlane(rigid);
            expect(frame(source)).toEqual(before);
        });
    }

    for (const spec of corpus.placements) {
        it(`${spec.id}: PlaneToPlane docking matches Rhino including placed geometry`, () => {
            const actual = observations.placements[spec.id];
            const expected = reference.placements[spec.id];
            expectNumeric(actual.matrix, expected.matrix);
            expectNumeric(actual.connection, expected.connection);
            // Rhino Mesh stores single-precision vertices; compare those at 1e-5.
            expectNumeric(actual.geometry, expected.geometry, 1e-5);
        });
    }

    for (const [parent, child] of [['xz', 'xz'], ['xy', 'xy'], ['legacy', 'legacy'],
        ['xz', 'xy'], ['legacy', 'xz']]) {
        it(`places the same box using ${parent} parent and ${child} child connections`, () => {
            const a = makeFacePart('A', parent);
            const b = makeFacePart('B', child);
            const aggregation = new Aggregation('mixed-planes', [a, b], [new Rule('A', 0, 'B', 1)], 42);
            aggregation.placeFirstPart('A');
            const placed = aggregation.placePartAtConnection(0, 0, 'B', 1);
            expect(placed.success).toBe(true);
            expectNumeric(placed.part.transformation.elements,
                new THREE.Matrix4().makeTranslation(2, 0, 0).elements);
            const parentConnection = aggregation.aggregated_parts[0].connections[0].pln;
            const childConnection = placed.part.connections[1].pln;
            expectNumeric(childConnection.origin.toArray(), parentConnection.origin.toArray());
            expect(childConnection.zaxis.dot(parentConnection.zaxis)).toBeCloseTo(-1, 10);
        });
    }

    it('keeps connection frames independent of camera Y-up or Z-up', () => {
        for (const up of [[0, 1, 0], [0, 0, 1]]) {
            const camera = new THREE.PerspectiveCamera();
            camera.up.fromArray(up);
            camera.position.set(5, 6, 7);
            camera.lookAt(0, 0, 0);
            expectNumeric(frame(Plane.fromData(corpus.planes[0])), reference.planes.world_xy.plane);
        }
    });

    it('rejects a third axis unrelated to the X/Y normal instead of choosing a hidden rotation', () => {
        expect(() => Plane.fromData({ ...corpus.planes[0], zaxis: [1, 0, 0] })).toThrow(/zaxis/i);
    });
    it('rejects degenerate and non-finite axes', () => {
        expect(() => Plane.fromData({ ...corpus.planes[0], yaxis: [2, 0, 0] })).toThrow();
        expect(() => fromXZ({ ...reference.planes.world_xy.plane, zaxis: [0, 0, 0] })).toThrow();
        expect(() => Plane.fromData({ ...corpus.planes[0], xaxis: [NaN, 0, 0] })).toThrow();
    });
});
