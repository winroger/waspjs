import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Plane } from '../src/core/plane.js';
import { Connection } from '../src/core/connection.js';
import { Collider } from '../src/core/collider.js';
import { Part } from '../src/core/part.js';
import { Rule } from '../src/core/rule.js';
import { Aggregation } from '../src/core/aggregation.js';
import { createAggregationFromData } from '../src/core/publicApi.js';

function makePart(name) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(geometry, material);

  const plane = new Plane(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1));
  const connection = new Connection(plane, 'any', name, 0);
  const collider = new Collider([mesh.clone()], false, false, [], []);

  return new Part(name, mesh, [connection], collider, [], 1, null, null);
}

describe('public api', () => {
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

    const aggregation = createAggregationFromData(aggregationData);
    expect(aggregation).toBeInstanceOf(Aggregation);
    expect(aggregation.name).toBe('direct');
    expect(Object.keys(aggregation.parts)).toContain('A');
  });
});
