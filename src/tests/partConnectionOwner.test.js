/**
 * WaspJS — Connection owner assignment in the base Part constructor.
 * Upstream: src/wasp/core/parts.py::Part.__init__ and Connection rule tables.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { Part } from '../core/part.js';
import { Connection } from '../core/connection.js';
import { Collider } from '../core/collider.js';
import { Plane } from '../core/plane.js';
import { Rule } from '../core/rule.js';
import { Aggregation } from '../core/aggregation.js';
import { meshFromData } from '../core/utilities.js';
import fixture from './fixtures/minimal-part.json';

const clone = value => globalThis.structuredClone(value);
const metadata = connections => connections.map(({ part, id, type }) => ({ part, id, type }));
const expected = ['0', '1', '2'].map((type, id) => ({ part: 'A', id, type }));
const translation = () => new THREE.Matrix4().makeTranslation(10, 20, 30);

function incoming() {
    return ['', 'Previous', 'A'].map((owner, i) => Connection.fromData({
        ...clone(fixture.connections[0]), part: owner, id: 99 - i, type: String(i),
    }));
}

function makePart(connections = incoming(), name = 'A') {
    return new Part(name, meshFromData(fixture.geometry), connections,
        Collider.fromData(clone(fixture.collider)), [], 1, 0);
}

function wrongOwnerData(part, includeGeometry) {
    const data = part.toData(includeGeometry, includeGeometry);
    data.connections.forEach((conn, i) => { conn.part = i === 0 ? '' : 'Previous'; conn.id = 50 + i; });
    return data;
}

function observe() {
    const inputs = incoming();
    const part = makePart(inputs);
    const rules = [new Rule('A', 0, 'B', 1), new Rule('A', 1, 'B', 0)];
    part.resetPart(rules);
    const alias = makePart([Connection.fromData(clone(fixture.connections[0]))]);
    const reused = makePart([alias.connections[0]], 'B');
    return {
        direct: metadata(part.connections), input_after: metadata(inputs),
        retains_input_references: inputs.every((conn, i) => conn === part.connections[i]),
        active_connections: part.active_connections,
        copy: metadata(part.copy().connections), transformed: metadata(part.transform(translation()).connections),
        full_import: metadata(Part.fromData(wrongOwnerData(part, true)).connections),
        light_import: metadata(Part.fromData(wrongOwnerData(part, false), part).connections),
        rule_counts: part.connections.map(conn => conn.rules_table.length),
        active_rule_indices: part.connections.map(conn => conn.active_rules),
        reused_connection_owners: [alias.connections[0].part, reused.connections[0].part],
    };
}
if (process.env.WASP_OWNER_OUTPUT) {
    writeFileSync(process.env.WASP_OWNER_OUTPUT, `${JSON.stringify(observe(), null, 2)}\n`);
}

describe('Part Connection owner assignment', () => {
    it('assigns its name and sequential IDs to the supplied objects, including stale owners', () => {
        const inputs = incoming();
        const part = makePart(inputs);
        expect(metadata(part.connections)).toEqual(expected);
        expect(metadata(inputs)).toEqual(expected);
        inputs.forEach((conn, i) => expect(part.connections[i]).toBe(conn));
        expect(part.active_connections).toEqual([0, 1, 2]);
    });

    for (const method of ['copy', 'transform']) {
        it(`${method}: preserves owners and IDs on independent Connection objects`, () => {
            const part = makePart();
            const before = clone(part.toData());
            const result = method === 'copy' ? part.copy() : part.transform(translation());
            expect(metadata(result.connections)).toEqual(expected);
            result.connections.forEach((conn, i) => expect(conn).not.toBe(part.connections[i]));
            result.connections[0].part = 'Changed';
            expect(part.toData()).toEqual(before);
        });
    }

    for (const includeGeometry of [true, false]) {
        it(`${includeGeometry ? 'full' : 'light'} import: assigns owners without modifying the payload`, () => {
            const base = makePart();
            const data = wrongOwnerData(base, includeGeometry);
            const before = clone(data);
            const result = Part.fromData(data, base);
            expect(metadata(result.connections)).toEqual(expected);
            expect(data).toEqual(before);
        });
    }

    it('uses the assigned owners to populate actual Connection rule tables', () => {
        const part = makePart();
        const rules = [new Rule('A', 0, 'B', 1), new Rule('A', 1, 'B', 0), new Rule('Previous', 2, 'B', 0)];
        part.resetPart(rules);
        expect(part.connections.map(conn => conn.rules_table)).toEqual([[rules[0]], [rules[1]], []]);
        expect(part.connections.map(conn => conn.active_rules)).toEqual([[0], [0], []]);
    });

    it('places a directly constructed part through a rule that requires its assigned owner', () => {
        const box = name => {
            const connections = [1, -1].map(sign => new Connection(new Plane(
                new THREE.Vector3(sign, 0, 0), new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(sign, 0, 0)), 'any', '', 99));
            return new Part(name, new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1)),
                connections, new Collider([]), [], 1);
        };
        const aggregation = new Aggregation('owner', [box('A'), box('B')], [new Rule('A', 0, 'B', 1)], 42);
        expect(aggregation.placeFirstPart('A').success).toBe(true);
        const result = aggregation.placePartAtConnection(0, 0, 'B', 1);
        expect(result.success).toBe(true);
        expect(result.part.connections.map(conn => conn.part)).toEqual(['B', 'B']);
        expect(result.part.transformation.elements).toEqual(new THREE.Matrix4().makeTranslation(2, 0, 0).elements);
        expect(result.part.parent).toBe(0);
    });
});
