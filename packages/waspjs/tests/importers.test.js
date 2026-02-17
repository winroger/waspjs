import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Plane } from '../src/core/plane.js';
import { Connection } from '../src/core/connection.js';
import { Collider } from '../src/core/collider.js';
import { Part } from '../src/core/part.js';
import { Rule } from '../src/core/rule.js';
import { Aggregation } from '../src/core/aggregation.js';
import { buildAggregationFromPartsAndRules } from '../src/importers/fromPartsAndRules.js';
import { buildAggregationFromData } from '../src/importers/fromAggregation.js';

function makePart(name) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(geometry, material);

  const plane = new Plane(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1));
  const connection = new Connection(plane, 'any', name, 0);
  const collider = new Collider([mesh.clone()], false, false, [], []);

  return new Part(name, mesh, [connection], collider, [], 1, null, null);
}

describe('importers', () => {
  it('builds aggregation from parts with generated rules when rulesData is absent', () => {
    const part = makePart('A');
    const partData = part.toData();

    const { aggregation, parts, rules } = buildAggregationFromPartsAndRules({
      name: 'generated',
      partsData: [partData],
      rulesData: null,
      autoGenerateRules: true,
      allowSelf: true,
      allowSelfConnection: true,
      useTypes: false,
    });

    expect(aggregation).toBeInstanceOf(Aggregation);
    expect(parts).toHaveLength(1);
    expect(rules.length).toBeGreaterThan(0);
  });

  it('uses provided rules and seed when supplied', () => {
    const part = makePart('A');
    const partData = part.toData();
    const ruleData = new Rule('A', 0, 'A', 0).toData();

    const { aggregation, rules } = buildAggregationFromPartsAndRules({
      name: 'provided',
      partsData: [partData],
      rulesData: [ruleData],
      autoGenerateRules: false,
      seed: 42,
    });

    expect(rules).toHaveLength(1);
    expect(aggregation.rnd_seed).toBe(42);
  });

  it('builds aggregation directly from data', () => {
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

    const aggregation = buildAggregationFromData(aggregationData);
    expect(aggregation).toBeInstanceOf(Aggregation);
    expect(aggregation.name).toBe('direct');
    expect(Object.keys(aggregation.parts)).toContain('A');
  });
});