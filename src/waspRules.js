export class Rule {
    constructor(partA, connectionA, partB, connectionB) {
      this.partA = partA;
      this.connectionA = connectionA;
      this.partB = partB;
      this.connectionB = connectionB;
      this.active = true;
    }

    fromData(data) { 
      return {
        partA: data.part1,
        connectionA: data.conn1,
        partB: data.part2,
        connectionB: data.conn2,
        active: data.active
      }
    }
}