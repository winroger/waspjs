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

  export function genRulesFromData(data) {
    const rules = [];
    data.forEach(rule => {
      rules.push(new Rule().fromData(rule));
    });
    return rules;
  }

  
  export function generateRules(parts, selfPart = true, selfConnection = false, useTypes = false, grammar = []) {
    const rules = [];
  
    if (grammar.length === 0) {
      for (const part of parts) {
        for (const conn of part.connections) {
          for (const otherPart of parts) {
            let skipPart = false;
            if (!selfPart && part.name === otherPart.name) {
              skipPart = true;
            }
  
            if (!skipPart) {
              for (const otherConn of otherPart.connections) {
                let skipConn = false;
                if (!selfConnection && conn.id === otherConn.id) {
                  skipConn = true;
                }
  
                if (!skipConn) {
                  if (useTypes) {
                    if (conn.type === otherConn.type) {
                      rules.push(new Rule(part.name, conn.id, otherPart.name, otherConn.id));
                    }
                  } else {
                    rules.push(new Rule(part.name, conn.id, otherPart.name, otherConn.id));
                  }
                }
              }
            }
          }
        }
      }
    } else {
      for (const gr_rule of grammar) {
        const [startType, endType] = gr_rule.split(">");
        for (const part of parts) {
          for (const conn of part.connections) {
            if (conn.type === startType) {
              for (const otherPart of parts) {
                let skipPart = false;
                if (!selfPart && part.name === otherPart.name) {
                  skipPart = true;
                }
  
                if (!skipPart) {
                  for (const otherConn of otherPart.connections) {
                    if (otherConn.type === endType) {
                      let skipConn = false;
                      if (!selfConnection && conn.id === otherConn.id) {
                        skipConn = true;
                      }
  
                      if (!skipConn) {
                        rules.push(new Rule(part.name, conn.id, otherPart.name, otherConn.id));
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  
    return rules;
  }
  