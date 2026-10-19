/**
 * WaspJS — mesh surface centroids measured against GH Part.center in Rhino.
 * Upstream: src/wasp/core/parts.py (AreaMassProperties.Compute mesh centroid).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Part } from '../core/part.js';
import { Collider } from '../core/collider.js';
import { meshFromData, meshToData, transformFromData } from '../core/utilities.js';
import corpus from './fixtures/gh-centroid-cases.json';
import reference from './fixtures/gh-centroid-reference.json';

const matrix = rows => transformFromData(Object.fromEntries(rows.flatMap(
    (row, r) => row.map((value, c) => [`M${r}${c}`, value])
)));
const rigid = matrix(corpus.rigid_transform);
const nonuniform = matrix(corpus.nonuniform_transform);
const makePart = (mesh, dim = 17) => new Part('centroid', mesh, [], new Collider([]), [], dim);
const center = (actual, expected) => actual.toArray().forEach((value, i) =>
    expect(value).toBeCloseTo(expected[i], 7));

describe('GH-Wasp Part surface centroid', () => {
    it('uses actually executed Rhino reference values', () => {
        expect(reference.provenance.kind).toBe('executed-gh-wasp-core-in-rhino');
        expect(reference.provenance.gh_commit).toBe('9bf05acd945e8581244a6ef3bf5a0733018c9b6d');
    });

    for (const spec of corpus.cases) {
        for (const indexed of [true, false]) {
            it(`${spec.id}: matches GH using ${indexed ? 'indexed' : 'non-indexed'} triangles`, () => {
                const mesh = meshFromData(spec.geometry);
                if (!indexed) mesh.geometry = mesh.geometry.toNonIndexed();
                const before = meshToData(mesh);
                const part = makePart(mesh);
                center(part.center, reference.cases[spec.id].center);
                expect(part.dim).toBe(17);
                expect(meshToData(mesh)).toEqual(before);
            });
        }

        it(`${spec.id}: preserves the source and matches GH through copy, rigid transform and light import`, () => {
            const part = makePart(meshFromData(spec.geometry));
            const before = part.center.toArray();
            const copy = part.copy();
            const placed = part.transform(rigid);
            const light = Part.fromData(placed.toData(false, false), part);
            center(copy.center, reference.cases[spec.id].copy);
            center(placed.center, reference.cases[spec.id].rigid);
            center(part.transformCenter(rigid), reference.cases[spec.id].transform_center);
            center(light.center, reference.cases[spec.id].rigid);
            expect(part.center.toArray()).toEqual(before);
            expect(copy.center).not.toBe(part.center);
        });
    }

    it('reweights differently oriented faces after nonuniform mesh scaling, excluding scene parents', () => {
        const spec = corpus.cases.find(item => item.id === 'different_face_planes');
        const mesh = meshFromData(spec.geometry);
        mesh.applyMatrix4(nonuniform);
        const parent = new THREE.Group();
        parent.position.set(100, 200, 300);
        parent.add(mesh);
        parent.updateMatrixWorld(true);
        const part = makePart(mesh);
        center(part.center, reference.cases[spec.id].nonuniform);
        center(makePart(meshFromData(spec.geometry)).transform(nonuniform).center,
            reference.cases[spec.id].nonuniform);
        const merelyTransformedCenter = new THREE.Vector3(...reference.cases[spec.id].center)
            .applyMatrix4(nonuniform);
        expect(part.center.distanceTo(merelyTransformedCenter)).toBeGreaterThan(1);
    });

    for (const spec of corpus.degenerate_cases) {
        it(`${spec.id}: matches Rhino's zero-area centroid at the origin`, () => {
            const part = makePart(meshFromData(spec.geometry));
            center(part.center, reference.cases[spec.id].center);
            center(part.transform(rigid).center, reference.cases[spec.id].rigid);
            expect(part.dim).toBe(17);
        });
    }

    it('ignores unused indexed vertices and zero-area faces without weighting by vertex count', () => {
        const mesh = meshFromData({
            vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [100, 100, 100]],
            faces: [[0, 1, 2], [0, 0, 0]],
        });
        center(makePart(mesh).center, [1 / 3, 1 / 3, 0]);
    });

    it('keeps existing explicit, default and derived dim behavior', () => {
        const mesh = meshFromData(corpus.cases[0].geometry);
        mesh.scale.set(2, 3, 4);
        mesh.geometry.computeBoundingSphere();
        const expectedRadius = mesh.geometry.boundingSphere.radius;
        expect(makePart(mesh, null).dim).toBe(expectedRadius * 4);
        expect(makePart(mesh, 123).dim).toBe(123);
        expect(new Part('default', mesh, [], new Collider([]), []).dim).toBe(1);
    });
});
