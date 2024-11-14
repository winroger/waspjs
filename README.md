<div style="width: 100%; height: auto; margin: 0 auto; display: flex; align-items: center; justify-content: center;">
    <img src="./public/graphics/banner.svg" alt="WaspJS Banner" style="width: 100%; height: auto;">
</div>
<br>


<p align="center">
    <a href="https://www.npmjs.com/package/webwaspjs">
        <img src="https://img.shields.io/npm/v/webwaspjs.svg" alt="npm version">
    </a>
    <a href="https://www.npmjs.com/package/webwaspjs">
        <img src="https://img.shields.io/npm/dm/webwaspjs.svg" alt="npm downloads">
    </a>
    <a href="https://github.com/winroger/waspjs/LICENSE">
        <img src="https://img.shields.io/github/license/winroger/waspjs.svg" alt="license">
    </a>
</p>

---
WaspJS is a JavaScript library (LICENSE HERE) designed to perform discrete aggregations on the Web.

This implementation is authored by Roger Winkler and builds upon the original concept of the python-based Grasshopper plug-in WASP by Andrea Rossi. For more information on WASP, visit the [original WASP repository](https://github.com/ar0551/Wasp).

# [Demo](https://winroger.github.io/waspjs/)

To get an idea of the library, you can play around with the [demo](https://winroger.github.io/waspjs/). The code for the demo can be found in the `test` folder. Example datasets can be found in the `public/examples` folder.

# Usage

## Installation

You can install WaspJS via npm:

```bash
npm install webwaspjs
```

## Running the Demo Locally

To run the demo locally, follow these steps:

1. **Clone the repository:**

    ```bash
    git clone https://github.com/winroger/waspjs.git
    cd waspjs
    ```

2. **Install the dependencies:**

    ```bash
    npm install
    ```

3. **Run the demo using Vite:**

    ```bash
    npm run dev
    ```

4. **Open your browser and navigate to the Local URL shown, e.g.**

    ```
    http://localhost:5173/waspjs/
    ```

You should now see the demo running locally on your machine. 

# Documentation

## Current Classes

The `Visualizer` class is used to visualize the aggregation and perform other operations. It utilizes [Three.js](https://threejs.org/), a popular JavaScript library for 3D graphics. Additionally, the [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) library is used for collision detection. The [camera-controls](https://github.com/yomotsu/camera-controls) library is employed to change the scene's up axis from Y (default in Three.js) to Z (default in Rhino).

The `Aggregation` class in holds the initial parts, rules, and the aggregated parts.

The `Part` class contains all relevant information to describe a part, including connections to other parts and colliders.

The `Connection` class represents a possible connection plane and holds its current status.

The `Plane` class is introduced to hold information similar to the logic of a Grasshopper plane. This is necessary because the concept of a plane in Rhino3D (origin, X- and Y-axis) does not exist in Three.js (a plane in Three.js is a plane surface).

The `Collider` class is used for checking collisions based on simplified geometries before adding the original geometry to the aggregation. For collision detection, the [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) library is used.

The `Rule` class defines which part and connection type can connect to which others.

# License

## Option 1: MIT

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

This project is inspired by the original WASP software, which was developed in Python and is licensed under the GNU Lesser General Public License, Version 3, 29 June 2007. For more information on the original WASP software, visit the [original WASP repository](https://github.com/ar0551/Wasp).

## Option 2: LGPL

This project is licensed under the GNU Lesser General Public License, Version 3, 29 June 2007. See the [LICENSE](LICENSE) file for details.

This project is a reverse-engineered version of the original WASP software, which was developed in Python and is licensed under the GNU Lesser General Public License, Version 3, 29 June 2007. For more information on the original WASP software, visit the [original WASP repository](https://github.com/ar0551/Wasp).

# Contact

For any questions or feedback, get in touch via [hello@rogerwinkler.de](mailto:hello@rogerwinkler.de).
