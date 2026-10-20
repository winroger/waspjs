/**
 * WaspJS — finite Collider line queries against executed GH MeshLine cases.
 * Upstream: src/wasp/core/colliders.py::check_intersection_w_line.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Collider } from '../core/collider.js';
import * as api from '../index.js';
import corpus from './fixtures/gh-line-dimension-cases.json';
import reference from './fixtures/gh-line-reference.json';

const pose = new THREE.Matrix4().set(0, -1, 0, 10, 1, 0, 0, 20, 0, 0, 1, 30, 0, 0, 0, 1);
const line = spec => new THREE.Line3(new THREE.Vector3(...spec.start), new THREE.Vector3(...spec.end));
const collider = spec => Collider.fromData({ geometry: globalThis.structuredClone(spec.geometry), multiple: false, check_all: false, connections: [], valid_connections: [] });

describe('GH finite Collider line intersection', () => {
    it('uses actual native measurements of the pinned source', () => {
        expect(reference.provenance.kind).toBe('executed-gh-wasp-core-in-rhino');
        expect(reference.provenance.gh_commit).toBe('9bf05acd945e8581244a6ef3bf5a0733018c9b6d');
        expect(reference.provenance.source_files_verified).toBe(15);
    });
    for (const spec of corpus.line_cases) {
        for (const indexed of [true, false]) {
            for (const placed of [false, true]) {
                it(`${spec.id}, indexed=${indexed}, placed=${placed}: matches MeshLine`, () => {
                    const c = collider(spec), l = line(spec);
                    for (const m of c.geometry) {
                        expect(m.intersectsLine).toBeUndefined();
                        if (!indexed) m.geometry = m.geometry.toNonIndexed();
                        if (placed) m.applyMatrix4(pose);
                    }
                    if (placed) l.applyMatrix4(pose);
                    expect(c.checkIntersectionWithLine(l)).toBe(reference.cases[spec.id][placed ? 'posed_intersects' : 'intersects']);
                });
            }
        }
    }
    it('leaves source buffers, cache, mesh matrices and line endpoints untouched', () => {
        const c = collider(corpus.line_cases[0]), m = c.geometry[0], l = line(corpus.line_cases[0]);
        const position = m.geometry.getAttribute('position'), index = m.geometry.index;
        const positions = Array.from(position.array), indices = Array.from(index.array);
        const externalCache = {}; m.geometry.boundsTree = externalCache;
        const matrix = m.matrix.clone(), matrixWorld = m.matrixWorld.clone(), before = l.clone();
        const scene = new THREE.Group(); scene.position.set(100, 200, 300); scene.add(m);
        m.visible = false; m.geometry.setDrawRange(0, 0);
        expect(c.checkIntersectionWithLine(l)).toBe(true);
        expect(m.geometry.getAttribute('position')).toBe(position);
        expect(m.geometry.index).toBe(index);
        expect(Array.from(position.array)).toEqual(positions);
        expect(Array.from(index.array)).toEqual(indices);
        expect(m.geometry.boundsTree).toBe(externalCache);
        expect(m.matrix).toEqual(matrix); expect(m.matrixWorld).toEqual(matrixWorld);
        expect(l).toEqual(before);
    });
    it('honors local pose edits, manual matrices and marked buffer edits', () => {
        const c = collider(corpus.line_cases[0]), m = c.geometry[0], l = line(corpus.line_cases[0]);
        expect(c.checkIntersectionWithLine(l)).toBe(true);
        m.position.x = 20; expect(c.checkIntersectionWithLine(l)).toBe(false);
        m.matrixAutoUpdate = false; m.matrix.identity();
        expect(c.checkIntersectionWithLine(l)).toBe(true);
        const p = m.geometry.getAttribute('position');
        for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + 20);
        p.needsUpdate = true;
        expect(c.checkIntersectionWithLine(l)).toBe(false);
    });
    it('rejects malformed/nonfinite endpoints and accepts the documented endpoint shape', () => {
        const c = collider(corpus.line_cases[0]);
        expect(c.checkIntersectionWithLine({ start: { x: 0, y: 0, z: -1 }, end: { x: 0, y: 0, z: 1 } })).toBe(true);
        for (const value of [null, {}, { start: { x: NaN, y: 0, z: 0 }, end: new THREE.Vector3() },
            new THREE.Line3(new THREE.Vector3(Number.MAX_VALUE, 0, 0), new THREE.Vector3(-Number.MAX_VALUE, 0, 0))]) {
            expect(() => c.checkIntersectionWithLine(value)).toThrow(/finite.*start.*end/i);
        }
    });
    it('keeps the line adapter internal and leaves global constraints reserved', () => {
        expect(api).not.toHaveProperty('checkMeshLineIntersection');
        expect(collider(corpus.line_cases[0]).checkGlobalConstraints({})).toBe(false);
    });
});
