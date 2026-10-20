/**
 * WaspJS — minimal Z-up Three.js browser viewer.
 * JS-specific host layer; requires DOM/WebGL and is not a GH core class.
 */
import * as THREE from 'three';
import * as CameraControlsModule from 'camera-controls';

const CameraControls =
  CameraControlsModule.default?.default?.install
    ? CameraControlsModule.default.default
    : CameraControlsModule.default?.install
      ? CameraControlsModule.default
      : CameraControlsModule;

CameraControls.install({ THREE });

function resolveElement(target) {
  if (typeof target === 'string') {
    return document.querySelector(target);
  }
  return target ?? null;
}

/**
 * Minimal Three.js scene wrapper for rendering aggregated parts.
 */
export class Visualizer {
  /**
   * Create a Z-up browser scene and start its animation/resize lifecycle.
   * Requires a DOM, a container and WebGL. Call dispose() on teardown.
   * @param {string|HTMLElement} [containerId='#threejs-container'] CSS selector or element
   * @param {string|HTMLElement} [parentContainerId=containerId] Sizing element or selector
   * @throws {Error} No container can be resolved or WebGL renderer creation fails
   */
  constructor(containerId = '#threejs-container', parentContainerId = containerId) {
    this.container = resolveElement(containerId);
    this.parentContainer = resolveElement(parentContainerId) || this.container;

    if (!this.container) {
      throw new Error('Visualizer container element not found.');
    }
    if (!this.parentContainer) {
      throw new Error('Visualizer parent container element not found.');
    }

    this.width = Math.max(this.parentContainer.clientWidth || this.container.clientWidth || 1, 1);
    this.height = Math.max(this.parentContainer.clientHeight || this.container.clientHeight || 1, 1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 5000);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(250, 150, 100);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0); // Transparent background
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();

    this.cameraControls = new CameraControls(this.camera, this.renderer.domElement);
    this.cameraControls.minDistance = 20;
    this.cameraControls.maxDistance = 350;
    this.cameraControls.update();

    this.scene.userData = { camera: this.camera, controls: this.cameraControls };
    this._animationFrameId = null;
    this._onResize = this.onWindowResize.bind(this);
    this.initLights();
    this.animate();
    window.addEventListener('resize', this._onResize);
  }

  /**
   * Add the default scene lights. Repeated calls add another set.
   * @returns {void}
   */
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

  /**
   * Add grid and axis helpers using the existing viewer orientation.
   * @returns {void}
   */
  addAxesHelper() {
    const gridHelper = new THREE.GridHelper(100, 9);
    gridHelper.rotation.x = Math.PI / 2; // Rotate by 90 degrees on the x-axis
    const axesHelper = new THREE.AxesHelper(10); // Adjust the size as needed
    axesHelper.rotation.x = Math.PI / 2; 
    this.scene.add(gridHelper);
    this.scene.add(axesHelper);
  }

  /**
   * Render and schedule the next frame. The constructor starts this loop;
   * callers should not start an additional loop manually.
   * @returns {void}
   */
  animate() {
    if (!this.renderer) return;
    const delta = this.clock.getDelta();
    this.cameraControls.update(delta);

    this._animationFrameId = requestAnimationFrame(this.animate.bind(this));
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Resize the renderer and camera to the current sizing element.
   * @returns {void}
   */
  onWindowResize() {
    if (!this.camera || !this.renderer || !this.parentContainer || !this.container) return;

    const newWidth = Math.max(this.parentContainer.clientWidth || this.container.clientWidth || 1, 1);
    const newHeight = Math.max(this.parentContainer.clientHeight || this.container.clientHeight || 1, 1);
    this.camera.aspect = newWidth / newHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(newWidth, newHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio); // Ensure pixel ratio is updated on resize
    this.container.style.width = `${newWidth}px`;
    this.container.style.height = `${newHeight}px`;
  }

  /**
   * Add a scene clone named from the Part name and ID.
   * Mesh geometry/materials are shared with the source; this does not modify the aggregation.
   * @param {import('./part.js').Part} part
   * @returns {void}
   */
  addEntity(part) {
    const mesh = part.geo.clone();
    mesh.name = `${part.name}_${part.id}`;
    this.scene.add(mesh);
  }

  /**
   * Remove the first scene object matching the Part name/ID convention.
   * This does not remove a Part from the aggregation or dispose its shared resources.
   * @param {{name: string, id: number|string|null}} object
   * @returns {void}
   */
  removeEntity(object) {
    const selectedObject = this.scene.getObjectByName(`${object.name}_${object.id}`);
    if (selectedObject) {
      this.scene.remove(selectedObject);
    }
  }

  /**
   * Stop the animation loop, remove the resize listener and dispose controls/renderer.
   * Caller-owned meshes, geometries and materials are not disposed.
   * @returns {void}
   */
  dispose() {
    if (this._animationFrameId !== null) {
      globalThis.cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
    window.removeEventListener('resize', this._onResize);
    this.cameraControls?.dispose?.();
    this.renderer?.dispose?.();
  }
}
