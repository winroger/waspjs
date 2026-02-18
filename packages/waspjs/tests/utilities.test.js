import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { generateRules, transformToData, transformFromData } from '../src/core/utilities.js';
import { Rule } from '../src/core/rule.js';

describe('transform helpers', () => {
  it('round-trips a matrix with transformToData/transformFromData', () => {
    const matrix = new THREE.Matrix4().set(
      1, 2, 3, 4,
      5, 6, 7, 8,
      9, 10, 11, 12,
      13, 14, 15, 16
    );

    const data = transformToData(matrix);
    const restored = transformFromData(data);

    expect(restored.elements).toEqual(matrix.elements);
  });
});

describe('generateRules', () => {
  const parts = [
    {
      name: 'A',
      connections: [
        { id: 0, type: 'x' },
        { id: 1, type: 'y' }
      ]
    },
    {
      name: 'B',
      connections: [
        { id: 0, type: 'x' },
        { id: 1, type: 'y' }
      ]
    }
  ];

  it('generates type-aware rules when useTypes is true', () => {
    const rules = generateRules(parts, true, false, true);
    expect(rules.length).toBe(4);
    rules.forEach(rule => expect(rule).toBeInstanceOf(Rule));
  });
});
