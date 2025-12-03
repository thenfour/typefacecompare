import { ColorInterpolationMode, convertHexToVector, rgb255ToVector } from "./colorSpaces";
import type { ReductionMode, DistanceFeature } from "@/types/dither";

export const DISTANCE_FEATURE_LABELS: Record<DistanceFeature, string> = {
    all: "All components",
    luminance: "Luminance / Lightness",
    "hsl-saturation": "HSL Saturation",
    "hsl-lightness": "HSL Lightness",
    "oklch-chroma": "OKLCH Chroma",
};

export const DISTANCE_FEATURE_ORDER: DistanceFeature[] = ["all", "luminance", "hsl-saturation", "hsl-lightness", "oklch-chroma"];

const OKLCH_CHROMA_NORMALIZER = 0.4;

export interface ReductionPaletteEntry {
    rgb: { r: number; g: number; b: number };
    coords: number[];
}

export function isDistanceFeatureSupported(mode: ColorInterpolationMode, feature: DistanceFeature) {
    switch (feature) {
        case "all":
            return true;
        case "luminance":
            return mode === "lab" || mode === "oklch" || mode === "ycbcr" || mode === "hsl";
        case "hsl-saturation":
        case "hsl-lightness":
            return mode === "hsl";
        case "oklch-chroma":
            return mode === "oklch";
        default:
            return false;
    }
}

export function getSupportedDistanceFeatures(mode: ColorInterpolationMode): DistanceFeature[] {
    return DISTANCE_FEATURE_ORDER.filter((feature) => isDistanceFeatureSupported(mode, feature));
}

export function applyReduction(
    rgb: { r: number; g: number; b: number },
    mode: ReductionMode,
    palette: ReductionPaletteEntry[],
    distanceMode: ColorInterpolationMode,
    distanceFeature: DistanceFeature
) {
    if (mode === "palette" && palette.length > 0) {
        return quantizeToPalette(rgb, palette, distanceMode, distanceFeature);
    }
    return rgb;
}

export function quantizeToPalette(
    rgb: { r: number; g: number; b: number },
    palette: ReductionPaletteEntry[],
    distanceMode: ColorInterpolationMode,
    distanceFeature: DistanceFeature
) {
    if (palette.length === 0) {
        return rgb;
    }
    const targetCoords = rgbToCoords(rgb, distanceMode, distanceFeature);
    let closest = palette[0];
    let minDistance = Infinity;
    for (const swatch of palette) {
        const distance = distanceSq(targetCoords, swatch.coords);
        if (distance < minDistance) {
            minDistance = distance;
            closest = swatch;
        }
    }
    return { ...closest.rgb };
}

export function rgbToCoords(rgb: { r: number; g: number; b: number }, mode: ColorInterpolationMode, feature: DistanceFeature) {
    const vector = rgb255ToVector(rgb, mode);
    const coords = vectorToTuple(vector, mode);
    return projectDistanceFeature(vector, coords, mode, feature);
}

function projectDistanceFeature(
    vector: ReturnType<typeof convertHexToVector>,
    coords: number[],
    mode: ColorInterpolationMode,
    feature: DistanceFeature
): number[] {
    if (!isDistanceFeatureSupported(mode, feature)) {
        throw new Error(`Distance feature ${feature} is not supported in ${mode}`);
    }
    switch (feature) {
        case "all":
            return coords;
        case "luminance":
            if (mode === "lab") {
                const labVector = vector as { l?: number };
                return [Math.max(0, Math.min(1, (labVector.l ?? 0) / 100))];
            }
            if (mode === "oklch") {
                const oklchVector = vector as { L?: number };
                return [oklchVector.L ?? 0];
            }
            if (mode === "ycbcr") {
                const ycbcrVector = vector as { y?: number };
                return [ycbcrVector.y ?? 0];
            }
            if (mode === "hsl") {
                const hslVector = vector as { l?: number };
                return [hslVector.l ?? 0];
            }
            break;
        case "hsl-saturation": {
            const hslVector = vector as { s?: number };
            return [hslVector.s ?? 0];
        }
        case "hsl-lightness": {
            const hslVector = vector as { l?: number };
            return [hslVector.l ?? 0];
        }
        case "oklch-chroma": {
            const oklchVector = vector as { C?: number };
            return [Math.max(0, (oklchVector.C ?? 0) / OKLCH_CHROMA_NORMALIZER)];
        }
        default:
            break;
    }
    return coords;
}

function vectorToTuple(vector: ReturnType<typeof convertHexToVector>, mode: ColorInterpolationMode): number[] {
    switch (mode) {
        case "rgb": {
            const rgb = vector as { r: number; g: number; b: number };
            return [rgb.r, rgb.g, rgb.b];
        }
        case "hsl": {
            const hsl = vector as { h: number; s: number; l: number };
            const [hx, hy] = hueToCartesian(hsl.h);
            return [hx, hy, hsl.s, hsl.l];
        }
        case "cmyk": {
            const cmyk = vector as { c: number; m: number; y: number; k: number };
            return [cmyk.c, cmyk.m, cmyk.y, cmyk.k];
        }
        case "lab": {
            const lab = vector as { l: number; a: number; b: number };
            return [lab.l / 100, lab.a / 128, lab.b / 128];
        }
        case "ycbcr": {
            const ycbcr = vector as { y: number; cb: number; cr: number };
            return [ycbcr.y, ycbcr.cb, ycbcr.cr];
        }
        case "oklch": {
            const oklch = vector as { L: number; C: number; h: number };
            const [hx, hy] = hueToCartesian(oklch.h);
            return [oklch.L, oklch.C / OKLCH_CHROMA_NORMALIZER, hx, hy];
        }
        default:
            return [];
    }
}

function hueToCartesian(degrees: number) {
    const radians = ((((degrees ?? 0) % 360) + 360) % 360) * (Math.PI / 180);
    return [Math.cos(radians), Math.sin(radians)];
}

export function distanceSq(a: number[], b: number[]) {
    const length = Math.min(a.length, b.length);
    let total = 0;
    for (let index = 0; index < length; index++) {
        const delta = (a[index] ?? 0) - (b[index] ?? 0);
        total += delta * delta;
    }
    return total;
}

export function coordsToPreviewRgb(coords: number[]) {
    const normalized = coords.map((value) => normalizeCoordComponent(value));
    const sample = (channelIndex: number) => normalized[channelIndex % normalized.length];
    return clampRgb255({
        r: sample(0),
        g: sample(1),
        b: sample(2),
    });
}

function normalizeCoordComponent(value: number) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    if (value >= 0 && value <= 1) {
        return Math.round(Math.min(1, Math.max(0, value)) * 255);
    }
    const shifted = (value + 1) / 2;
    return Math.round(Math.min(1, Math.max(0, shifted)) * 255);
}

export function clampRgb255(rgb: { r: number; g: number; b: number }) {
    return {
        r: Math.min(255, Math.max(0, Math.round(rgb.r))),
        g: Math.min(255, Math.max(0, Math.round(rgb.g))),
        b: Math.min(255, Math.max(0, Math.round(rgb.b))),
    };
}
