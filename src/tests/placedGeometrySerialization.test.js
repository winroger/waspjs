import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import minimalPart from './fixtures/minimal-part.json';
import { Part } from '../core/part.js';
import { Aggregation } from '../core/aggregation.js';
import { meshFromData, meshToData, transformToData } from '../core/utilities.js';

// Snapshot of wasp-spec/examples/part.json: the Python wire-format triangle.
// Keep the fixture local so the suite also runs without sibling repositories.
const expectedVertices = [[10, 20, 30], [10, 21, 30], [9, 20, 30]];
const attributes = [{
  class_type: 'Attribute',
  name: 'test.metadata',
  values: [{ type: 'Dictionary', value: { label: 'triangle' }, valid: true }],
  transformable: false,
}];

function placementTransform() {
  return new THREE.Matrix4().set(
    0, -1, 0, 10,
    1, 0, 0, 20,
    0, 0, 1, 30,
    0, 0, 0, 1
  );
}

function makePlacedAggregation() {
  const input = globalThis.structuredClone(minimalPart);
  input.attributes = globalThis.structuredClone(attributes);
  const base = Part.fromData(input);
  const placed = base.transform(placementTransform());
  placed.assignId(0);
  const aggregation = new Aggregation('placed-triangle', [base], [], 42);
  aggregation.aggregated_parts = [placed];
  return { input, base, placed, aggregation };
}

function expectVertices(actual, expected = expectedVertices) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((vertex, i) => {
    vertex.forEach((value, axis) => expect(value).toBeCloseTo(expected[i][axis], 6));
  });
}

function expectPlacedData(data) {
  expectVertices(data.geometry.vertices);
  expectVertices(data.collider.geometry[0].vertices);
  expect(data.geometry.faces).toEqual(minimalPart.geometry.faces);
  expect(data.collider.geometry[0].faces).toEqual(minimalPart.geometry.faces);
  expect(data.connections[0]).toMatchObject({
    id: 0, part: 'A', type: 'default',
    plane: { origin: [10, 20, 30], xaxis: [0, 1, 0], yaxis: [-1, 0, 0] },
  });
  expect(data.attributes).toEqual(attributes);
  expect(data.transform).toEqual(transformToData(placementTransform()));
}

function meshState(mesh) {
  return {
    positions: Array.from(mesh.geometry.getAttribute('position').array),
    matrix: mesh.matrix.toArray(),
    matrixWorld: mesh.matrixWorld.toArray(),
    position: mesh.position.toArray(),
    quaternion: mesh.quaternion.toArray(),
    scale: mesh.scale.toArray(),
    matrixWorldNeedsUpdate: mesh.matrixWorldNeedsUpdate,
  };
}

function worldVertices(mesh) {
  mesh.updateMatrixWorld(true);
  const positions = mesh.geometry.getAttribute('position');
  return Array.from({ length: positions.count }, (_, i) => (
    new THREE.Vector3().fromBufferAttribute(positions, i)
      .applyMatrix4(mesh.matrixWorld).toArray()
  ));
}

describe('placed geometry serialization', () => {
  it('exports placed Part and Collider coordinates without mutating shared geometry or runtime state', () => {
    const { input, base, placed } = makePlacedAggregation();
    const beforeInput = globalThis.structuredClone(input);
    const meshes = [base.geo, ...base.collider.geometry, placed.geo, ...placed.collider.geometry];
    const beforeMeshes = meshes.map(meshState);

    const data = placed.toData();
    expectPlacedData(data);
    expect(placed.toData()).toEqual(data);
    expect(meshes.map(meshState)).toEqual(beforeMeshes);
    expect(input).toEqual(beforeInput);
    expectVertices(base.toData().geometry.vertices, minimalPart.geometry.vertices);
    expectVertices(base.toData().collider.geometry[0].vertices, minimalPart.geometry.vertices);
  });

  it.each([true, false])('preserves placed world coordinates through aggregation export with geometry=%s', includeGeometry => {
    const { aggregation } = makePlacedAggregation();
    const data = aggregation.toData(includeGeometry);
    const before = globalThis.structuredClone(data);
    if (includeGeometry) {
      expectPlacedData(data.aggregated_parts['0']);
    } else {
      expect(data.aggregated_parts['0'].geometry).toBeUndefined();
      expect(data.aggregated_parts['0'].collider).toBeUndefined();
    }

    const restored = Aggregation.fromData(data);
    const part = restored.aggregated_parts[0];
    expectVertices(worldVertices(part.geo));
    expectVertices(worldVertices(part.collider.geometry[0]));
    expectPlacedData(restored.toData().aggregated_parts['0']);
    expect(restored.toData(false)).toEqual(aggregation.toData(false));
    expect(data).toEqual(before);
  });

  it('preserves placement from lightweight import through full export and a second import', () => {
    const { aggregation } = makePlacedAggregation();
    const lightweight = aggregation.toData(false);
    const full = Aggregation.fromData(lightweight).toData();
    expectPlacedData(full.aggregated_parts['0']);

    const restored = Aggregation.fromData(full);
    expectVertices(worldVertices(restored.aggregated_parts[0].geo));
    expectVertices(worldVertices(restored.aggregated_parts[0].collider.geometry[0]));
    expect(restored.toData()).toEqual(full);
    expect(restored.toData()).toEqual(full);
    expect(restored.toData(false)).toEqual(lightweight);
  });

  it('does not apply the Part transform again to already placed Python-style inline geometry', () => {
    const inline = globalThis.structuredClone(minimalPart);
    inline.id = 0;
    inline.transform = transformToData(placementTransform());
    inline.geometry.vertices = globalThis.structuredClone(expectedVertices);
    inline.collider.geometry[0].vertices = globalThis.structuredClone(expectedVertices);
    inline.connections[0].plane = {
      origin: [10, 20, 30], xaxis: [0, 1, 0], yaxis: [-1, 0, 0],
    };
    inline.attributes = globalThis.structuredClone(attributes);
    const before = globalThis.structuredClone(inline);

    const part = Part.fromData(inline);
    expectPlacedData(part.toData());
    expectPlacedData(Part.fromData(part.toData()).toData());
    expect(inline).toEqual(before);
  });
});

describe('mesh export transform sources', () => {
  it.each([true, false])('uses pending local TRS without viewer-parent transforms (indexed=%s)', indexed => {
    const mesh = meshFromData(minimalPart.geometry);
    if (!indexed) mesh.geometry = mesh.geometry.toNonIndexed();
    mesh.position.set(10, 20, 30);
    mesh.rotation.z = Math.PI / 2;
    const parent = new THREE.Group();
    parent.position.set(1000, 2000, 3000);
    parent.add(mesh);
    const before = meshState(mesh);

    expectVertices(meshToData(mesh).vertices);
    expect(meshToData(mesh).faces).toEqual([[0, 1, 2]]);
    expect(meshState(mesh)).toEqual(before);
  });

  it('honors an explicit matrix when automatic matrix updates are disabled', () => {
    const mesh = meshFromData(minimalPart.geometry);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(placementTransform());
    mesh.position.set(1000, 2000, 3000);
    const before = meshState(mesh);

    expectVertices(meshToData(mesh).vertices);
    expect(meshState(mesh)).toEqual(before);
  });

  it('also transforms legacy vertices without changing their quad topology or source vertices', () => {
    const mesh = new THREE.Mesh();
    mesh.geometry = {
      vertices: [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(1, 1, 0), new THREE.Vector3(0, 1, 0)],
      faces: [{ a: 0, b: 1, c: 2, d: 3 }],
    };
    mesh.applyMatrix4(placementTransform());
    const before = mesh.geometry.vertices.map(vertex => vertex.toArray());
    const data = meshToData(mesh);

    expectVertices(data.vertices, [[10, 20, 30], [10, 21, 30], [9, 21, 30], [9, 20, 30]]);
    expect(data.faces).toEqual([[0, 1, 2, 3]]);
    expect(mesh.geometry.vertices.map(vertex => vertex.toArray())).toEqual(before);
  });
});
