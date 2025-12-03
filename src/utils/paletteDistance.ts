import { ColorInterpolationMode, convertHexToVector, rgb255ToVector } from "./colorSpaces";
import type { ReductionMode } from "@/types/dither";

const OKLCH_CHROMA_NORMALIZER = 0.4;

export interface ReductionPaletteEntry {
    rgb: { r: number; g: number; b: number };
    coords: number[];
}

export function applyReduction(
    rgb: { r: number; g: number; b: number },
    mode: ReductionMode,
    palette: ReductionPaletteEntry[],
    distanceMode: ColorInterpolationMode
) {
    if (mode === "palette" && palette.length > 0) {
        return quantizeToPalette(rgb, palette, distanceMode);
    }
    return rgb;
}

export function quantizeToPalette(
    rgb: { r: number; g: number; b: number },
    palette: ReductionPaletteEntry[],
    distanceMode: ColorInterpolationMode
) {
    if (palette.length === 0) {
        return rgb;
    }
    const targetCoords = rgbToCoords(rgb, distanceMode);
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

export function blendColorTowardPalette(
    rgb: { r: number; g: number; b: number },
    palette: ReductionPaletteEntry[],
    distanceMode: ColorInterpolationMode,
    strength: number
) {
    if (strength <= 0 || palette.length === 0) {
        return rgb;
    }
    const target = quantizeToPalette(rgb, palette, distanceMode);
    const clampedStrength = Math.max(0, Math.min(1, strength));
    return {
        r: rgb.r + (target.r - rgb.r) * clampedStrength,
        g: rgb.g + (target.g - rgb.g) * clampedStrength,
        b: rgb.b + (target.b - rgb.b) * clampedStrength,
    };
}

export function rgbToCoords(rgb: { r: number; g: number; b: number }, mode: ColorInterpolationMode) {
    const vector = rgb255ToVector(rgb, mode);
    return vectorToTuple(vector, mode);
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
        case "hsv": {
            const hsv = vector as { h: number; s: number; v: number };
            const [hx, hy] = hueToCartesian(hsv.h);
            return [hx, hy, hsv.s, hsv.v];
        }
        case "hwb": {
            const hwb = vector as { h: number; w: number; b: number };
            const [hx, hy] = hueToCartesian(hwb.h);
            return [hx, hy, hwb.w, hwb.b];
        }
        case "ryb": {
            const ryb = vector as { h: number; s: number; v: number };
            const [hx, hy] = hueToCartesian(ryb.h);
            return [hx, hy, ryb.s, ryb.v];
        }
        case "luma-rgb":
        case "luma-lab":
        case "luma-oklab": {
            const luma = vector as { l: number };
            return [luma.l];
        }
        case "cmy": {
            const cmy = vector as { c: number; m: number; y: number };
            return [cmy.c, cmy.m, cmy.y];
        }
        case "cmyk": {
            const cmyk = vector as { c: number; m: number; y: number; k: number };
            return [cmyk.c, cmyk.m, cmyk.y, cmyk.k];
        }
        case "lab": {
            const lab = vector as { l: number; a: number; b: number };
            return [lab.l / 100, lab.a / 128, lab.b / 128];
        }
        case "oklab": {
            const oklab = vector as { L: number; a: number; b: number };
            return [oklab.L, oklab.a, oklab.b];
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

export function clampRgb255(rgb: { r: number; g: number; b: number }) {
    return {
        r: Math.min(255, Math.max(0, Math.round(rgb.r))),
        g: Math.min(255, Math.max(0, Math.round(rgb.g))),
        b: Math.min(255, Math.max(0, Math.round(rgb.b))),
    };
}
