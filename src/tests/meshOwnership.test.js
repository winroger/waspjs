/**
 * WaspJS — geometry ownership across GH-style Part and Collider duplication.
 * Upstream: src/wasp/core/parts.py and colliders.py (Duplicate before Transform).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { Part } from '../core/part.js';
import { Collider } from '../core/collider.js';
import { Aggregation } from '../core/aggregation.js';
import { checkMeshesIntersection, meshToData, transformToData } from '../core/utilities.js';
import fixture from './fixtures/minimal-part.json';

const clone = value => globalThis.structuredClone(value);
const translation = () => new THREE.Matrix4().makeTranslation(10, 20, 30);
const makePart = () => Part.fromData({ ...clone(fixture), attributes: [{ label: { value: 'base' } }] });
const meshes = part => [part.geo, ...part.collider.geometry];
const vertices = mesh => meshToData(mesh).vertices;
const array = attribute => attribute.isInterleavedBufferAttribute ? attribute.data.array : attribute.array;

function expectSeparateGeometry(copy, source) {
    expect(copy).not.toBe(source);
    expect(copy.geometry).not.toBe(source.geometry);
    for (const key of Object.keys(source.geometry.attributes)) {
        const a = copy.geometry.getAttribute(key);
        const b = source.geometry.getAttribute(key);
        expect(array(a).buffer).not.toBe(array(b).buffer);
        expect(Array.from(array(a))).toEqual(Array.from(array(b)));
    }
    if (source.geometry.index) {
        expect(copy.geometry.index.array.buffer).not.toBe(source.geometry.index.array.buffer);
        expect(Array.from(copy.geometry.index.array)).toEqual(Array.from(source.geometry.index.array));
    }
}

function expectVertices(actual, expected) {
    expect(actual).toHaveLength(expected.length);
    expected.forEach((point, i) => point.forEach((value, axis) => {
        expect(actual[i][axis]).toBeCloseTo(value, 6);
    }));
}

const partPaths = {
    copy: source => source.copy(),
    transform: source => source.transform(translation()),
    light_import: source => {
        const data = source.toData(false, false);
        data.transform = transformToData(translation());
        data.connections = source.connections.map(conn => conn.transform(translation()).toData());
        return Part.fromData(data, source);
    },
};

describe('Part mesh ownership', () => {
    for (const [name, duplicate] of Object.entries(partPaths)) {
        it(`${name}: vertex, index and normal edits do not affect the source or another instance`, () => {
            const source = makePart();
            const before = clone(source.toData());
            const a = duplicate(source);
            const b = duplicate(source);
            const beforeB = clone(b.toData());
            meshes(source).forEach((original, i) => {
                const copied = meshes(a)[i];
                expectSeparateGeometry(copied, original);
                const sourceNormals = Array.from(original.geometry.getAttribute('normal').array);
                copied.geometry.getAttribute('position').setXYZ(0, 99, 98, 97);
                copied.geometry.getAttribute('normal').setXYZ(0, 0, 1, 0);
                copied.geometry.index.setX(0, 2);
                expect(Array.from(original.geometry.getAttribute('normal').array)).toEqual(sourceNormals);
            });
            expect(source.toData()).toEqual(before);
            expect(b.toData()).toEqual(beforeB);
            const beforeA = clone(a.toData());
            source.geo.geometry.getAttribute('position').setX(1, -123);
            source.collider.geometry[0].geometry.index.setX(0, 1);
            expect(a.toData()).toEqual(beforeA);
            expect(b.toData()).toEqual(beforeB);
        });

        it(`${name}: preserves placement, connection frames and independent attributes`, () => {
            const source = makePart();
            const before = clone(source.toData());
            const result = duplicate(source);
            const trans = name === 'copy' ? new THREE.Matrix4() : translation();
            meshes(source).forEach((mesh, i) => {
                expectVertices(vertices(meshes(result)[i]), vertices(mesh).map(point =>
                    new THREE.Vector3(...point).applyMatrix4(trans).toArray()));
            });
            expect(result.transformation.elements).toEqual(trans.elements);
            const expectedConnection = source.connections[0].transform(trans).toData();
            expect(result.connections[0].toData()).toEqual(expectedConnection);
            expect(result.attributes).toEqual(source.attributes);
            result.attributes[0].label.value = 'changed';
            expect(source.toData()).toEqual(before);
        });
    }

    it('retains local mesh placement and shared material objects', () => {
        const source = makePart();
        source.geo.position.set(10, 20, 30);
        source.geo.updateMatrix();
        source.geo.material = [source.geo.material, new THREE.MeshStandardMaterial()];
        const copy = source.copy();
        expect(copy.geo.position.toArray()).toEqual(source.geo.position.toArray());
        expect(copy.geo.matrix.elements).toEqual(source.geo.matrix.elements);
        expect(copy.toData()).toEqual(source.toData());
        expect(copy.geo.material).not.toBe(source.geo.material);
        expect(copy.geo.material[0]).toBe(source.geo.material[0]);
    });

    it('keeps the catalog and placed part buffers independent', () => {
        const source = makePart();
        const aggregation = new Aggregation('ownership', [source], [], 42);
        const before = clone(source.toData());
        const placed = aggregation.placeFirstPart('A');
        expect(placed.success).toBe(true);
        placed.part.geo.geometry.getAttribute('position').setX(0, 55);
        placed.part.collider.geometry[0].geometry.getAttribute('position').setX(0, 66);
        expect(source.toData()).toEqual(before);
    });

    it('isolates interleaved vertex data, UVs and morph attributes', () => {
        const source = makePart();
        const geometry = source.geo.geometry;
        const data = new THREE.InterleavedBuffer(new Float32Array([
            0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1,
        ]), 6);
        geometry.setAttribute('position', new THREE.InterleavedBufferAttribute(data, 3, 0));
        geometry.setAttribute('normal', new THREE.InterleavedBufferAttribute(data, 3, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
        geometry.morphAttributes.position = [new THREE.Float32BufferAttribute([0, 0, 1, 1, 0, 1, 0, 1, 1], 3)];
        const before = Array.from(data.array);
        const copy = source.copy();
        expectSeparateGeometry(copy.geo, source.geo);
        const copied = copy.geo.geometry;
        copied.getAttribute('position').setX(0, 10);
        copied.getAttribute('normal').setZ(0, -1);
        copied.getAttribute('uv').setX(0, 5);
        copied.morphAttributes.position[0].setZ(0, 2);
        expect(Array.from(data.array)).toEqual(before);
        expect(geometry.getAttribute('uv').getX(0)).toBe(0);
        expect(geometry.morphAttributes.position[0].getZ(0)).toBe(1);
    });

    it('rebuilds collision acceleration on the copy without sharing the source BVH', () => {
        const source = new Part('box', new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)), [], new Collider([]), []);
        const tree = new MeshBVH(source.geo.geometry);
        source.geo.geometry.boundsTree = tree;
        const copy = source.copy();
        expect(copy.geo.geometry.boundsTree).toBeUndefined();
        copy.geo.geometry.translate(10, 0, 0);
        const probe = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
        probe.position.x = 0.25;
        probe.updateMatrixWorld(true);
        expect(checkMeshesIntersection(copy.geo, probe)).toBe(false);
        expect(checkMeshesIntersection(source.geo, probe)).toBe(true);
        expect(source.geo.geometry.boundsTree).toBe(tree);
        expect(copy.geo.geometry.boundsTree).not.toBe(tree);
    });
});

describe('Collider mesh ownership', () => {
    for (const method of ['copy', 'transform']) {
        it(`${method}: isolates every collider mesh and retains connection flags`, () => {
            const source = makePart();
            const collider = new Collider([source.geo, ...source.collider.geometry], true, true,
                [source.connections[0], source.connections[0].copy()], [0, 1]);
            const before = clone(collider.toData());
            const trans = translation();
            const duplicate = () => method === 'copy' ? collider.copy() : collider.transform(trans, true, true);
            const a = duplicate();
            const b = duplicate();
            const beforeB = clone(b.toData());
            for (const [i, mesh] of a.geometry.entries()) {
                expectSeparateGeometry(mesh, collider.geometry[i]);
                mesh.geometry.getAttribute('position').setXYZ(0, 9, 8, 7);
                mesh.geometry.index.setX(0, 2);
            }
            expect(a.multiple).toBe(true);
            expect(a.checkAll).toBe(true);
            expect(a.setConnections).toBe(true);
            expect(a.validConnections).toEqual([0, 1]);
            const expectedConnections = collider.connections.map(c =>
                (method === 'copy' ? c : c.transform(trans)).toData());
            expect(a.connections.map(c => c.toData())).toEqual(expectedConnections);
            a.validConnections.push(2);
            a.connections[0].pln.origin.x = -99;
            expect(collider.toData()).toEqual(before);
            expect(b.toData()).toEqual(beforeB);
        });
    }
});
