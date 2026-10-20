/**
 * WaspJS — right-handed connection frames.
 * Upstream reference: src/wasp/utilities/utilities.py (plane_from_data)
 */
import * as THREE from 'three';

/**
 * Right-handed orthonormal frame: X cross Y = Z.
 * Local axes are independent of the viewer's camera-up direction.
 */
export class Plane {
    /**
     * @param {THREE.Vector3} origin
     * @param {THREE.Vector3} xaxis
     * @param {THREE.Vector3} zaxis
     * @throws {TypeError} A vector contains non-finite coordinates
     * @throws {RangeError} Axes are zero or collinear
     */
    constructor(origin, xaxis, zaxis) {
        requireFiniteVector(origin, 'origin');
        requireFiniteVector(xaxis, 'xaxis');
        requireFiniteVector(zaxis, 'zaxis');
        if (xaxis.lengthSq() === 0 || zaxis.lengthSq() === 0) {
            throw new RangeError('Invalid plane axes: xaxis and zaxis must be non-zero');
        }
        this.origin = origin.clone();
        this.xaxis = xaxis.clone().normalize();
        this.zaxis = zaxis.clone().normalize();
        this.yaxis = new THREE.Vector3().crossVectors(this.zaxis, this.xaxis);
        if (this.yaxis.lengthSq() === 0) {
            throw new RangeError('Invalid plane axes: xaxis and zaxis are collinear');
        }
        this.yaxis.normalize();
        // Keep the frame orthonormal when the supplied directions are not unit axes.
        this.zaxis.crossVectors(this.xaxis, this.yaxis).normalize();
    }

    /** @returns {Plane} Independent copy of the frame vectors */
    clone() {
        return new Plane(this.origin.clone(), this.xaxis.clone(), this.zaxis.clone());
    }
    
    /**
     * Return a transformed copy; does not mutate this plane.
     * Compatibility limitation: GH parity is measured for rigid transforms only.
     * @param {THREE.Matrix4} matrix
     * @returns {Plane}
     */
    applyMatrix4onPlane(matrix) {
        let newPlane = this.clone();
    
        newPlane.origin.applyMatrix4(matrix);
        const rotationMatrix = new THREE.Matrix4().extractRotation(matrix);
    
        newPlane.xaxis.applyMatrix4(rotationMatrix).normalize();
        newPlane.yaxis.applyMatrix4(rotationMatrix).normalize();
        newPlane.zaxis.applyMatrix4(rotationMatrix).normalize();
    
        return newPlane;
    }

    /**
     * Serialize the canonical right-handed axes, retaining the existing XYZ fields.
     * Compatibility limitation: old WaspJS readers prioritize Z and reverse Y for
     * this corrected XYZ representation. See API.md "Connection frames".
     * @returns {object} Origin and X/Y/Z arrays
     */
    toData() {
        return {
            origin: [this.origin.x, this.origin.y, this.origin.z],
            xaxis: [this.xaxis.x, this.xaxis.y, this.xaxis.z],
            yaxis: [this.yaxis.x, this.yaxis.y, this.yaxis.z],
            zaxis: [this.zaxis.x, this.zaxis.y, this.zaxis.z]
        };
    }

    /**
     * Build a right-handed frame from GH X/Y or JavaScript X/Z data.
     *
     * X/Y is authoritative when both are present, as in the GH reader. A redundant
     * Z may agree or be its opposite (old WaspJS exports); the latter is explicitly
     * normalized to X cross Y. Other contradictory third axes are rejected.
     * GH-Wasp difference: GH ignores redundant Z; JS validates it to detect corrupt
     * mixed-axis payloads while accepting the known legacy opposite-Z convention.
     * X/Z-only data uses the supplied normal with the corrected constructor.
     * @param {object} data Serialized origin and axes
     * @returns {Plane}
     * @throws {TypeError} Required coordinates are missing or non-finite
     * @throws {RangeError} Axes are degenerate or the redundant Z is unrelated
     */
    static fromData(data) {
        const origin = readVector(data.origin, 'origin');
        const xaxis = readVector(data.xaxis, 'xaxis');

        let zaxis;
        if (data.yaxis !== undefined) {
            const yaxis = readVector(data.yaxis, 'yaxis');
            zaxis = new THREE.Vector3().crossVectors(xaxis, yaxis);
            if (zaxis.lengthSq() === 0) {
                throw new RangeError('Invalid plane data: xaxis and yaxis are collinear');
            }
            zaxis.normalize();
            if (data.zaxis !== undefined) {
                const suppliedZ = readVector(data.zaxis, 'zaxis');
                if (suppliedZ.lengthSq() === 0
                    || 1 - Math.abs(suppliedZ.normalize().dot(zaxis)) > 1e-6) {
                    throw new RangeError('Invalid plane data: zaxis must align with the X/Y normal');
                }
            }
        } else if (data.zaxis !== undefined) {
            zaxis = readVector(data.zaxis, 'zaxis');
        } else {
            throw new TypeError('Invalid plane data: expected yaxis or zaxis');
        }
        
        return new Plane(origin, xaxis, zaxis);
    }
}

function requireFiniteVector(value, name) {
    if (!value || ![value.x, value.y, value.z].every(Number.isFinite)) {
        throw new TypeError(`Invalid plane ${name}: expected three finite coordinates`);
    }
}

function readVector(value, name) {
    if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
        throw new TypeError(`Invalid plane ${name}: expected three finite coordinates`);
    }
    return new THREE.Vector3().fromArray(value);
}
