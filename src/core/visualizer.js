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
    this._animationFrameId = null;
    this._onResize = this.onWindowResize.bind(this);
    this.initLights();
    //this.addAxesHelper(); // Add the axis helper
    this.animate();
    window.addEventListener('resize', this._onResize);
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
    if (!this.renderer) return;
    const delta = this.clock.getDelta();
    this.cameraControls.update(delta);

    // Add rotation if there are no user interactions
    /*if (!hasControlsUpdated) {
      this.scene.rotation.z += 0.001; // Adjust the rotation speed as needed
    }*/

    this._animationFrameId = requestAnimationFrame(this.animate.bind(this));
    this.renderer.render(this.scene, this.camera);
  }

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

  addEntity(part) {
    const mesh = part.geo.clone();
    mesh.name = `${part.name}_${part.id}`;
    this.scene.add(mesh);
  }

  removeEntity(object) {
    const selectedObject = this.scene.getObjectByName(`${object.name}_${object.id}`);
    if (selectedObject) {
      this.scene.remove(selectedObject);
    }
  }

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
