/**
 * WaspJS — directed Rule data.
 * Upstream: src/wasp/core/rules.py; reader defect is intentionally not reproduced.
 */
/**
 * Represents a connection rule between two parts and their connection indices.
 */
export class Rule {
    /**
     * @param {string} partA
     * @param {number} connectionA
     * @param {string} partB
     * @param {number} connectionB
     * @param {boolean} [active=true] Stored rule flag, as in GH-Wasp
     */
    constructor(partA, connectionA, partB, connectionB, active = true) {
      this.partA = partA;
      this.connectionA = connectionA;
      this.partB = partB;
      this.connectionB = connectionB;
      this.active = active;
    }

    /**
     * Build a rule from serialized data.
     * @param {import('../types').RuleData} data
     * @returns {Rule}
     */
    static fromData(data) {
      // GH-Wasp difference: its pinned reader duplicates part1/conn1 at both ends.
      // Preserve the intended second endpoint; normalize valid integer IDs as GH does.
      const rule = new Rule(data.part1, parseInt(data.conn1, 10), data.part2, parseInt(data.conn2, 10));
      rule.active = data.active;
      return rule;
    }

    /**
     * Serialize the rule.
     * @returns {import('../types').RuleData}
     */
    toData() {
      return {
        part1: this.partA,
        conn1: this.connectionA,
        part2: this.partB,
        conn2: this.connectionB,
        active: this.active,
      };
    }
}
