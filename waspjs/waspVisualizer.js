// Define a color map for parts
const colorMap = {
  "0": "0xFF0000", // Red
  "1": "0x00FF00", // Green
  "2": "0x0000FF", // Blue
  // Add more parts and colors as needed
};

const statusValueElement = document.getElementById('statusValue');

  


// Function to initialize Three.js visualization with GUI for speed control
function initThreeJsVisualization(containerId = '#threejs-container') {
  const container = document.querySelector(containerId);
  if (!container) {
    console.error('Container element not found.');
    return;
  }
  const width = container.clientWidth;
  const height = container.clientHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
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
    controls.enablePan = false;
    controls.minDistance = 20;
    controls.maxDistance = 800;

  camera.position.y = 200;
  camera.position.x = 200;
  camera.position.z = 150;
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
  scene.add(axesHelper);
  var gridXZ = new THREE.GridHelper(50, 10);
  scene.add(gridXZ);

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
  let index = 0;

  function addPart() {
    if (index >= parts.length) {
      return;
    }

    const part = parts[index];


    const hexColor = colorMap[part.id] || "#FFFFFF"; // Default to white if color is not found
    part.geo.material.color.setHex(hexColor);
    if (wirefr) {
      part.geo.material.wireframe = true;
    }
    else {
      part.geo.material.wireframe = false;
      updateStatusValue(index)
    }

    const partGroup = new THREE.Group();
    const mesh = part.geo;
    mesh.name = `${part.name}_${part.id}`;

    // Apply rotation around the global X-axis (in radians)
    partGroup.rotation.x = -Math.PI / 2; // This rotates by 90 degrees; adjust as needed

    partGroup.add(mesh);
    scene.add(partGroup);

    /*// PLANE VISUALIZER
    for (const conn of part.connections) {
      const hexRed = 0xff0000;
      const hexGreen = 0x00ff00;
      const hexBlue = 0x0000ff;

      let arrowHelperX = new THREE.ArrowHelper(conn.pln.xaxis.normalize(), conn.pln.origin, 3, hexRed);
      let arrowHelperY = new THREE.ArrowHelper(conn.pln.yaxis.normalize(), conn.pln.origin, 3, hexGreen);

      let zVector = new THREE.Vector3().crossVectors(conn.pln.xaxis, conn.pln.yaxis).normalize();
      let arrowHelperZ = new THREE.ArrowHelper(zVector, conn.pln.origin, 3, hexBlue);
    }*/
    index++;

    // Use the config speed value for the timeout
    setTimeout(addPart, 1 /*config.speed*/);
  }

  addPart();
}


// Example function to update the status value
function updateStatusValue(newValue) {
    statusValueElement.textContent = newValue;
}
