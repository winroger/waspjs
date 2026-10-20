/**
 * WaspJS — serialization utilities and JavaScript host adapters.
 *
 * Provenance labels below distinguish:
 * - GH-Wasp utility counterpart: named function in src/wasp/utilities/utilities.py.
 * - JS host-API adapter: replaces a Rhino operation used by the GH core.
 * - JS-specific helper: implementation supplied by WaspJS, not a GH utility port.
 * A counterpart identifies the source of the behavior, not complete parity.
 * GH plane serialization is implemented by Plane.fromData/toData in plane.js;
 * this module is not a complete port of the Python utilities module.
 */
import * as THREE from 'three';
import { Plane } from './plane.js';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';

// Compatibility re-export for existing source imports; implementation lives in operations.
export { generateRules } from '../operations/generateRules.js';


// JS-specific setup for Three.js raycasting; no GH-Wasp utility counterpart.
if (THREE.Mesh.prototype.raycast !== acceleratedRaycast) {
  THREE.Mesh.prototype.raycast = acceleratedRaycast;
}

// JS host-API adapter cache. Original attributes, indices and BVH caches stay owned
// by their callers. A new pose or a needsUpdate attribute rebuilds this CPU cache.
const collisionMeshes = new WeakMap();

/** JS host-API adapter: private model-space geometry/cache, not a GH utility. @internal */
function collisionMesh(mesh) {
    const source = mesh.geometry;
    const position = source.getAttribute('position');
    if (!position || position.count < 3 || (source.index && source.index.count < 3)) return null;
    const positionVersion = position.version ?? position.data?.version;
    const matrix = mesh.matrixAutoUpdate
        ? new THREE.Matrix4().compose(mesh.position, mesh.quaternion, mesh.scale)
        : mesh.matrix;
    const cached = collisionMeshes.get(mesh);
    if (cached && cached.source === source && cached.position === position
        && cached.positionVersion === positionVersion && cached.index === source.index
        && cached.indexVersion === source.index?.version && cached.matrix.equals(matrix)) return cached;

    // Use the single-precision representation of GH JSON mesh imports and Three
    // positions. Bake local placement; scene parents are presentation only.
    const geometry = new THREE.BufferGeometry();
    const placed = new THREE.BufferAttribute(new Float32Array(position.count * 3), 3);
    const vertex = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
        vertex.fromBufferAttribute(position, i).applyMatrix4(matrix);
        placed.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    geometry.setAttribute('position', placed);
    if (source.index) geometry.setIndex(source.index.clone());
    geometry.computeBoundingBox();
    const result = { source, position, positionVersion,
        index: source.index, indexVersion: source.index?.version,
        matrix: matrix.clone(), geometry, bounds: geometry.boundingBox, tree: null };
    collisionMeshes.set(mesh, result);
    return result;
}

/**
 * JS host-API adapter: Rhino Mesh.ClosestPoint in
 * src/wasp/core/aggregation.py::check_blocked_connections.
 * Distance to the surface, not containment, collider overlap or render raycasting.
 * Includes local model placement; scene parents are presentation only. Reuses
 * private BVH data without mutating source buffers, indices or boundsTree.
 * Mark edited position/index attributes needsUpdate before querying again.
 * Compatibility limitation: Float32 mesh coordinates and nondegenerate triangle
 * surfaces; this is not a general Rhino geometry adapter. Empty meshes are rejected
 * rather than reproducing GH's invalid closest-point result as a blocked slot.
 * @internal Not exported from the package entry point.
 * @param {THREE.Vector3} point Model-coordinate point
 * @param {THREE.Mesh} mesh
 * @returns {number} Closest surface distance
 * @throws {Error} The mesh has no queryable surface
 */
export function distanceToMesh(point, mesh) {
    const placed = collisionMesh(mesh);
    if (!placed) throw new Error('Cannot query an empty mesh surface');
    placed.tree ??= new MeshBVH(placed.geometry, { indirect: true });
    const result = placed.tree.closestPointToPoint(point);
    if (!result || !Number.isFinite(result.distance)) throw new Error('Cannot query an invalid mesh surface');
    return result.distance;
}

/**
 * Test mesh surfaces in model coordinates without changing either source mesh.
 * JS host-API adapter: Rhino Intersection.MeshMeshFast used by
 * src/wasp/core/colliders.py, implemented with the installed three-mesh-bvh.
 * Local placement is included; scene-parent transforms and render groups are not.
 * Strict bounds and omission of coplanar/degenerate triangle pairs reproduce the
 * measured GH cases. This is not a volume-containment or general contact test.
 * Compatibility limitation: single-precision boundary cases can differ from
 * first/repeated Rhino queries; a native coplanar asymmetry is deliberately not
 * reproduced. See collider.test.js for the measured cases and differences.
 * Mark edited position/index attributes needsUpdate before querying again.
 * @param {THREE.Mesh} mesh1
 * @param {THREE.Mesh} mesh2
 * @returns {boolean}
 */
export function checkMeshesIntersection(mesh1, mesh2) {
    const a = collisionMesh(mesh1);
    const b = collisionMesh(mesh2);
    if (!a || !b) return false;
    // GH's measured endpoint contacts do not overlap strict bounding intervals.
    for (const axis of ['x', 'y', 'z']) {
        if (a.bounds.max[axis] <= b.bounds.min[axis] || a.bounds.min[axis] >= b.bounds.max[axis]) return false;
    }
    a.tree ??= new MeshBVH(a.geometry, { indirect: true });
    b.tree ??= new MeshBVH(b.geometry, { indirect: true });
    const size = Math.max(1, Math.abs(a.bounds.min.x), Math.abs(a.bounds.min.y), Math.abs(a.bounds.min.z),
        Math.abs(a.bounds.max.x), Math.abs(a.bounds.max.y), Math.abs(a.bounds.max.z),
        Math.abs(b.bounds.min.x), Math.abs(b.bounds.min.y), Math.abs(b.bounds.min.z),
        Math.abs(b.bounds.max.x), Math.abs(b.bounds.max.y), Math.abs(b.bounds.max.z));
    const epsilon = Number.EPSILON * 128 * size;
    return a.tree.bvhcast(b.tree, new THREE.Matrix4(), {
        intersectsTriangles(first, second) {
            first.update();
            second.update();
            if (first.plane.normal.lengthSq() === 0 || second.plane.normal.lengthSq() === 0) return false;
            // Do not count overlapping coplanar surfaces. The distance threshold
            // only absorbs double arithmetic roundoff, not the Rhino doc tolerance.
            if (Math.abs(first.plane.normal.dot(second.plane.normal)) > 1 - 1e-12
                && Math.abs(first.plane.distanceToPoint(second.a)) <= epsilon
                && Math.abs(first.plane.distanceToPoint(second.b)) <= epsilon
                && Math.abs(first.plane.distanceToPoint(second.c)) <= epsilon) return false;
            return first.intersectsTriangle(second, null, true);
        }
    });
}

/**
 * Convert a mesh to plain vertex/face data with its local placement baked in.
 * Scene-parent transforms are presentation state, not part of the WASP data.
 * GH-Wasp utility counterpart: src/wasp/utilities/utilities.py::mesh_to_data.
 * JS adaptation: bake Three.js local placement because Rhino stores mesh vertices
 * in their placed coordinates; support indexed and non-indexed BufferGeometry.
 */
export function meshToData(mesh) {
  const geom = mesh.geometry;
  const data = { vertices: [], faces: [] };
  // Compose pending TRS without updating/mutating the mesh or its shared geometry.
  // Already placed inline geometry has an identity mesh matrix on import.
  const transform = mesh.matrixAutoUpdate
    ? new THREE.Matrix4().compose(mesh.position, mesh.quaternion, mesh.scale)
    : mesh.matrix;
  const vertex = new THREE.Vector3();

  if (geom.isBufferGeometry) {
    const pos = geom.getAttribute('position');
    const index = geom.getIndex();
    for (let i = 0; i < pos.count; i++) {
      data.vertices.push(vertex.fromBufferAttribute(pos, i).applyMatrix4(transform).toArray());
    }
    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        data.faces.push([index.getX(i), index.getX(i + 1), index.getX(i + 2)]);
      }
    } else {
      for (let i = 0; i < pos.count; i += 3) {
        data.faces.push([i, i + 1, i + 2]);
      }
    }
    return data;
  }

  // Legacy Geometry path
  geom.vertices.forEach(v => data.vertices.push(vertex.copy(v).applyMatrix4(transform).toArray()));
  geom.faces.forEach(f => {
    const face = [f.a, f.b, f.c];
    if (f.d !== undefined) face.push(f.d);
    data.faces.push(face);
  });
  return data;
}

/**
 * Create a mesh from plain vertex/face data.
 * GH-Wasp utility counterpart: src/wasp/utilities/utilities.py::mesh_from_data.
 * JS adaptation: triangulate quads for BufferGeometry, compute normals and create
 * a default rendering material. Rhino retains mesh quad faces.
 */
export function meshFromData(data) {
    const geometry = new THREE.BufferGeometry();

    const vertices = [];
    const indices = [];

    data.vertices.forEach(v => {
        vertices.push(v[0], v[1], v[2]);
    });

    data.faces.forEach(f => {
        if (f.length === 3) {
            indices.push(f[0], f[1], f[2]);
        } else if (f.length === 4) {
            indices.push(f[0], f[1], f[2], f[0], f[2], f[3]);
        }
    });
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);

    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });

    return new THREE.Mesh(geometry, material);
}

/**
 * Convert a Matrix4 to a plain object representation.
 * GH-Wasp utility counterpart: src/wasp/utilities/utilities.py::transform_to_data.
 * JS adaptation: map Three.js column-major storage to the shared M00..M33 fields.
 */
export function transformToData(trans) {
  const e = trans.elements; // column-major
  return {
    M00: e[0], M01: e[4], M02: e[8],  M03: e[12],
    M10: e[1], M11: e[5], M12: e[9],  M13: e[13],
    M20: e[2], M21: e[6], M22: e[10], M23: e[14],
    M30: e[3], M31: e[7], M32: e[11], M33: e[15]
  };
}

/**
 * Rebuild a Matrix4 from plain object data.
 * GH-Wasp utility counterpart: src/wasp/utilities/utilities.py::transform_from_data.
 * JS adaptation: Matrix4.set accepts row-ordered arguments and stores columns.
 */
export function transformFromData(data) {
  const m = [
    parseFloat(data.M00), parseFloat(data.M01), parseFloat(data.M02), parseFloat(data.M03),
    parseFloat(data.M10), parseFloat(data.M11), parseFloat(data.M12), parseFloat(data.M13),
    parseFloat(data.M20), parseFloat(data.M21), parseFloat(data.M22), parseFloat(data.M23),
    parseFloat(data.M30), parseFloat(data.M31), parseFloat(data.M32), parseFloat(data.M33)
  ];

  const matrix = new THREE.Matrix4();
  matrix.set(
    m[0], m[1], m[2], m[3],
    m[4], m[5], m[6], m[7],
    m[8], m[9], m[10], m[11],
    m[12], m[13], m[14], m[15]
  );

  return matrix;
}

/**
 * Calculate a transform that orients sourcePlane to targetPlane.
 * JS host-API adapter: Rhino.Geometry.Transform.PlaneToPlane, called directly by
 * src/wasp/core/aggregation.py; no standalone function in GH-Wasp utilities.
 * Computes targetBasis * inverse(sourceBasis); rigid-frame parity is measured in
 * planeCompatibility.test.js, not general affine-transform parity.
 */
export function PlaneToPlane(sourcePlane, targetPlane) {
    const sourceMatrix = new THREE.Matrix4();
    sourceMatrix.makeBasis(
        sourcePlane.xaxis.clone().normalize(),
        sourcePlane.yaxis.clone().normalize(),
        sourcePlane.zaxis.clone().normalize()
    );
    sourceMatrix.setPosition(sourcePlane.origin.clone());

    const targetMatrix = new THREE.Matrix4();
    targetMatrix.makeBasis(
        targetPlane.xaxis.clone().normalize(),
        targetPlane.yaxis.clone().normalize(),
        targetPlane.zaxis.clone().normalize()
    );
    targetMatrix.setPosition(targetPlane.origin.clone());

    const transformMatrix = new THREE.Matrix4();
    transformMatrix.copy(targetMatrix).multiply(sourceMatrix.invert());

    return transformMatrix;
}


// ==================== Internal JS host-API adapters ====================

/**
 * Transform a typed GH JSON geometry value without changing its source record.
 * JS host-API adapter: Rhino geometry copy/Transform in attributes.py::Attribute.
 * This is not an original Python utility. Static/unknown payloads are not inferred.
 * @internal Not exported from the public package entry point.
 * @param {import('../types/index.js').AttributeValueData} record
 * @param {THREE.Matrix4} transform Positive rigid placement in model units
 * @returns {import('../types/index.js').AttributeValueData}
 */
export function transformAttributeValue(record, transform) {
    if (!record || record.valid !== true || !['Point', 'Line', 'Plane', 'Mesh'].includes(record.type)) {
        throw new Error(`Unsupported transformable attribute value: ${record?.type ?? 'untyped/invalid'}`);
    }
    const e = transform?.elements;
    if (!e || e.length !== 16 || !e.every(Number.isFinite)
        || Math.abs(transform.determinant() - 1) > 1e-5
        || [0, 4, 8].some(i => Math.abs(e[i] ** 2 + e[i + 1] ** 2 + e[i + 2] ** 2 - 1) > 1e-5)
        || [e[3], e[7], e[11], e[15] - 1].some(v => Math.abs(v) > 1e-5)) {
        throw new Error('Attribute geometry currently supports positive rigid transforms only');
    }
    const result = globalThis.structuredClone(record);
    const point = values => {
        if (!Array.isArray(values) || values.length !== 3 || !values.every(Number.isFinite)) {
            throw new Error('Invalid attribute point coordinates');
        }
        return new THREE.Vector3(...values).applyMatrix4(transform).toArray();
    };
    if (record.type === 'Point') result.value = point(record.value);
    else if (record.type === 'Line') {
        result.value.from = point(record.value.from);
        result.value.to = point(record.value.to);
    } else if (record.type === 'Plane') {
        const placed = Plane.fromData(record.value).applyMatrix4onPlane(transform).toData();
        result.value = { ...result.value, ...placed };
        if (!Object.hasOwn(record.value, 'zaxis')) delete result.value.zaxis;
    } else {
        if (!Array.isArray(record.value?.vertices) || !Array.isArray(record.value?.faces)) {
            throw new Error('Invalid attribute mesh data');
        }
        result.value.vertices = record.value.vertices.map(point);
    }
    return result;
}

/**
 * Copy a core mesh with independent geometry buffers, preserving local placement.
 * JS host-API adapter: Rhino Mesh.Duplicate used by src/wasp/core/parts.py and
 * colliders.py; there is no corresponding GH-Wasp utility function.
 * Three.js Mesh.clone() alone shares geometry; BufferGeometry.clone() copies its
 * index, attributes and bounds without carrying over a geometry-bound BVH cache.
 * Material objects retain Three.js sharing semantics. Viewer children and custom
 * geometry userData are outside this core geometry-ownership contract.
 * @internal Exported for core-module imports, excluded from the package entry point.
 * @param {THREE.Mesh} mesh
 * @returns {THREE.Mesh}
 */
export function copyMesh(mesh) {
    const copy = mesh.clone();
    copy.geometry = mesh.geometry.clone();
    return copy;
}

/**
 * Compute the area-weighted centroid of a BufferGeometry mesh's triangles.
 * JS host-API adapter: Rhino AreaMassProperties.Compute(mesh).Centroid, used by
 * src/wasp/core/parts.py. This is a centroid calculation, not an AreaMass port.
 * Uses local mesh placement, excluding scene parents, as meshToData does.
 * Areas are measured after placement so nonuniform scale reweights faces.
 * Zero-area meshes return the origin, matching the measured Rhino cases.
 * @internal Not exported from the package entry point.
 * @param {THREE.Mesh} mesh
 * @returns {THREE.Vector3}
 */
export function meshAreaCentroid(mesh) {
    const position = mesh.geometry.getAttribute('position');
    const index = mesh.geometry.getIndex();
    const centroid = new THREE.Vector3();
    if (!position) return centroid;
    const transform = mesh.matrixAutoUpdate
        ? new THREE.Matrix4().compose(mesh.position, mesh.quaternion, mesh.scale)
        : mesh.matrix;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const ab = new THREE.Vector3(), ac = new THREE.Vector3();
    const count = index ? index.count : position.count;
    let totalArea = 0;
    for (let i = 0; i + 2 < count; i += 3) {
        a.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(transform);
        b.fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1).applyMatrix4(transform);
        c.fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2).applyMatrix4(transform);
        const area = ab.subVectors(b, a).cross(ac.subVectors(c, a)).length();
        centroid.addScaledVector(a, area).addScaledVector(b, area).addScaledVector(c, area);
        totalArea += area;
    }
    // Twice-area weights cancel; each triangle's centroid is (a + b + c) / 3.
    return totalArea > 0 ? centroid.divideScalar(3 * totalArea) : centroid.set(0, 0, 0);
}
