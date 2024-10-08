
const statusValueElement = document.getElementById('statusValue');
let scene, camera, renderer, controls;
  


// Function to initialize Three.js visualization with GUI for speed control
function initThreeJsVisualization(containerId = '#threejs-container') {
  const container = document.querySelector(containerId);
  if (!container) {
    console.error('Container element not found.');
    return;
  }
  const width = container.clientWidth;
  const height = container.clientHeight;

  let scene = new THREE.Scene();
  let camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  let renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

      // CONTROLS
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.rotateSpeed = 1.0;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.8;
    controls.enableDamping = true;
    controls.DampingFactor = 0.1;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.minDistance = 20;
    controls.maxDistance = 800;

  camera.position.y = 50;
  camera.position.x = 50;
  camera.position.z = 25;
  controls.update();

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
  const axesHelper = new THREE.AxesHelper(2);
  //scene.add(axesHelper);
  var gridXZ = new THREE.GridHelper(50, 10);
  //scene.add(gridXZ);

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  animate();

  window.addEventListener('resize', () => {
    const newWidth = container.clientWidth;
    const newHeight = container.clientHeight;
    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(newWidth, newHeight);
  });

  return { scene, camera, renderer, controls };
}

// Function to visualize parts with adjustable timeout speed
function visualizeParts(scene, parts, wirefr) {
  const partGroup = new THREE.Group();
  let index = 0;

  function addPart() {
    if (index >= parts.length) {
      return;
    }

    const part = parts[index];
    console.log("part: ", part);

    if (wirefr) {
      part.geo.material.wireframe = true;
    }
    else {
      part.geo.material.wireframe = false;
      updateStatusValue(index)
    }
    const mesh = part.geo.clone();
    mesh.name = `${part.name}_${part.id}`;

    // Apply rotation around the global X-axis (in radians)
    partGroup.rotation.x = -Math.PI / 2; // This rotates by 90 degrees; adjust as needed

    partGroup.add(mesh);
    index++;

    // Use the config speed value for the timeout
    setTimeout(addPart, 1 /*config.speed*/);
  }

  addPart();
  scene.add(partGroup);
}


// Example function to update the status value
function updateStatusValue(newValue) {
    statusValueElement.textContent = newValue;
}


function resetScene(scene) {
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