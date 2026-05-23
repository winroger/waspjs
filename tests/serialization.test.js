import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { meshToData, meshFromData, transformToData, transformFromData } from '../src/core/utilities.js';
import { Rule } from '../src/core/rule.js';
import { Part } from '../src/core/part.js';
import { Plane } from '../src/core/plane.js';
import { Connection } from '../src/core/connection.js';
import { Collider } from '../src/core/collider.js';

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

  it('preserves string ids when deserializing parts', () => {
    const plane = new Plane(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 1)
    );
    const connection = new Connection(plane, 'any', 'A', 0);
    const mesh = makeBoxMesh();
    const collider = new Collider([mesh.clone()], false, false, [], []);
    const part = new Part('A', mesh, [connection], collider, [], 1, 'root-node', null);
    part.children = ['child-node'];

    const restored = Part.fromData(part.toData());
    expect(restored.id).toBe('root-node');
    expect(restored.children).toEqual(['child-node']);
  });
});
