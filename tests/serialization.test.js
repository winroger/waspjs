import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { meshToData, meshFromData, transformToData, transformFromData } from '../src/core/utilities.js';
import { Rule } from '../src/core/rule.js';
import { Part } from '../src/core/part.js';
import { Plane } from '../src/core/plane.js';
import { Connection } from '../src/core/connection.js';
import { Collider } from '../src/core/collider.js';
import { Aggregation } from '../src/core/aggregation.js';

function makeBoxMesh() {
  const geometry = new THREE.BoxGeometry(1, 2, 3);
  const material = new THREE.MeshStandardMaterial();
  return new THREE.Mesh(geometry, material);
}

function makeAggregationPart(name) {
  const geometry = new THREE.BoxGeometry(2, 1, 1);
  const material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(geometry, material);

  const plane0 = new Plane(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(1, 0, 0)
  );
  const plane1 = new Plane(
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(-1, 0, 0)
  );

  const conn0 = new Connection(plane0, 'any', name, 0);
  const conn1 = new Connection(plane1, 'any', name, 1);
  const collider = new Collider([], false, false, [], []);

  return new Part(name, mesh, [conn0, conn1], collider, [], 1, null, null);
}

function makeAggregation(partNames = ['A']) {
  const parts = partNames.map(name => makeAggregationPart(name));
  const rules = [];

  for (const part of parts) {
    for (const other of parts) {
      for (const conn of part.connections) {
        for (const otherConn of other.connections) {
          rules.push(new Rule(part.name, conn.id, other.name, otherConn.id));
        }
      }
    }
  }

  return new Aggregation('roundtrip', parts, rules, 42);
}

function placeChain(aggregation) {
  const firstPlacement = aggregation.placeFirstPart('A');
  expect(firstPlacement.success).toBe(true);

  const firstOpen = aggregation.getOpenConnections().find(conn => conn.connectionId === 0);
  const firstRule = firstOpen.rules.find(rule => rule.partB === 'A' && rule.connectionB === 1);
  const secondPlacement = aggregation.placePartAtConnection(
    firstOpen.partId,
    firstOpen.connectionId,
    firstRule.partB,
    firstRule.connectionB
  );
  expect(secondPlacement.success).toBe(true);

  return aggregation;
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

  it('preserves serialized active connections when deserializing parts', () => {
    const plane = new Plane(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 1)
    );
    const connectionA = new Connection(plane, 'any', 'A', 0);
    const connectionB = new Connection(plane, 'any', 'A', 1);
    const mesh = makeBoxMesh();
    const collider = new Collider([mesh.clone()], false, false, [], []);
    const part = new Part('A', mesh, [connectionA, connectionB], collider, [], 1, 0, null);
    part.active_connections = [1];

    const restored = Part.fromData(part.toData());
    expect(restored.active_connections).toEqual([1]);
  });

  it('round-trips an empty aggregation definition via Aggregation.toData/fromData', () => {
    const aggregation = makeAggregation(['A']);
    const serialized = aggregation.toData();
    const restored = Aggregation.fromData(serialized);

    expect(serialized.object_type).toBe('Aggregation');
    expect(serialized.include_aggr_geo).toBe(true);
    expect(serialized.aggregated_parts).toEqual({});
    expect(serialized.aggregated_parts_sequence).toEqual([]);
    expect(restored.name).toBe(aggregation.name);
    expect(Object.keys(restored.parts)).toEqual(Object.keys(aggregation.parts));
    expect(restored.rules).toHaveLength(aggregation.rules.length);
    expect(restored.rnd_seed).toBe(aggregation.rnd_seed);
  });

  it('round-trips placed aggregated parts with hierarchy and open connections intact', () => {
    const aggregation = placeChain(makeAggregation(['A']));
    const serialized = aggregation.toData();
    const restored = Aggregation.fromData(serialized);
    const reserialized = restored.toData();

    expect(restored.aggregated_parts).toHaveLength(2);
    expect(restored.aggregated_parts.map(part => part.id)).toEqual([0, 1]);
    expect(restored.aggregated_parts[0].children).toEqual([1]);
    expect(restored.aggregated_parts[1].parent).toBe(0);
    expect(restored.aggregated_parts[1].conn_on_parent).toBe(0);
    expect(restored.aggregated_parts[1].conn_to_parent).toBe(1);
    expect(restored.aggregated_parts[0].active_connections).toEqual([1]);
    expect(restored.aggregated_parts[1].active_connections).toEqual([0]);
    expect(reserialized.aggregated_parts_sequence).toEqual([0, 1]);
    expect(reserialized.aggregated_parts['1'].transform).toEqual(serialized.aggregated_parts['1'].transform);
  });

  it('continues assigning stable ids after re-importing an aggregation', () => {
    const aggregation = placeChain(makeAggregation(['A']));
    const restored = Aggregation.fromData(aggregation.toData());

    const open = restored.getOpenConnections().find(conn => conn.partId === 1 && conn.connectionId === 0);
    const rule = open.rules.find(candidate => candidate.partB === 'A' && candidate.connectionB === 1);
    const result = restored.placePartAtConnection(open.partId, open.connectionId, rule.partB, rule.connectionB);

    expect(result.success).toBe(true);
    expect(result.part.id).toBe(2);
    expect(restored.aggregated_parts.map(part => part.id)).toEqual([0, 1, 2]);
  });
});
