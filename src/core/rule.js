/**
 * Represents a connection rule between two parts and their connection indices.
 */
export class Rule {
    /**
     * @param {string} partA
     * @param {number} connectionA
     * @param {string} partB
     * @param {number} connectionB
     */
    constructor(partA, connectionA, partB, connectionB) {
      this.partA = partA;
      this.connectionA = connectionA;
      this.partB = partB;
      this.connectionB = connectionB;
      this.active = true;
    }

    /**
     * Build a rule from serialized data.
     * @param {import('../types').RuleData} data
     * @returns {Rule}
     */
    static fromData(data) {
      const rule = new Rule(data.part1, data.conn1, data.part2, data.conn2);
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