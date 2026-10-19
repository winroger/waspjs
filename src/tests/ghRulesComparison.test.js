/**
 * WaspJS — measured Rule/Rules Generator and forced GH placement comparisons.
 * Upstream: rules.py, connection.py, aggregation.py and Wasp_Rules Generator.py.
 */
import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { Aggregation } from '../core/aggregation.js';
import { Part } from '../core/part.js';
import { Rule } from '../core/rule.js';
import { meshToData, transformToData } from '../core/utilities.js';
import { generateRules } from '../operations/generateRules.js';
import corpus from './fixtures/gh-rules-cases.json';
import reference from './fixtures/gh-rules-reference.json';

const clone = value => globalThis.structuredClone(value);
// The existing BVH builder can reorder triangles. Compare directed triangle sets,
// preserving vertex order, winding and all connectivity/placement state.
function geometryOrder(value) {
    if (Array.isArray(value)) return value.map(geometryOrder);
    if (!value || typeof value !== 'object') return value;
    if (value.vertices && value.faces) return { ...value, faces: [...value.faces]
        .sort((a, b) => a.join(',').localeCompare(b.join(','))) };
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, geometryOrder(v)]));
}
const expected = geometryOrder(reference.observations);
const generatorParts = corpus.generator_parts.map(p => ({ name: p.name,
    connections: p.types.map((type, id) => ({ type, id })) }));
const constructedRule = raw => new Rule(raw.part1, Number(raw.conn1), raw.part2, Number(raw.conn2), raw.active);

function fresh(rules = corpus.rules.map(raw => Rule.fromData(raw))) {
    const aggregation = new Aggregation('rules', corpus.parts.map(raw => Part.fromData(clone(raw))), rules, 42);
    aggregation.placeFirstPart('A');
    return aggregation;
}

function snapshot(part) {
    return { name: part.name, id: part.id, parent: part.parent, children: [...part.children],
        conn_on_parent: part.conn_on_parent, conn_to_parent: part.conn_to_parent,
        active_connections: [...part.active_connections], matrix: transformToData(part.transformation),
        geometry: meshToData(part.geo), collider: part.collider.geometry.map(meshToData),
        connections: part.connections.map(c => ({ plane: c.pln.toData(), flip: c.flip_pln.toData(),
            part: c.part, id: c.id, type: c.type, rules: c.rules_table.map(r => r.toData()),
            active_rules: [...c.active_rules] })) };
}
const state = aggregation => geometryOrder(aggregation.aggregated_parts.map(snapshot));
const candidates = aggregation => geometryOrder(corpus.parts.flatMap(p =>
    aggregation.getValidPlacementsAtConnection(p.name, 0, 0).map(item => ({ name: p.name,
        matrix: transformToData(item.transform), geometry: meshToData(item.transformedPart.geo) }))));

function numeric(actual, wanted, path = 'value') {
    if (typeof wanted === 'number') expect(Math.abs(actual - wanted), path).toBeLessThanOrEqual(1e-5);
    else if (Array.isArray(wanted)) {
        expect(actual).toHaveLength(wanted.length);
        wanted.forEach((value, i) => numeric(actual[i], value, `${path}[${i}]`));
    } else if (wanted && typeof wanted === 'object') {
        expect(Object.keys(actual).sort()).toEqual(Object.keys(wanted).sort());
        for (const key of Object.keys(wanted)) numeric(actual[key], wanted[key], `${path}.${key}`);
    } else expect(actual).toEqual(wanted);
}

function observe() {
    const aggregation = fresh();
    const initial = candidates(aggregation);
    const chain = [];
    for (const step of corpus.steps) {
        const result = aggregation.placePartAtConnection(step.parent, step.connection, step.part, step.child_connection);
        if (!result.success) throw new Error(result.error);
        chain.push(state(aggregation));
    }
    const subset = fresh();
    subset.aggregated_parts[0].connections[0].active_rules = [1];
    const subsetCandidates = candidates(subset);
    const result = subset.placePartAtConnection(0, 0, 'D', 1);
    if (!result.success) throw new Error(result.error);
    return { generators: Object.fromEntries(corpus.generators.map(spec => [spec.id,
        generateRules(generatorParts, ...(spec.options ?? [])).map(rule => rule.toData())])),
    readers: corpus.reader_cases.map(raw => ({ constructor: constructedRule(raw).toData(),
        imported: Rule.fromData(clone(raw)).toData() })),
    initial_candidates: initial, active_subset_candidates: subsetCandidates,
    active_subset_state: state(subset), chain,
    consumed_connection: candidates(aggregation),
    inactive_boolean_table: fresh().aggregated_parts[0].connections[1].rules_table.map(r => r.toData()) };
}
const observations = observe();
if (process.env.WASP_RULE_OUTPUT) {
    writeFileSync(process.env.WASP_RULE_OUTPUT, `${JSON.stringify(observations, null, 2)}\n`);
}

describe('GH-Wasp Rules comparison', () => {
    it('uses actual pinned core and component-function execution', () => {
        expect(reference.provenance.kind).toBe('executed-gh-wasp-core-in-rhino');
        expect(reference.provenance.gh_commit).toBe('9bf05acd945e8581244a6ef3bf5a0733018c9b6d');
        expect(reference.provenance.scope).toContain('AST');
    });
    for (const spec of corpus.generators) {
        it(`${spec.id}: preserves GH generator rule order and endpoints`, () => {
            expect(observations.generators[spec.id]).toEqual(expected.generators[spec.id]);
        });
    }
    for (const [i, raw] of corpus.reader_cases.entries()) {
        it(`rule ${i}: constructor preserves directed endpoints and active flag`, () => {
            expect(constructedRule(raw).toData()).toEqual(expected.readers[i].constructor);
        });
        it(`rule ${i}: import keeps both endpoints and normalizes integer IDs without mutating input`, () => {
            const input = clone(raw);
            expect(Rule.fromData(input).toData()).toEqual(expected.readers[i].constructor);
            expect(input).toEqual(raw);
        });
    }
    it('records the actual GH reader defect without reproducing its duplicated first endpoint', () => {
        for (const [i, raw] of corpus.reader_cases.entries()) {
            expect(expected.readers[i].actual_reader.part2).toBe(raw.part1);
            expect(expected.readers[i].actual_reader.conn2).toBe(Number(raw.conn1));
            expect(observations.readers[i].imported.part2).toBe(raw.part2);
        }
    });
    it('matches GH table behavior: active is metadata, active_rules selects usable indices', () => {
        expect(observations.inactive_boolean_table).toEqual(expected.inactive_boolean_table);
        expect(observations.inactive_boolean_table[0].active).toBe(false);
        const conn = fresh().aggregated_parts[0].connections[0];
        conn.generateRulesTable([]);
        expect(conn.rules_table).toEqual([]);
        expect(conn.active_rules).toEqual([]);
    });
    it('returns the same collision-checked candidates as GH', () => {
        numeric(observations.initial_candidates, expected.initial_candidates);
    });
    for (const i of [0, 1]) {
        it(`forced step ${i + 1}: matches GH geometry, frames, rule tables and parenting`, () => {
            numeric(observations.chain[i], expected.chain[i]);
        });
    }
    for (const scope of ['connection', 'parent', 'aggregation']) {
        it(`${scope}: excludes disabled rule indices while retaining original ruleIndex values`, () => {
            const aggregation = fresh();
            aggregation.aggregated_parts[0].connections[0].active_rules = [1];
            const query = name => scope === 'connection'
                ? aggregation.getValidPlacementsAtConnection(name, 0, 0)
                : scope === 'parent' ? aggregation.getValidPlacementsAtParent(name, 0)
                    : aggregation.getValidPlacementsForPart(name);
            expect(query('B').filter(p => p.parentPartId === 0 && p.connectionId === 0)).toEqual([]);
            expect(query('D').filter(p => p.connectionId === 0).map(p => p.ruleIndex)).toEqual([1]);
        });
    }
    it('exposes only active rule entries on an open connection', () => {
        const aggregation = fresh();
        aggregation.aggregated_parts[0].connections[0].active_rules = [1];
        expect(aggregation.getOpenConnections().find(c => c.connectionId === 0).rules
            .map(r => r.partB)).toEqual(['D']);
    });
    it('uses the same active subset as GH and produces the same selected D placement', () => {
        numeric(observations.active_subset_candidates, expected.active_subset_candidates);
        numeric(observations.active_subset_state, expected.active_subset_state);
    });
    for (const reason of ['disabled_rule', 'wrong_direction', 'collision', 'unknown_part', 'consumed']) {
        it(`${reason}: rejects placement without changing placement, connectivity or mesh surface`, () => {
            const aggregation = reason === 'wrong_direction' ? fresh([new Rule('B', 1, 'A', 0)]) : fresh();
            if (reason === 'disabled_rule') aggregation.aggregated_parts[0].connections[0].active_rules = [1];
            if (reason === 'consumed') expect(aggregation.placePartAtConnection(0, 0, 'B', 1).success).toBe(true);
            const before = state(aggregation);
            const target = reason === 'collision' ? 'C' : reason === 'unknown_part' ? 'Unknown' : 'B';
            const result = aggregation.placePartAtConnection(0, 0, target, 1);
            expect(result.success).toBe(false);
            expect(state(aggregation)).toEqual(before);
        });
    }
    it('does not offer a consumed connection; GH reports its inactive sentinel instead', () => {
        expect(expected.consumed_connection).toBe(-1);
        expect(observations.consumed_connection).toEqual([]);
    });
});
