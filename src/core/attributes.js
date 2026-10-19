/**
 * WaspJS — Attribute class.
 * Upstream module: src/wasp/core/attributes.py.
 * Values use typed GH JSON records rather than Rhino runtime objects.
 * SmartAttribute validity and InternalTransform are separate deferred features.
 */
import { transformAttributeValue } from './utilities.js';

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

    /** @param {import('../types/index.js').AttributeData} data @returns {Attribute} */
    static fromData(data) {
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
