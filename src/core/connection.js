/**
 * WaspJS — Connection class and rule-table assignment.
 * Upstream module: src/wasp/core/connection.py
 */
import { Plane } from './plane.js';


/**
 * Connects a part via a plane and type descriptor.
 */
export class Connection {
    /**
     * @param {Plane} _plane
     * @param {string} _type
     * @param {string} _part
     * @param {number} _id
     */
    constructor(_plane, _type, _part, _id) {
        this.pln = _plane.clone();
        const tempPlane = this.pln.clone();
        // Preserve X and reverse Y/Z, matching GH's Plane(origin, X, -Y).
        this.flip_pln = new Plane(tempPlane.origin, tempPlane.xaxis, tempPlane.zaxis.clone().multiplyScalar(-1));

        this.type = _type;
        this.part = _part;
        this.id = _id;

        this.rules_table = [];
        this.active_rules = [];
    }

    /**
     * Read a connection frame and parse its ID as an integer.
     * @param {import('../types/index.js').ConnectionData} data
     * @returns {Connection}
     */
    static fromData(data) {
        let c_pln =  Plane.fromData(data['plane']);
        return new Connection(c_pln, data['type'], data['part'], parseInt(data['id']));
    }

    /**
     * Serialize the frame, type and owner; transient rule tables are excluded.
     * @returns {import('../types/index.js').ConnectionData}
     */
    toData() {
        return {
            plane: this.pln.toData(),
            type: this.type,
            part: this.part,
            id: this.id
        };
    }

    /**
     * Return a new connection with a transformed independent frame.
     * Rule tables are reset on the result; this connection is unchanged.
     * @param {import('three').Matrix4} trans
     * @returns {Connection}
     */
    transform(trans) {
        let newPlane = this.pln.applyMatrix4onPlane(trans);
        return new Connection(newPlane, this.type, this.part, this.id);
    }

    /**
     * Copy both frames via construction; rule tables start empty.
     * @returns {Connection}
     */
    copy() {
        let pln_copy = this.pln.clone()
        return new Connection(pln_copy, this.type, this.part, this.id);
    }

    /**
     * Match GH Connection.generate_rules_table: retain matching rules in order.
     * Rule.active is stored metadata here; active_rules holds usable table indices.
     * @param {import('./rule.js').Rule[]} rules
     * @returns {void}
     */
    generateRulesTable(rules) {
        let count = 0;
        this.rules_table = [];
        this.active_rules = [];

        rules.forEach(rule => {
            if (rule.partA === this.part && rule.connectionA === this.id) {
                this.rules_table.push(rule);
                this.active_rules.push(count);
                count += 1;
            }
        });
    }
}
