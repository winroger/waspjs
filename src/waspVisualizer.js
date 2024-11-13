import * as THREE from 'three';
import CameraControls from 'camera-controls';

CameraControls.install({ THREE: THREE });

export class waspVisualizer {
  constructor(containerId = '#threejs-container', parentContainerId = '#threejs-container-parent') {
    this.container = document.querySelector(containerId);
    this.parentContainer = document.querySelector(parentContainerId);

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
    const hasControlsUpdated = this.cameraControls.update(delta);

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
}