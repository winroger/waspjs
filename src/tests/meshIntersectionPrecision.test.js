/** WaspJS — invented regressions for rotation-sensitive triangle separation. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { checkMeshesIntersection, meshToData } from '../index.js';

// The main triangles lie in different planes that meet at z=0. The first
// triangle reaches that line only at the origin; the second reaches it at
// x=y between 7.1 and 14. They are disjoint. Distant auxiliary triangles make
// the mesh bounds overlap, so the triangle predicate must decide correctly.
const first = [[4, 10, -12.6], [-3, 3, -12.6], [0, 0, 0],
    [100, 100, 10], [101, 100, 11], [100, 101, 10]];
const second = [[9, 5, 13], [14, 14, 0], [7.1, 7.1, 0],
    [-100, -100, -10], [-101, -100, -11], [-100, -101, -10]];
const offset = [2494.54528093338, 5344.425363000482, 596.4084318839014];
function triangleMesh(points, transform) {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry()
        .setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3)));
    mesh.applyMatrix4(transform);
    return mesh;
}
const poses = [
    new THREE.Matrix4(),
    new THREE.Matrix4().makeTranslation(...offset),
    new THREE.Matrix4().makeTranslation(3000, 4500, 1000)
        .multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 4)),
    new THREE.Matrix4().makeTranslation(-2000, 1500, -500)
        .multiply(new THREE.Matrix4().makeRotationX(0.37))
        .multiply(new THREE.Matrix4().makeRotationZ(0.61)),
];

describe('mesh intersection precision', () => {
    it.each(poses.map((pose, index) => [index, pose]))(
        'rejects disjoint triangle-plane tangent intervals at pose %i in both orders', (_index, pose) => {
            const a = triangleMesh(first, pose), b = triangleMesh(second, pose);
            const before = [meshToData(a), meshToData(b)];
            for (let repeat = 0; repeat < 3; repeat++) {
                expect(checkMeshesIntersection(a, b)).toBe(false);
                expect(checkMeshesIntersection(b, a)).toBe(false);
            }
            expect([meshToData(a), meshToData(b)]).toEqual(before);
            expect(a.geometry.boundsTree).toBeUndefined();
            expect(b.geometry.boundsTree).toBeUndefined();
        });
    it.each(poses.map((pose, index) => [index, pose]))(
        'distinguishes a real thin overlap from a gap after rigid pose %i', (_index, pose) => {
            const a = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
            a.applyMatrix4(pose);
            for (const [gap, expected] of [[0.02, false], [-0.002, true]]) {
                const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
                b.applyMatrix4(pose.clone().multiply(new THREE.Matrix4().makeTranslation(1 + gap, 0, 0)));
                expect(checkMeshesIntersection(a, b)).toBe(expected);
                expect(checkMeshesIntersection(b, a)).toBe(expected);
            }
        });
    it('keeps a noncoplanar crossing only one millionth of a unit deep', () => {
        const a = triangleMesh([[0, 0, 0], [1, 0, 0], [0, 1, 0]], new THREE.Matrix4());
        const b = triangleMesh([[0.25, 0.25, -1e-6], [0.75, 0.25, 1e-6], [0.25, 0.75, 1e-6]], new THREE.Matrix4());
        expect(checkMeshesIntersection(a, b)).toBe(true);
        expect(checkMeshesIntersection(b, a)).toBe(true);
    });
});
