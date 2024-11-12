import * as THREE from 'three';
import CameraControls from 'camera-controls';

CameraControls.install({ THREE: THREE });

// Function to initialize Three.js visualization with GUI for speed control
export function initThreeJsVisualization(containerId = '#threejs-container') {  // NEEDS TO BE FIXED!
  const container = document.querySelector(containerId);
  const parentContainer = document.querySelector('#threejs-container-parent'); // NEEDS TO BE FIXED!

  if (!container) {
    console.error('Container element not found.');
    return;
  }

  const width = parentContainer.clientWidth;
  const height = parentContainer.clientHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 5000);
  camera.up.set(0, 0, 1);
  camera.position.set(100, 100, 50);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0); // transparent Background
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  const clock = new THREE.Clock();

  const cameraControls = new CameraControls(camera, renderer.domElement);
  cameraControls.minDistance = 20;
  cameraControls.maxDistance = 350;
  cameraControls.update();

  function animate() {
    const delta = clock.getDelta();
    const hasControlsUpdated = cameraControls.update(delta);
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }

  animate();

  // Make variables available to browser console
  globalThis.THREE = THREE;
  globalThis.cameraControls = cameraControls;

  // LIGHTS
  const directionalLight = new THREE.DirectionalLight(0xffffff, 5);
  directionalLight.position.set(30, 30, -30);
  scene.add(directionalLight);

  const directionalLight2 = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight2.position.set(30, 30, 30);
  scene.add(directionalLight2);

  const ambientLight = new THREE.AmbientLight(0xffffff, 1);
  scene.add(ambientLight);

  // HELPERS (commented out)
  // const axesHelper = new THREE.AxesHelper(2);
  // scene.add(axesHelper);
  // const gridXZ = new THREE.GridHelper(50, 10);
  // scene.add(gridXZ);

  window.addEventListener('resize', () => {
    const newWidth = parentContainer.clientWidth;
    const newHeight = parentContainer.clientHeight;
    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(newWidth, newHeight);
    renderer.setPixelRatio(window.devicePixelRatio); // Ensure pixel ratio is updated on resize
    container.style.width = `${newWidth}px`;
    container.style.height = `${newHeight}px`;
  });

  return { scene, camera, renderer, cameraControls };
}

export function addEntity(scene, part) {
  const mesh = part.geo.clone();
  mesh.name = `${part.name}_${part.id}`;
  scene.add(mesh);
}

export function removeEntity(scene, object) {
  var selectedObject = scene.getObjectByName(`${object.name}_${object.id}`);
  if (selectedObject) {
    scene.remove(selectedObject);
  } else {
    console.log("Object not found:", `${object.name}_${object.id}`);
  }
}
