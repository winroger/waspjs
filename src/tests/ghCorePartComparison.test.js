/**
 * WaspJS — measured GH-Wasp Part compatibility checks.
 * Upstream modules: src/wasp/core/parts.py, connection.py and colliders.py
 * Reference capture and limitations: wasp-workspace/validation/WASP-002/README.md
 */

import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { Part } from '../core/part.js';
import { Connection } from '../core/connection.js';
import { Collider } from '../core/collider.js';
import { meshFromData, transformFromData } from '../core/utilities.js';
import corpus from './fixtures/gh-core-part-cases.json';
import reference from './fixtures/gh-core-part-reference.json';
import minimalPart from './fixtures/minimal-part.json';

const clone = value => globalThis.structuredClone(value);
const fixture = { ...clone(minimalPart), attributes: clone(corpus.attributes), id: 0 };
const strict = process.env.WASP_STRICT_GH_COMPARISON === '1';

// GH-Wasp difference: these assertions remain expected failures until separately
// authorized fixes land. Strict mode exposes them as ordinary failing tests.
// Each assertion tests one facet; unrelated setup errors fail the whole suite.
const knownDifferences = {
    center: new Set(corpus.cases.map(item => item.id)),
};
const issueByFacet = {
    center: 'WASP-012',
};

// ==================== Observation helpers ====================

function matrix(rows) {
    return transformFromData(Object.fromEntries(rows.flatMap((values, row) => (
        values.map((value, col) => [`M${row}${col}`, value])
    ))));
}

function frame(plane) {
    return Object.fromEntries(['origin', 'xaxis', 'yaxis', 'zaxis']
        .map(key => [key, plane[key].toArray()]));
}

function snapshot(part) {
    return {
        data: part.toData(),
        center: part.center.toArray(),
        frames: part.connections.map(conn => ({
            plane: frame(conn.pln), flip_plane: frame(conn.flip_pln),
        })),
    };
}

function observe(spec) {
    const raw = clone(fixture);
    const beforeInput = clone(raw);
    let base;
    if (spec.construction === 'constructor') {
        const connections = raw.connections.map(item => {
            const parsed = Connection.fromData(item);
            return new Connection(parsed.pln, item.type, '', 99);
        });
        base = new Part(raw.name, meshFromData(raw.geometry), connections,
            Collider.fromData(raw.collider), raw.attributes, raw.dim, raw.id);
    } else {
        base = Part.fromData(raw);
    }
    const beforeBase = snapshot(base);
    let placed = spec.copy ? base.copy() : base;
    for (const rows of spec.transforms) placed = placed.transform(matrix(rows));

    const full = placed.toData();
    const light = placed.toData(false, false);
    const beforeFull = clone(full);
    const beforeLight = clone(light);
    return {
        placed: snapshot(placed),
        full_roundtrip: snapshot(Part.fromData(full)),
        light_roundtrip: snapshot(Part.fromData(light, base)),
        light_export: light,
        input_unchanged: JSON.stringify(raw) === JSON.stringify(beforeInput),
        base_unchanged: JSON.stringify(snapshot(base)) === JSON.stringify(beforeBase),
        exports_unchanged: JSON.stringify(full) === JSON.stringify(beforeFull)
            && JSON.stringify(light) === JSON.stringify(beforeLight),
    };
}

const observations = {
    provenance: { kind: 'waspjs-core-observation', node: process.version },
    cases: Object.fromEntries(corpus.cases.map(spec => [spec.id, observe(spec)])),
};
const probeBase = Part.fromData(clone(fixture));
const probeCopy = probeBase.copy();
probeCopy.geo.geometry.getAttribute('position').setXYZ(0, 9, 0, 0);
probeCopy.collider.geometry[0].geometry.getAttribute('position').setXYZ(0, 8, 0, 0);
observations.copy_mutation_probe = {
    base_geometry: probeBase.toData().geometry.vertices,
    base_collider: probeBase.toData().collider.geometry[0].vertices,
};

// Ordinary test runs stay read-only. An explicit output path enables the
// second JS -> GH import leg without a runtime dependency on sibling repos.
if (process.env.WASP_COMPARISON_OUTPUT) {
    writeFileSync(process.env.WASP_COMPARISON_OUTPUT,
        `${JSON.stringify(observations, null, 2)}\n`);
}

function expectNumeric(actual, expected, path = 'value') {
    if (typeof expected === 'number') {
        expect(typeof actual, path).toBe('number');
        expect(Math.abs(actual - expected), path).toBeLessThanOrEqual(1e-6);
    } else if (Array.isArray(expected)) {
        expect(Array.isArray(actual), path).toBe(true);
        expect(actual.length, path).toBe(expected.length);
        expected.forEach((value, index) => expectNumeric(actual[index], value, `${path}[${index}]`));
    } else if (expected !== null && typeof expected === 'object') {
        expect(Object.keys(actual).sort(), path).toEqual(Object.keys(expected).sort());
        Object.entries(expected).forEach(([key, value]) => (
            expectNumeric(actual[key], value, `${path}.${key}`)
        ));
    } else {
        expect(actual, path).toEqual(expected);
    }
}

function geometry(record, state = 'placed') {
    const data = record[state].data;
    return { geometry: data.geometry, collider: data.collider.geometry };
}

function connectionAxes(record) {
    return record.placed.frames.map(item => Object.fromEntries(
        ['plane', 'flip_plane'].map(key => [key, {
            origin: item[key].origin, xaxis: item[key].xaxis, yaxis: item[key].yaxis,
        }])
    ));
}

const facets = {
    geometry: record => record.placed.data.geometry,
    collider: record => record.placed.data.collider.geometry,
    matrix: record => record.placed.data.transform,
    axes: connectionAxes,
    metadata: record => record.placed.data.connections.map(({ id, part, type }) => ({ id, part, type })),
    normals: record => record.placed.frames.map(item => ({
        plane: item.plane.zaxis, flip_plane: item.flip_plane.zaxis,
    })),
    center: record => record.placed.center,
    attributes: record => record.placed.data.attributes,
    fullRoundtrip: record => geometry(record, 'full_roundtrip'),
    lightRoundtrip: record => geometry(record, 'light_roundtrip'),
    unchanged: record => ({ input: record.input_unchanged,
        base: record.base_unchanged, exports: record.exports_unchanged }),
};

// ==================== Measured reference comparisons ====================

describe('GH-Wasp 0.7.003 Part comparison', () => {
    it('uses executed reference results for exactly the shared corpus', () => {
        expect(reference.provenance.kind).toBe('executed-gh-wasp-core-in-rhino');
        expect(reference.provenance.gh_commit).toBe('9bf05acd945e8581244a6ef3bf5a0733018c9b6d');
        expect(reference.provenance.gh_version).toBe('0.7.003');
        expect(Object.keys(reference.cases).sort()).toEqual(corpus.cases.map(item => item.id).sort());
    });

    for (const spec of corpus.cases) {
        for (const [name, select] of Object.entries(facets)) {
            const known = knownDifferences[name]?.has(spec.id);
            const test = known && !strict ? it.fails : it;
            const label = `${spec.id}: ${name}${known ? ` [${issueByFacet[name]}: known GH-Wasp difference]` : ''}`;
            test(label, () => {
                expectNumeric(select(observations.cases[spec.id]), select(reference.cases[spec.id]));
            });
        }
        for (const includeGeometry of [true, false]) {
            it(`${spec.id}: imports actual GH ${includeGeometry ? 'full' : 'light'} export`, () => {
                const expected = reference.cases[spec.id];
                const input = clone(includeGeometry ? expected.placed.data : expected.light_export);
                const before = clone(input);
                const restored = Part.fromData(input, Part.fromData(clone(fixture)));
                expectNumeric(geometry({ placed: snapshot(restored) }), geometry(expected));
                expect(input).toEqual(before);
            });
        }
    }

    it('copy owns independent geometry buffers', () => {
        expectNumeric(observations.copy_mutation_probe, reference.copy_mutation_probe);
    });

    for (const id of ['translation_then_rotation', 'rotation_then_translation']) {
        it(`${id}: preserves each source Part and incoming matrix during composition`, () => {
            let part = Part.fromData(clone(fixture));
            for (const rows of corpus.cases.find(spec => spec.id === id).transforms) {
                const incoming = matrix(rows);
                const beforeMatrix = incoming.elements.slice();
                const beforePart = snapshot(part);
                const transformed = part.transform(incoming);
                expect(incoming.elements).toEqual(beforeMatrix);
                expect(snapshot(part)).toEqual(beforePart);
                part = transformed;
            }
            expectNumeric(snapshot(part).data.transform, reference.cases[id].placed.data.transform);
        });
    }
});
