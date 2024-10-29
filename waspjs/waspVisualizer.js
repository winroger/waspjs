import * as THREE from 'three';
import { Part } from './waspPart';
//import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import CameraControls from 'camera-controls';

CameraControls.install( { THREE: THREE } );

const statusValueElement = document.getElementById('statusValue');
let scene, camera, renderer, controls;

// Function to initialize Three.js visualization with GUI for speed control
export function initThreeJsVisualization(containerId = '#threejs-container') {
  const container = document.querySelector(containerId);
  const parentContainer = document.querySelector('#threejs-container-parent');
  if (!container) {
    console.error('Container element not found.');
    return;
  }
  const width = parentContainer.clientWidth;
  const height = parentContainer.clientHeight;

  let scene = new THREE.Scene();
  let camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 5000);
  camera.up.set( 0, 0, 1 );
  camera.position.set(100, 100, 50);
  let renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor( 0x000000, 0 ); // the default
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  /*
    // CONTROLS
  controls = new OrbitControls(camera, renderer.domElement);
  controls.rotateSpeed = 1.0;
  controls.zoomSpeed = 1.2;
  controls.panSpeed = 0.8;
  controls.enableDamping = true;
  controls.DampingFactor = 0.1;
  controls.enableZoom = true;
  controls.enablePan = true;
  controls.minDistance = 20;
  controls.maxDistance = 1000;

  camera.position.y = 50;
  camera.position.x = 50;
  camera.position.z = 25;
  controls.update();
  */

  // CameraControls
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
    ( function anim () {

      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();
      const needsUpdate = cameraControls.update( delta );
    
      // if ( elapsed > 30 ) { return; }
    
      requestAnimationFrame( anim );
    
      if ( needsUpdate ) {
    
        renderer.render( scene, camera );
        //console.log( 'rendered' );
    
      }
    
    } )();

    // make variable available to browser console
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

  // HELPERS
  //const axesHelper = new THREE.AxesHelper(2);
  //scene.add(axesHelper);
  //var gridXZ = new THREE.GridHelper(50, 10);
  //scene.add(gridXZ);
/*
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }*/

  window.addEventListener('resize', () => {
    const newWidth = container.clientWidth;
    const newHeight = container.clientHeight;
    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(newWidth, newHeight);
    renderer.setPixelRatio(window.devicePixelRatio); // Ensure pixel ratio is updated on resize
  });

  return { scene, camera, renderer, controls };
}

// Function to visualize parts with adjustable timeout speed
export function visualizeParts(scene, parts, wirefr) {
  const partGroup = new THREE.Group();
  let index = 0;

  function addPart() {
    if (index >= parts.length) {
      return;
    }

    const part = parts[index];
    //console.log("part: ", part);

    if (wirefr) {
      part.geo.material.wireframe = true;
    }
    else {
      part.geo.material.wireframe = false;
    }
    updateStatusValue(index)
    const mesh = part.geo.clone();
    mesh.name = `${part.name}_${part.id}`;
    //console.log("Added Part with id: ", part.id)

    // Apply rotation around the global X-axis (in radians)
    //partGroup.rotation.x = -Math.PI / 2; // This rotates by 90 degrees; adjust as needed

    partGroup.add(mesh);
    index++;

    // Use the config speed value for the timeout
    setTimeout(addPart, 1 /*config.speed*/);
  }

  addPart();
  scene.add(partGroup);
}

export function addEntity(scene, part, wirefr) {
  //console.log("Attempting to add object:", part);
  const mesh = part.geo.clone();
  if (wirefr) {
    mesh.material.wireframe = true;
  } else {
    mesh.material.wireframe = false;
    //updateStatusValue(index);
  }
  mesh.name = `${part.name}_${part.id}`;
  scene.add(mesh);
  //console.log("Object added:", mesh);
}

export function removeEntity(scene, object) {
  //console.log("Attempting to remove object:", object);
  var selectedObject = scene.getObjectByName(`${object.name}_${object.id}`);
  if (selectedObject) {
    scene.remove(selectedObject);
    //console.log("Object removed:", selectedObject);
  } else {
    console.log("Object not found:", `${object.name}_${object.id}`);
  }
}

// Example function to update the status value
function updateStatusValue(newValue) {
    statusValueElement.textContent = newValue;
}


export function resetScene(scene) {
  while (scene.children.length) {
      const object = scene.children[0];
      scene.remove(object);
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
          if (object.material.map) object.material.map.dispose();
          object.material.dispose();
      }
  }
}

