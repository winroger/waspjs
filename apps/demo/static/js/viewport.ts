import { Visualizer } from 'webwaspjs';
import { frameVisualizerToScene } from 'webwaspjs';
import { state, refs } from './store.ts';
import { normalizeHex } from './io.ts';

export function resetAggregationViewer() {
    refs.aggCanvas.innerHTML = '';
    state.waspVisualization = new Visualizer('#agg-viewer', '#viewerArea');
}

export function resetPartViewer() {
    refs.partCanvas.innerHTML = '';
    state.partVisualization = new Visualizer('#part-viewer', '#viewerArea');
}

export function centerCameraOnMesh(viz: any, mesh: any, distanceScale = 3) {
    const geom = mesh.geometry;
    if (!geom.boundingSphere) {
        geom.computeBoundingSphere();
    }
    const sphere = geom.boundingSphere;
    const radius = sphere.radius || 1;
    const center = sphere.center.clone().applyMatrix4(mesh.matrixWorld);
    const distance = radius * distanceScale;

    viz.camera.position.set(center.x + distance, center.y + distance, center.z + distance);
    if (viz.cameraControls) {
        viz.cameraControls.setLookAt(
            center.x + distance,
            center.y + distance,
            center.z + distance,
            center.x,
            center.y,
            center.z,
            false
        );
    }
}

export function frameAggregationScene(viz: any) {
    frameVisualizerToScene(viz, 0.8);
}

export function syncColorPicker(part: any, idx: number, inPartsMode: boolean) {
    if (!refs.partColorInput || !refs.partColorValue) return;
    const palette = state.currentColors?.colors || state.currentColors?.palette || [];
    const byPart = state.currentColors?.byPart || {};
    const fallback = palette.length ? palette[idx % palette.length] : '#ffffff';
    const hex = normalizeHex(byPart[part.name] || fallback);
    refs.partColorInput.value = hex;
    refs.partColorValue.textContent = hex.toUpperCase();
    refs.partColorName.textContent = part.name;
    refs.partColorControls?.classList.toggle('is-hidden', !inPartsMode);
}

export function renderPart(nextIndex: number) {
    const inPartsMode = state.currentMode === 'parts';
    if (!state.partsList.length) {
        refs.partCaptionName.textContent = 'No parts available';
        refs.partCaptionCounter.textContent = '';
        refs.partCaption.classList.toggle('is-hidden', !inPartsMode);
        refs.partOverlay.classList.add('is-hidden');
        return;
    }

    const normalizedIndex = (nextIndex + state.partsList.length) % state.partsList.length;
    state.partIndex = normalizedIndex;
    const part = state.partsList[state.partIndex];

    resetPartViewer();

    const mesh = part.geo.clone();
    mesh.name = `${part.name}_preview`;
    state.partVisualization.scene.add(mesh);

    centerCameraOnMesh(state.partVisualization, mesh);

    refs.partCaptionName.textContent = part.name;
    refs.partCaptionCounter.textContent = `${state.partIndex + 1} / ${state.partsList.length}`;
    refs.partCaption.classList.toggle('is-hidden', !inPartsMode);
    refs.partOverlay.classList.toggle('is-hidden', !inPartsMode);
    syncColorPicker(part, state.partIndex, inPartsMode);
}
