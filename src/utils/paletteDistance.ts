import { ColorInterpolationMode, convertHexToVector, rgb255ToVector } from "./colorSpaces";
import type { ReductionMode } from "@/types/dither";
import { applyAxisTripleToRgb, extractAxisTriple, type AxisTriple } from "@/utils/colorAxes";

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

export interface PaletteMagnetParams {
    radiusOut: number;
    radiusDir: number;
    kAmb: number;
    kOut: number;
    kNearest: number;
}

export const DEFAULT_PALETTE_MAGNET_PARAMS: PaletteMagnetParams = {
    radiusOut: 0.25,
    radiusDir: 0.35,
    kAmb: 2,
    kOut: 1,
    kNearest: 3,
};

export function blendColorTowardPalette(
    rgb: { r: number; g: number; b: number },
    palette: ReductionPaletteEntry[],
    distanceMode: ColorInterpolationMode,
    baseStrength: number,
    magnetOverrides?: Partial<PaletteMagnetParams>
) {
    if (baseStrength <= 0 || palette.length === 0) {
        return rgb;
    }
    const params: PaletteMagnetParams = {
        ...DEFAULT_PALETTE_MAGNET_PARAMS,
        ...magnetOverrides,
    };
    const sourceAxes = extractAxisTriple(rgb, distanceMode);
    const paletteAxes = palette.map((entry) => extractAxisTriple(entry.rgb, distanceMode));
    const distances = paletteAxes.map((axes, idx) => ({ idx, d: Math.sqrt(distanceSqAxes(sourceAxes, axes)) }));
    distances.sort((a, b) => a.d - b.d);

    const nearest = distances[0];
    if (!nearest) {
        return rgb;
    }
    const second = distances[1];
    const d1 = nearest.d;
    const d2 = second?.d ?? Infinity;
    const outRaw = clamp01(params.radiusOut > 0 ? d1 / params.radiusOut : 1);
    const outFactor = Math.pow(outRaw, params.kOut);
    let ambiguity = 0;
    if (Number.isFinite(d2) && d2 > 1e-6) {
        const diff = Math.abs(d2 - d1);
        const rel = clamp01(1 - diff / d2);
        ambiguity = Math.pow(rel, params.kAmb);
    }
    const magnetAmount = baseStrength * outFactor * ambiguity;
    if (magnetAmount < 1e-4) {
        return rgb;
    }
    const chosen: { idx: number; d: number }[] = [];
    for (const item of distances) {
        if (item.d <= params.radiusDir) {
            chosen.push(item);
        }
        if (chosen.length >= params.kNearest) {
            break;
        }
    }
    if (chosen.length === 0) {
        return rgb;
    }
    let sumWeights = 0;
    const targetAxes: AxisTriple = [0, 0, 0];
    for (const { idx, d } of chosen) {
        const falloff = params.radiusDir > 0 ? 1 - d / params.radiusDir : 0;
        const weight = Math.max(0, falloff);
        if (weight <= 0) {
            continue;
        }
        sumWeights += weight;
        const axes = paletteAxes[idx];
        targetAxes[0] += axes[0] * weight;
        targetAxes[1] += axes[1] * weight;
        targetAxes[2] += axes[2] * weight;
    }
    if (sumWeights <= 0) {
        return rgb;
    }
    targetAxes[0] /= sumWeights;
    targetAxes[1] /= sumWeights;
    targetAxes[2] /= sumWeights;
    const t = clamp01(magnetAmount);
    const blendedAxes: AxisTriple = [
        sourceAxes[0] + (targetAxes[0] - sourceAxes[0]) * t,
        sourceAxes[1] + (targetAxes[1] - sourceAxes[1]) * t,
        sourceAxes[2] + (targetAxes[2] - sourceAxes[2]) * t,
    ];
    return applyAxisTripleToRgb(rgb, blendedAxes, distanceMode);
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

function distanceSqAxes(a: AxisTriple, b: AxisTriple) {
    const dx = (a[0] ?? 0) - (b[0] ?? 0);
    const dy = (a[1] ?? 0) - (b[1] ?? 0);
    const dz = (a[2] ?? 0) - (b[2] ?? 0);
    return dx * dx + dy * dy + dz * dz;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function clampRgb255(rgb: { r: number; g: number; b: number }) {
    return {
        r: Math.min(255, Math.max(0, Math.round(rgb.r))),
        g: Math.min(255, Math.max(0, Math.round(rgb.g))),
        b: Math.min(255, Math.max(0, Math.round(rgb.b))),
    };
}
