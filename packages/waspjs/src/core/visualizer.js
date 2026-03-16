import * as THREE from 'three';
import CameraControls from 'camera-controls';

CameraControls.install({ THREE: THREE });

/**
 * Minimal Three.js scene wrapper for rendering aggregated parts.
 */
export class Visualizer {
  constructor(containerId = '#threejs-container', parentContainerId = '#threejs-container-parent') {
    this.container = typeof containerId === 'string'
      ? document.querySelector(containerId)
      : containerId;
    this.parentContainer = typeof parentContainerId === 'string'
      ? document.querySelector(parentContainerId)
      : parentContainerId;

    if (!this.container) {
      console.error('Container element not found.');
      return;
    }

    this.width = this.parentContainer.clientWidth;
    this.height = this.parentContainer.clientHeight;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 5000);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(250, 150, 100);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0); // transparent Background
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();

    this.cameraControls = new CameraControls(this.camera, this.renderer.domElement);
    this.cameraControls.minDistance = 20;
    this.cameraControls.maxDistance = 350;
    this.cameraControls.update();

    this.scene.userData = { camera: this.camera, controls: this.cameraControls };

    // Raycasting support
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    // Ghost meshes for manual placement previews
    this._ghostMeshes = [];
    this._ghostData = [];  // parallel array of placement metadata
    this._ghostGroup = new THREE.Group();
    this._ghostGroup.name = '__ghost_group__';
    this.scene.add(this._ghostGroup);



    this.initLights();
    //this.addAxesHelper(); // Add the axis helper
    this.animate();

    // Make variables available to browser console
    globalThis.THREE = THREE;
    globalThis.cameraControls = this.cameraControls;

    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  initLights() {
    const directionalLight = new THREE.DirectionalLight(0xffffff, 5);
    directionalLight.position.set(30, 30, -30);
    this.scene.add(directionalLight);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight2.position.set(30, 30, 30);
    this.scene.add(directionalLight2);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    this.scene.add(ambientLight);
  }

  addAxesHelper() {
    const gridHelper = new THREE.GridHelper(100, 9);
    gridHelper.rotation.x = Math.PI / 2; // Rotate by 90 degrees on the x-axis
    const axesHelper = new THREE.AxesHelper(10); // Adjust the size as needed
    axesHelper.rotation.x = Math.PI / 2; 
    this.scene.add(gridHelper);
    this.scene.add(axesHelper);
  }

  animate() {
    const delta = this.clock.getDelta();
    this.cameraControls.update(delta);

    // Add rotation if there are no user interactions
    /*if (!hasControlsUpdated) {
      this.scene.rotation.z += 0.001; // Adjust the rotation speed as needed
    }*/

    requestAnimationFrame(this.animate.bind(this));
    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    const newWidth = this.parentContainer.clientWidth;
    const newHeight = this.parentContainer.clientHeight;
    this.camera.aspect = newWidth / newHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(newWidth, newHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio); // Ensure pixel ratio is updated on resize
    this.container.style.width = `${newWidth}px`;
    this.container.style.height = `${newHeight}px`;
  }

  addEntity(part) {
    const mesh = part.geo.clone();
    mesh.name = `${part.name}_${part.id}`;
    this.scene.add(mesh);
  }

  removeEntity(object) {
    var selectedObject = this.scene.getObjectByName(`${object.name}_${object.id}`);
    if (selectedObject) {
      this.scene.remove(selectedObject);
    } else {
      console.log("Object not found:", `${object.name}_${object.id}`);
    }
  }

  // ── Raycasting ──────────────────────────────────────────────

  /**
   * Raycast from a pointer event against placed part meshes (excludes ghosts).
   * @param {{ clientX: number, clientY: number }} event
   * @returns {{ object: THREE.Object3D, point: THREE.Vector3, partId: number|null }|null}
   */
  raycastParts(event) {
    if (!this.renderer) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);

    const meshes = [];
    this.scene.traverse(obj => {
      if (obj.isMesh && obj.parent !== this._ghostGroup) {
        meshes.push(obj);
      }
    });

    const intersects = this.raycaster.intersectObjects(meshes, false);
    if (intersects.length === 0) return null;

    const hit = intersects[0];
    const nameParts = hit.object.name.split('_');
    const partId = nameParts.length >= 2 ? parseInt(nameParts[nameParts.length - 1], 10) : null;
    return { object: hit.object, point: hit.point, partId: isNaN(partId) ? null : partId };
  }

  /**
   * Raycast from a pointer event against ghost meshes only.
   * @param {{ clientX: number, clientY: number }} event
   * @returns {{ index: number, point: THREE.Vector3 }|null}
   */
  raycastGhosts(event) {
    if (!this.renderer || this._ghostMeshes.length === 0) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObjects(this._ghostMeshes, false);
    if (intersects.length === 0) return null;

    const hit = intersects[0];
    const index = this._ghostMeshes.indexOf(hit.object);
    return { index, data: this._ghostData[index] ?? null, point: hit.point };
  }

  // ── Ghost Meshes ────────────────────────────────────────────

  /**
   * Display semi-transparent ghost meshes for manual placement previews.
   * Each placement must have a `transformedPart` with a `.geo` mesh.
   * @param {Array<{ transformedPart: { geo: THREE.Mesh } }>} placements
   */
  addGhostMeshes(placements) {
    this.clearGhostMeshes();
    for (const placement of placements) {
      const mesh = placement.transformedPart.geo.clone();
      mesh.material = mesh.material.clone();
      mesh.material.transparent = true;
      mesh.material.opacity = 0.3;
      mesh.material.depthWrite = false;
      mesh.name = `__ghost_${this._ghostMeshes.length}`;
      this._ghostGroup.add(mesh);
      this._ghostMeshes.push(mesh);
      this._ghostData.push(placement);
    }
  }

  /**
   * Remove all ghost meshes from the scene.
   */
  clearGhostMeshes() {
    for (const mesh of this._ghostMeshes) {
      this._ghostGroup.remove(mesh);
      mesh.geometry?.dispose();
      mesh.material?.dispose();
    }
    this._ghostMeshes = [];
    this._ghostData = [];
  }

  /**
   * Highlight a specific ghost mesh by index.
   * @param {number} index
   */
  highlightGhost(index) {
    this.unhighlightGhosts();
    if (index >= 0 && index < this._ghostMeshes.length) {
      this._ghostMeshes[index].material.opacity = 0.7;
      if (this._ghostMeshes[index].material.emissive) {
        this._ghostMeshes[index].material.emissive.setHex(0x444444);
      }
    }
  }

  /**
   * Reset all ghost meshes to default appearance.
   */
  unhighlightGhosts() {
    for (const mesh of this._ghostMeshes) {
      mesh.material.opacity = 0.3;
      if (mesh.material.emissive) {
        mesh.material.emissive.setHex(0x000000);
      }
    }
  }
}