import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Plane } from '../core/plane.js';
import { Connection } from '../core/connection.js';
import { Collider } from '../core/collider.js';
import { Part } from '../core/part.js';
import { Rule } from '../core/rule.js';
import { Aggregation } from '../core/aggregation.js';
import * as packageExports from '../index.js';
import * as utilities from '../core/utilities.js';
import { generateRules } from '../operations/generateRules.js';

function makePart(name) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(geometry, material);

  const plane = new Plane(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1));
  const connection = new Connection(plane, 'any', name, 0);
  const collider = new Collider([mesh.clone()], false, false, [], []);

  return new Part(name, mesh, [connection], collider, [], 1, null, null);
}

describe('aggregation loading and package exports', () => {
  it('preserves public utilities and operations while keeping mesh adapters internal', () => {
    expect(packageExports).toMatchObject({
      checkMeshesIntersection: utilities.checkMeshesIntersection,
      meshToData: utilities.meshToData,
      meshFromData: utilities.meshFromData,
      transformToData: utilities.transformToData,
      transformFromData: utilities.transformFromData,
      PlaneToPlane: utilities.PlaneToPlane,
      generateRules,
    });
    expect(utilities).not.toHaveProperty('generateRules');
    expect(packageExports).not.toHaveProperty('copyMesh');
    expect(packageExports).not.toHaveProperty('meshAreaCentroid');
  });

  it('creates an aggregation directly from serialized data', () => {
    const part = makePart('A');
    const partData = part.toData();
    const ruleData = new Rule('A', 0, 'A', 0).toData();

    const aggregationData = {
      name: 'direct',
      parts: [partData],
      rules: [ruleData],
      rnd_seed: 7,
      global_constraints: [],
      catalog: null,
    };

    const aggregation = Aggregation.fromData(aggregationData);
    expect(aggregation).toBeInstanceOf(Aggregation);
    expect(aggregation.name).toBe('direct');
    expect(Object.keys(aggregation.parts)).toContain('A');
  });
});
