/**
 * WaspJS — rule-generation operation.
 * Upstream component: src/ghComp/Wasp_Rules Generator.py::main.
 * Provides its domain logic without Grasshopper UI or component state.
 */
import { Rule } from '../core/rule.js';

/**
 * Generate connection rules for a set of parts when none are provided.
 * GH-Wasp component counterpart: src/ghComp/Wasp_Rules Generator.py::main,
 * not a function in the GH core utilities module. Grasshopper UI is omitted.
 * Self-connection means equal connection IDs, including across different parts,
 * matching the component. Defaults and explicit null flags use GH defaults.
 * @param {import('../core/part.js').Part[]} parts
 * @param {boolean|null} [selfPart=true]
 * @param {boolean|null} [selfConnection=true]
 * @param {boolean|null} [useTypes=false]
 * @param {string[]} [grammar=[]] Directed type pairs such as 'x>y'
 * @returns {Rule[]}
 */
export function generateRules(parts, selfPart = true, selfConnection = true, useTypes = false, grammar = []) {
    selfPart ??= true;
    selfConnection ??= true;
    useTypes ??= false;
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
