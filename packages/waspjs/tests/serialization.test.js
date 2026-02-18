import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { meshToData, meshFromData, transformToData, transformFromData } from '../src/core/utilities.js';
import { Rule } from '../src/core/rule.js';

function makeBoxMesh() {
  const geometry = new THREE.BoxGeometry(1, 2, 3);
  const material = new THREE.MeshStandardMaterial();
  return new THREE.Mesh(geometry, material);
}

describe('serialization', () => {
  it('round-trips BufferGeometry via meshToData/meshFromData', () => {
    const mesh = makeBoxMesh();
    const data = meshToData(mesh);
    const restored = meshFromData(data);

    const origPositions = mesh.geometry.getAttribute('position');
    const restoredPositions = restored.geometry.getAttribute('position');
    expect(restoredPositions.count).toBe(origPositions.count);

    const origIndex = mesh.geometry.getIndex();
    const restoredIndex = restored.geometry.getIndex();
    expect(restoredIndex.count).toBe(origIndex.count);
  });

  it('round-trips matrix via transformToData/transformFromData', () => {
    const m = new THREE.Matrix4().makeRotationX(Math.PI / 4).setPosition(1, 2, 3);
    const data = transformToData(m);
    const restored = transformFromData(data);
    expect(restored.elements).toEqual(m.elements);
  });

  it('Rule.fromData returns a Rule instance', () => {
    const raw = { part1: 'A', conn1: 0, part2: 'B', conn2: 1, active: true };
    const rule = Rule.fromData(raw);
    expect(rule).toBeInstanceOf(Rule);
    expect(rule.partA).toBe('A');
    expect(rule.connectionA).toBe(0);
    expect(rule.partB).toBe('B');
    expect(rule.connectionB).toBe(1);
    expect(rule.active).toBe(true);
  });
});
