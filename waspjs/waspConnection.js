class Connection {
    constructor(_plane, _type, _part, _id) {
        this.pln = _plane.clone();
        const tempPlane = this.pln.clone();
        this.flip_pln = new Plane(tempPlane.origin, tempPlane.xaxis, tempPlane.yaxis.clone().multiplyScalar(-1));

        this.type = _type;
        this.part = _part;
        this.id = _id;

        this.rules_table = [];
        this.active_rules = [];
    }

    static fromData(data) {
        let c_pln = planeFromData(data['plane']);
        return new Connection(c_pln, data['type'], data['part'], parseInt(data['id']));
    }

    toData() {
        return {
            plane: planeToData(this.pln),
            type: this.type,
            part: this.part,
            id: this.id
            // rules_table and active_rules NOT IMPLEMENTED
        };
    }

    transform(trans) {
        let newPlane = this.pln.applyMatrix4onPlane(trans);
        return new Connection(newPlane, this.type, this.part, this.id);
    }

    copy() {
        let pln_copy = this.pln.clone()
        return new Connection(pln_copy, this.type, this.part, this.id);
    }

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