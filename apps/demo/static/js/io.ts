export async function loadJson(path: string) {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Failed to load ${path}: ${response.status}`);
    }
    return response.json();
}

export async function loadColors(path: string) {
    try {
        const response = await fetch(path);
        if (!response.ok) return null;
        return response.json();
    } catch (err: any) {
        console.warn(`Could not load colors from ${path}: ${err.message}`);
        return null;
    }
}

export async function resolveColors(set: any) {
    const hasConfigColors = (set.colors && set.colors.length) || Object.keys(set.byPart || {}).length;
    if (hasConfigColors) {
        return {
            colors: set.colors || [],
            byPart: set.byPart || {},
        };
    }
    return loadColors(`${set.path}colors.json`);
}

export function setLoading(refs: any, isLoading: boolean, message = '') {
    if (!refs.loadingOverlay || !refs.loadingText) return;
    refs.loadingOverlay.style.opacity = isLoading ? '1' : '0';
    refs.loadingOverlay.style.pointerEvents = isLoading ? 'auto' : 'none';
    refs.loadingText.textContent = message;
}

export function logAvailableSetsValidity(availableSets: any[]) {
    availableSets.forEach(set => {
        console.log(`[demo] Set: ${set.name} | path: ${set.path}${set.aggregation ?? ''} | author: ${set.author || 'n/a'}`);
    });
}

export function normalizeHex(value: string) {
    if (!value) return '#ffffff';
    const v = value.trim();
    if (v.startsWith('#')) {
        return v.length === 7 ? v : v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : '#ffffff';
    }
    if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v}`;
    if (/^[0-9a-fA-F]{3}$/.test(v)) return `#${v[0]}${v[0]}${v[1]}${v[1]}${v[2]}${v[2]}`;
    return '#ffffff';
}
