/**
 * WaspJS — Attribute and SmartAttribute classes.
 * Upstream module: src/wasp/core/attributes.py.
 * Values use typed GH JSON records rather than Rhino runtime objects.
 * SmartAttribute validity is evaluated by the getValidSmartAttributes operation.
 * InternalTransform remains outside the supported attribute contract.
 */
import { transformAttributeValue } from './utilities.js';
import { Connection } from './connection.js';

// ==================== Attribute ====================

/** Stores named typed values and whether they follow a Part's placement. */
export class Attribute {
    /**
     * @param {string} name
     * @param {import('../types/index.js').AttributeValueData[]} values Typed JSON records
     * @param {boolean} transformable
     */
    constructor(name, values, transformable) {
        if (!Array.isArray(values) || typeof transformable !== 'boolean') {
            throw new TypeError('Attribute requires an array of values and a boolean transformable flag');
        }
        this.name = name;
        this.values = globalThis.structuredClone(values);
        this.transformable = transformable;
        this._extraData = {};
    }

    /** @param {import('../types/index.js').AttributeData|import('../types/index.js').SmartAttributeData} data @returns {Attribute|SmartAttribute} */
    static fromData(data) {
        if (data.class_type === 'SmartAttribute') return SmartAttribute.fromData(data);
        if (data.class_type !== 'Attribute') throw new Error(`Unsupported attribute class: ${data.class_type}`);
        const attribute = new Attribute(data.name, data.values, data.transformable);
        attribute._extraData = globalThis.structuredClone(Object.fromEntries(Object.entries(data)
            .filter(([key]) => !['class_type', 'name', 'values', 'transformable'].includes(key))));
        return attribute;
    }

    /** @returns {import('../types/index.js').AttributeData} Independent transport snapshot */
    toData() {
        return { ...globalThis.structuredClone(this._extraData), class_type: 'Attribute', name: this.name,
            values: globalThis.structuredClone(this.values), transformable: this.transformable };
    }

    /**
     * Return a transformed copy; supported geometry is Point, Line, Plane, Mesh.
     * @param {import('three').Matrix4} transform Positive rigid placement in model units
     * @returns {Attribute}
     * @throws {Error} A transformable value or matrix is outside the supported contract
     */
    transform(transform) {
        const data = this.toData();
        if (this.transformable) data.values = data.values.map(value => transformAttributeValue(value, transform));
        return Attribute.fromData(data);
    }

    /**
     * GH-Wasp difference: static JSON values are independent too; GH aliases them.
     * Opaque payloads can be copied without claiming geometry support.
     * @returns {Attribute}
     */
    copy() {
        return Attribute.fromData(this.toData());
    }
}

// ==================== SmartAttribute ====================

/**
 * Attribute with a mask referring to Part connection indices through Connection.id.
 * Connections identify attachment slots; their frames stay unchanged on transform,
 * matching GH. Validity uses the placed Part's connections, not these stored frames.
 */
export class SmartAttribute extends Attribute {
    /**
     * @param {string} name
     * @param {import('../types/index.js').AttributeValueData[]} values
     * @param {boolean} transformable
     * @param {Array<Connection|import('../types/index.js').ConnectionData>} [connections=[]]
     * @param {number[]} [connMask=[]] 1 requires free, -1 blocked, 0 ignores a slot
     * @throws {Error} A mask or connection ID is outside the supported contract
     */
    constructor(name, values, transformable, connections = [], connMask = []) {
        super(name, values, transformable);
        if (!Array.isArray(connections) || !Array.isArray(connMask)
            || connMask.length > connections.length
            || connMask.some(value => ![-1, 0, 1].includes(value))) {
            // GH-Wasp difference: reject malformed masks instead of ignoring values
            // or failing later inside the component's positional loop.
            throw new Error('Invalid SmartAttribute connection mask');
        }
        this._connectionData = globalThis.structuredClone(connections.map(connection =>
            connection instanceof Connection ? connection.toData() : connection));
        if (this._connectionData.some(data => {
            const id = typeof data?.id === 'string' && /^\d+$/.test(data.id) ? Number(data.id) : data?.id;
            return !Number.isSafeInteger(id) || id < 0;
        })) {
            throw new Error('Invalid SmartAttribute connection ID');
        }
        this.connections = this._connectionData.map(data => Connection.fromData(data));
        // GH-Wasp difference: independent connections, mask and values on copy.
        this.conn_mask = [...connMask];
    }

    /** @param {import('../types/index.js').SmartAttributeData} data @returns {SmartAttribute} */
    static fromData(data) {
        if (data.class_type !== 'SmartAttribute') throw new Error(`Unsupported attribute class: ${data.class_type}`);
        if (!Array.isArray(data.connections) || !Array.isArray(data.conn_mask)) {
            throw new Error('SmartAttribute requires connections and conn_mask arrays');
        }
        const attribute = new SmartAttribute(data.name, data.values, data.transformable, data.connections, data.conn_mask);
        attribute._extraData = globalThis.structuredClone(Object.fromEntries(Object.entries(data)
            .filter(([key]) => !['class_type', 'name', 'values', 'transformable', 'connections', 'conn_mask'].includes(key))));
        return attribute;
    }

    /** @returns {import('../types/index.js').SmartAttributeData} Independent transport snapshot */
    toData() {
        return { ...super.toData(), class_type: 'SmartAttribute',
            connections: this.connections.map((connection, i) => {
                const extra = globalThis.structuredClone(this._connectionData[i] ?? {});
                const data = connection.toData();
                return { ...extra, ...data, plane: { ...extra.plane, ...data.plane } };
            }), conn_mask: [...this.conn_mask] };
    }
}

/**
 * Preserve Part's existing JSON-array API; accept explicit Attribute instances.
 * @internal Not part of the package entry point.
 * @param {Array<unknown>} attributes
 * @returns {Array<unknown>}
 */
export function copyAttributes(attributes) {
    return globalThis.structuredClone((attributes ?? []).map(value => value instanceof Attribute ? value.toData() : value));
}

/**
 * Transform declared core Attributes, preserving opaque metadata without guessing.
 * @internal Not part of the package entry point.
 * @param {Array<unknown>} attributes
 * @param {import('three').Matrix4} transform
 * @returns {Array<unknown>}
 */
export function transformAttributes(attributes, transform) {
    return copyAttributes(attributes).map(value => {
        if (!value || typeof value !== 'object' || !value.class_type || value.transformable !== true) return value;
        return Attribute.fromData(value).transform(transform).toData();
    });
}
