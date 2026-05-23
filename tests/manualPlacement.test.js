import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Plane } from '../src/core/plane.js';
import { Connection } from '../src/core/connection.js';
import { Collider } from '../src/core/collider.js';
import { Part } from '../src/core/part.js';
import { Rule } from '../src/core/rule.js';
import { Aggregation } from '../src/core/aggregation.js';

function makePart(name) {
  const geometry = new THREE.BoxGeometry(2, 1, 1);
  const material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(geometry, material);

  // Connection 0: +X face. Z-axis = outward face normal (1,0,0).
  const plane0 = new Plane(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(1, 0, 0)
  );
  // Connection 1: -X face. Z-axis = outward face normal (-1,0,0).
  const plane1 = new Plane(
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(-1, 0, 0)
  );

  const conn0 = new Connection(plane0, 'any', name, 0);
  const conn1 = new Connection(plane1, 'any', name, 1);

  // Use empty collider so collision check falls back to 0.99-scaled geo
  // (avoids false positives from coplanar touching faces with full-size colliders)
  const collider = new Collider([], false, false, [], []);

  return new Part(name, mesh, [conn0, conn1], collider, [], 1, null, null);
}

function makeAggregation(partNames = ['A']) {
  const parts = partNames.map(n => makePart(n));
  const rules = [];
  for (const p of parts) {
    for (const other of parts) {
      for (const conn of p.connections) {
        for (const otherConn of other.connections) {
          rules.push(new Rule(p.name, conn.id, other.name, otherConn.id));
        }
      }
    }
  }
  return new Aggregation('test', parts, rules, 42);
}

describe('placeFirstPart', () => {
  it('places a named part at the origin', () => {
    const agg = makeAggregation(['A']);
    const result = agg.placeFirstPart('A');
    expect(result.success).toBe(true);
    expect(result.part).toBeDefined();
    expect(result.part.name).toBe('A');
    expect(agg.aggregated_parts).toHaveLength(1);
    expect(agg.aggregated_parts[0].id).toBe(0);
  });

  it('fails when aggregation is not empty', () => {
    const agg = makeAggregation(['A']);
    agg.placeFirstPart('A');
    const result = agg.placeFirstPart('A');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not empty/i);
  });

  it('fails for unknown part name', () => {
    const agg = makeAggregation(['A']);
    const result = agg.placeFirstPart('UNKNOWN');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });
});

describe('getOpenConnections', () => {
  it('returns all connections of a single placed part', () => {
    const agg = makeAggregation(['A']);
    agg.placeFirstPart('A');
    const open = agg.getOpenConnections();
    expect(open.length).toBe(2);
    expect(open[0].partId).toBe(0);
    expect(open[0]).toHaveProperty('plane');
    expect(open[0]).toHaveProperty('type');
    expect(open[0]).toHaveProperty('rules');
  });

  it('returns empty array for empty aggregation', () => {
    const agg = makeAggregation(['A']);
    expect(agg.getOpenConnections()).toHaveLength(0);
  });
});

describe('placePartAtConnection', () => {
  it('places a part at a specific connection', () => {
    const agg = makeAggregation(['A']);
    agg.placeFirstPart('A');

    const open = agg.getOpenConnections();
    expect(open.length).toBeGreaterThan(0);

    // Pick conn 0, rule that maps to conn 1 (non-colliding: +X face → -X face)
    const conn = open.find(c => c.connectionId === 0);
    expect(conn).toBeDefined();
    const matchingRule = conn.rules.find(r => r.partB === 'A' && r.connectionB === 1);
    expect(matchingRule).toBeDefined();

    const result = agg.placePartAtConnection(
      conn.partId,
      conn.connectionId,
      matchingRule.partB,
      matchingRule.connectionB
    );

    expect(result.success).toBe(true);
    expect(result.part).toBeDefined();
    expect(agg.aggregated_parts).toHaveLength(2);
  });

  it('fails for non-existent parent', () => {
    const agg = makeAggregation(['A']);
    agg.placeFirstPart('A');
    const result = agg.placePartAtConnection(999, 0, 'A', 0);
    expect(result.success).toBe(false);
  });

  it('fails for inactive connection', () => {
    const agg = makeAggregation(['A']);
    agg.placeFirstPart('A');

    // Use connection 0 with non-colliding rule
    const open = agg.getOpenConnections();
    const conn = open.find(c => c.connectionId === 0);
    const rule = conn.rules.find(r => r.partB === 'A' && r.connectionB === 1);
    agg.placePartAtConnection(conn.partId, conn.connectionId, rule.partB, rule.connectionB);

    // Connection 0 is now used — should fail
    const result2 = agg.placePartAtConnection(conn.partId, conn.connectionId, 'A', 1);
    expect(result2.success).toBe(false);
    expect(result2.error).toMatch(/not active/i);
  });
});

describe('getValidPlacementsForPart', () => {
  it('returns valid placements for a part type', () => {
    const agg = makeAggregation(['A']);
    agg.placeFirstPart('A');

    const placements = agg.getValidPlacementsForPart('A');
    expect(placements.length).toBeGreaterThan(0);
    expect(placements[0]).toHaveProperty('parentPartId');
    expect(placements[0]).toHaveProperty('connectionId');
    expect(placements[0]).toHaveProperty('partName', 'A');
    expect(placements[0]).toHaveProperty('connectionBId');
    expect(placements[0]).toHaveProperty('transform');
    expect(placements[0]).toHaveProperty('transformedPart');
  });

  it('returns empty array for unknown part', () => {
    const agg = makeAggregation(['A']);
    agg.placeFirstPart('A');
    expect(agg.getValidPlacementsForPart('UNKNOWN')).toHaveLength(0);
  });

  it('returns empty for empty aggregation', () => {
    const agg = makeAggregation(['A']);
    expect(agg.getValidPlacementsForPart('A')).toHaveLength(0);
  });
});

describe('setActivePartTypes', () => {
  it('restricts random placement to active types', () => {
    const agg = makeAggregation(['A', 'B']);
    agg.setActivePartTypes(['A']);

    // Place first part — should only pick from active types
    agg.addFirstPartToAggregation();
    expect(agg.aggregated_parts[0].name).toBe('A');
  });

  it('allows all types when set to null', () => {
    const agg = makeAggregation(['A', 'B']);
    agg.setActivePartTypes(['A']);
    agg.setActivePartTypes(null);

    // With null, both types are available
    expect(agg.activePartTypes).toBeNull();
  });

  it('addPartToAggregation respects active filter', () => {
    const agg = makeAggregation(['A', 'B']);
    agg.setActivePartTypes(['A']);
    agg.addFirstPartToAggregation();

    // Add several more — all should be A since only A is active
    for (let i = 0; i < 5; i++) {
      agg.addPartToAggregation();
    }

    for (const part of agg.aggregated_parts) {
      expect(part.name).toBe('A');
    }
  });
});

describe('removePartFromAggregation', () => {
  it('restores parent connection after removal', () => {
    const agg = makeAggregation(['A']);
    agg.placeFirstPart('A');

    const openBefore = agg.getOpenConnections();
    const conn = openBefore.find(c => c.connectionId === 0);
    const rule = conn.rules.find(r => r.partB === 'A' && r.connectionB === 1);
    const placeResult = agg.placePartAtConnection(conn.partId, conn.connectionId, rule.partB, rule.connectionB);

    expect(placeResult.success).toBe(true);
    expect(agg.aggregated_parts).toHaveLength(2);

    const childId = agg.aggregated_parts[1].id;
    agg.removePartFromAggregation(childId);

    expect(agg.aggregated_parts).toHaveLength(1);

    // Parent's connection should be restored
    const openAfter = agg.getOpenConnections();
    expect(openAfter.length).toBe(openBefore.length);
  });
});
