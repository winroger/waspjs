import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import {
  Aggregation, Collider, Connection, Part, PartCatalog, Plane, generateRules,
} from '../index.js';

function makeAggregation(withChild = false, catalog = null) {
  const parts = ['A', 'B', 'C'].map(name => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const connections = [-1, 1].map(side => new Connection(new Plane(
      new THREE.Vector3(side * 0.5, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(side, 0, 0),
    ), 'end', name, 0));
    return new Part(name, mesh, connections, new Collider([mesh]));
  });
  const aggregation = new Aggregation('queries', parts, generateRules(parts), 42, 0, catalog);
  aggregation.coll_check = false;
  expect(aggregation.placeFirstPart('A').success).toBe(true);
  if (withChild) expect(aggregation.placePartAtConnection(0, 1, 'B', 0).success).toBe(true);
  return aggregation;
}

function placementSummary(placements) {
  return placements.map(({ transformedPart, transform, ...placement }) => ({
    ...placement,
    transform: transform.elements,
    part: transformedPart.toData(),
  }));
}

describe('canonical aggregation queries', () => {
  it('filters pruned rules identically in global and per-Part core queries', () => {
    const aggregation = makeAggregation();
    const connection = aggregation.getParts()[0].connections[0];
    connection.active_rules = [5, 4];
    connection.rules_table[5].active = false; // Metadata does not select active rules.
    const global = aggregation.getOpenConnections().filter(item => item.partId === 0);
    expect(aggregation.getOpenConnectionsForPart(0)).toEqual(global);
    expect(global[0].rules).toEqual([connection.rules_table[5], connection.rules_table[4]]);
  });

  it('returns base definitions separately from placed instances and inventory', () => {
    const aggregation = makeAggregation(false, new PartCatalog(['A', 'B', 'C'], [3, 3, 3], true));
    const baseParts = aggregation.getBaseParts();
    expect(baseParts.map(part => part.name)).toEqual(['A', 'B', 'C']);
    expect(baseParts[0]).toBe(aggregation.parts.A);
    expect(baseParts[0]).not.toBe(aggregation.getParts()[0]);
    baseParts.pop();
    expect(aggregation.getBaseParts()).toHaveLength(3);
    expect(aggregation.catalog.parts).toEqual(['A', 'B', 'C']);
  });

  it('scopes connection inspection by exact ID and retains consumed-slot state', () => {
    const data = makeAggregation(true).toData();
    data.aggregated_parts['42-beam'] = { ...data.aggregated_parts[1], id: '42-beam' };
    delete data.aggregated_parts[1];
    data.aggregated_parts[0].children = ['42-beam'];
    data.aggregated_parts_sequence = [0, '42-beam'];
    data.graph = {}; // Reconstruct the sequence graph from the updated IDs.
    const aggregation = Aggregation.fromData(data);
    const before = aggregation.toData();
    expect(aggregation.getOpenConnectionsForPart(0).map(item => item.connectionId)).toEqual([0]);
    expect(aggregation.getOpenConnectionsForPart('42-beam')).toEqual(
      aggregation.getOpenConnections().filter(item => item.partId === '42-beam'),
    );
    expect(aggregation.getOpenConnectionsForPart(42)).toEqual([]);
    expect(aggregation.getOpenConnectionsForPart('0')).toEqual([]);
    expect(aggregation.getOpenConnectionsForPart('missing')).toEqual([]);
    expect(aggregation.toData()).toEqual(before);
  });

  it('returns fresh connection/rule arrays while preserving plane and Rule references', () => {
    const aggregation = makeAggregation();
    const part = aggregation.getParts()[0];
    part.connections[0].active_rules = [5, 4];
    const result = aggregation.getOpenConnectionsForPart(0);
    expect(result[0].plane).toBe(part.connections[0].pln);
    expect(result[0].rules[0]).toBe(part.connections[0].rules_table[5]);
    result[0].rules.pop();
    result.pop();
    expect(part.connections[0].active_rules).toEqual([5, 4]);
    expect(part.connections[0].rules_table).toHaveLength(6);
    expect(aggregation.getOpenConnectionsForPart(0)[0].rules).toHaveLength(2);
  });

  it('keeps slots with no active rules visible and does not prune them on inspection', () => {
    const aggregation = makeAggregation();
    const part = aggregation.getParts()[0];
    part.connections[0].active_rules = [];
    expect(aggregation.getOpenConnectionsForPart(0)[0].rules).toEqual([]);
    expect(part.active_connections).toEqual([0, 1]);
  });

  it('preserves candidate order, geometry and rule indices across all scopes', () => {
    const aggregation = makeAggregation(true);
    aggregation.getParts()[0].connections[0].active_rules = [5, 4, 2];
    const before = aggregation.toData();
    const all = aggregation.getValidPlacementsForPart('C');
    for (const part of aggregation.getParts()) {
      const parent = aggregation.getValidPlacementsAtParent('C', part.id);
      expect(placementSummary(parent)).toEqual(placementSummary(
        all.filter(item => item.parentPartId === part.id),
      ));
      for (const index of part.active_connections) {
        const connection = aggregation.getValidPlacementsAtConnection('C', part.id, index);
        expect(placementSummary(connection)).toEqual(placementSummary(
          parent.filter(item => item.connectionId === index),
        ));
      }
    }
    expect(all.filter(item => item.parentPartId === 0).map(item => item.ruleIndex)).toEqual([5, 4]);
    expect(aggregation.toData()).toEqual(before);
  });

  it('does not transform or collision-check candidates outside the requested scope', () => {
    const aggregation = makeAggregation(true);
    const part = aggregation.parts.C;
    const transform = vi.spyOn(part, 'transform');
    const collision = vi.spyOn(aggregation, '_checkCollision');
    const unrelated = aggregation.getParts()[1].connections[1];
    const rules = vi.fn(() => { throw new Error('Unrelated connection was inspected'); });
    Object.defineProperty(unrelated, 'rules_table', { get: rules, configurable: true });
    expect(aggregation.getValidPlacementsAtConnection('C', 0, 0)).toHaveLength(2);
    expect(transform).toHaveBeenCalledTimes(2);
    expect(collision).toHaveBeenCalledTimes(2);
    expect(rules).not.toHaveBeenCalled();
  });

  it('respects collision rejection without changing connection state', () => {
    const aggregation = makeAggregation();
    const before = aggregation.toData();
    vi.spyOn(aggregation, '_checkCollision').mockReturnValue(true);
    expect(aggregation.getValidPlacementsForPart('C')).toEqual([]);
    expect(aggregation.getValidPlacementsAtParent('C', 0)).toEqual([]);
    expect(aggregation.getValidPlacementsAtConnection('C', 0, 0)).toEqual([]);
    expect(aggregation.toData()).toEqual(before);
  });

  it('returns no candidates for invalid scopes, including omitted connection indices', () => {
    const aggregation = makeAggregation(true);
    expect(aggregation.getValidPlacementsForPart('unknown')).toEqual([]);
    expect(aggregation.getValidPlacementsAtParent('C', '0')).toEqual([]);
    expect(aggregation.getValidPlacementsAtParent('unknown', 0)).toEqual([]);
    for (const id of [1, -1, 99, undefined, null, '0']) {
      expect(aggregation.getValidPlacementsAtConnection('C', 0, id)).toEqual([]);
    }
    expect(aggregation.getValidPlacementsAtConnection('C', '0', 0)).toEqual([]);
  });

  it('preserves stock on previews and rejects exhausted inventory in every scope', () => {
    const aggregation = makeAggregation(false, new PartCatalog(['A', 'B', 'C'], [2, 2, 1], true));
    const before = aggregation.catalog.toData();
    expect(aggregation.getValidPlacementsForPart('C').length).toBeGreaterThan(0);
    expect(aggregation.getValidPlacementsAtParent('C', 0)).toHaveLength(4);
    expect(aggregation.getValidPlacementsAtConnection('C', 0, 0)).toHaveLength(2);
    expect(aggregation.catalog.toData()).toEqual(before);
    expect(aggregation.placePartAtConnection(0, 1, 'C', 0).success).toBe(true);
    expect(aggregation.getValidPlacementsForPart('C')).toEqual([]);
    expect(aggregation.getValidPlacementsAtParent('C', 0)).toEqual([]);
    expect(aggregation.getValidPlacementsAtConnection('C', 0, 0)).toEqual([]);
  });
});

describe('class-only aggregation loading', () => {
  it('roundtrips Full/Light state without mutating its serialized input', () => {
    const aggregation = makeAggregation(true);
    for (const includeGeometry of [true, false]) {
      const data = aggregation.toData(includeGeometry);
      const before = globalThis.structuredClone(data);
      expect(Aggregation.fromData(data).toData(includeGeometry)).toEqual(data);
      expect(data).toEqual(before);
    }
  });
});
