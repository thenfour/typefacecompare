import { AxisTriple } from "./colorAxes";
import { ColorInterpolationMode, convertHexToVector, rgb255ToVector, rgbUnitTo255, vectorToRgb } from "./colorSpaces";
import type { ReductionMode } from "@/types/dither";

const OKLCH_CHROMA_NORMALIZER = 0.4;
const MIN_GRAVITY_SOFTNESS = 0.0025;
const MAX_GRAVITY_SOFTNESS = 0.5;
const MAX_AMBIGUITY_BOOST = 20;
const DEG_TO_RAD = Math.PI / 180;

type OklabVector = { L: number; a: number; b: number };
type OklchVector = { L: number; C: number; h: number };

export interface ReductionPaletteEntry {
    rgb: { r: number; g: number; b: number };
    coords: number[];
    oklab: OklabVector;
    oklch: OklchVector;
}

export type PaletteCoordinateSelector = (entry: ReductionPaletteEntry) => number[];

export interface PaletteDistanceSummary {
    nearestDistance: number;
    secondNearestDistance: number;
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

export interface PaletteGravityParams {
    softness: number;
    lightnessStrength: number;
    chromaStrength: number;
    ambiguityBoost: number;
}

export const DEFAULT_PALETTE_GRAVITY_PARAMS: PaletteGravityParams = {
    softness: 0.035,
    lightnessStrength: 0.35,
    chromaStrength: 0.5,
    ambiguityBoost: 0,
};

export function applyPaletteGravityNudge(
    rgb: { r: number; g: number; b: number },
    palette: ReductionPaletteEntry[],
    params: PaletteGravityParams
) {
    if (palette.length === 0) {
        return rgb;
    }
    const resolved = normalizePaletteGravityParams(params);
    if (resolved.lightnessStrength <= 0 && resolved.chromaStrength <= 0) {
        return rgb;
    }
    const sourceLab = convertRgbToOklab(rgb);
    const centroid = computePaletteGravityCentroid(sourceLab, palette, resolved.softness);
    if (!centroid) {
        return rgb;
    }
    const ambiguityRatio = resolved.ambiguityBoost > 0 ? computePaletteAmbiguity(sourceLab, palette) : 0;
    const emphasis = resolved.ambiguityBoost > 0 ? clamp01(ambiguityRatio * resolved.ambiguityBoost) : 0;
    const lightnessT = applyAmbiguityEmphasis(resolved.lightnessStrength, emphasis);
    const chromaT = applyAmbiguityEmphasis(resolved.chromaStrength, emphasis);
    const adjustedLab: OklabVector = {
        L: lerp(sourceLab.L, centroid.L, lightnessT),
        a: lerp(sourceLab.a, centroid.a, chromaT),
        b: lerp(sourceLab.b, centroid.b, chromaT),
    };
    const unitRgb = vectorToRgb(adjustedLab, "oklab");
    return clampRgb255(rgbUnitTo255(unitRgb));
}

function applyAmbiguityEmphasis(baseStrength: number, emphasis: number): number {
    if (baseStrength >= 1) {
        return 1;
    }
    if (emphasis <= 0) {
        return clamp01(baseStrength);
    }
    return clamp01(baseStrength + (1 - baseStrength) * emphasis);
}

function normalizePaletteGravityParams(params: PaletteGravityParams): PaletteGravityParams {
    const { softness, lightnessStrength, chromaStrength, ambiguityBoost } = params;
    const clampedSoftness = Math.min(
        MAX_GRAVITY_SOFTNESS,
        Math.max(MIN_GRAVITY_SOFTNESS, Number.isFinite(softness) ? softness : MIN_GRAVITY_SOFTNESS)
    );
    return {
        softness: clampedSoftness,
        lightnessStrength: clamp01(lightnessStrength ?? 0),
        chromaStrength: clamp01(chromaStrength ?? 0),
        ambiguityBoost: Math.max(0, Math.min(MAX_AMBIGUITY_BOOST, ambiguityBoost ?? 0)),
    } satisfies PaletteGravityParams;
}

function convertRgbToOklab(rgb: { r: number; g: number; b: number }): OklabVector {
    const vector = rgb255ToVector(rgb, "oklab") as OklabVector;
    return {
        L: vector.L,
        a: vector.a,
        b: vector.b,
    } satisfies OklabVector;
}

function computePaletteGravityCentroid(
    sourceLab: OklabVector,
    palette: ReductionPaletteEntry[],
    softness: number
) {
    const sourceLch = labToLch(sourceLab);
    const tauSq = softness * softness;
    let totalWeight = 0;
    const accumulator: OklabVector = { L: 0, a: 0, b: 0 };
    for (const entry of palette) {
        const paletteLab = entry.oklab;
        const paletteLch = entry.oklch;
        const distanceSq = computeOklchDistanceSq(sourceLch, paletteLch);
        const weight = Math.exp(-distanceSq / tauSq);
        if (weight < 1e-6) {
            continue;
        }
        totalWeight += weight;
        accumulator.L += paletteLab.L * weight;
        accumulator.a += paletteLab.a * weight;
        accumulator.b += paletteLab.b * weight;
    }
    if (totalWeight <= 1e-6) {
        return findNearestPaletteLab(sourceLab, palette);
    }
    return {
        L: accumulator.L / totalWeight,
        a: accumulator.a / totalWeight,
        b: accumulator.b / totalWeight,
    } satisfies OklabVector;
}

function findNearestPaletteLab(sourceLab: OklabVector, palette: ReductionPaletteEntry[]): OklabVector | null {
    if (!palette.length) {
        return null;
    }
    let closest: ReductionPaletteEntry | null = null;
    let minDistance = Infinity;
    for (const entry of palette) {
        const distance = computeOklabDistanceSq(sourceLab, entry.oklab);
        if (distance < minDistance) {
            minDistance = distance;
            closest = entry;
        }
    }
    if (!closest) {
        return null;
    }
    return { ...closest.oklab };
}

function computeOklabDistanceSq(a: OklabVector, b: OklabVector): number {
    const deltaL = a.L - b.L;
    const deltaA = a.a - b.a;
    const deltaB = a.b - b.b;
    return deltaL * deltaL + deltaA * deltaA + deltaB * deltaB;
}

function computePaletteAmbiguity(sourceLab: OklabVector, palette: ReductionPaletteEntry[]): number {
    const summary = summarizePaletteDistances(
        [sourceLab.L, sourceLab.a, sourceLab.b],
        palette,
        (entry) => [entry.oklab.L, entry.oklab.a, entry.oklab.b]
    );
    if (!summary || !Number.isFinite(summary.secondNearestDistance) || summary.secondNearestDistance <= 0) {
        return 0;
    }
    const diff = Math.abs(summary.secondNearestDistance - summary.nearestDistance);
    return summary.secondNearestDistance > 0
        ? clamp01(1 - diff / summary.secondNearestDistance)
        : 0;
}

export function summarizePaletteDistances(
    sourceCoords: number[],
    palette: ReductionPaletteEntry[],
    coordSelector: PaletteCoordinateSelector = (entry) => entry.coords
): PaletteDistanceSummary | null {
    if (palette.length === 0) {
        return null;
    }
    let nearest = Infinity;
    let second = Infinity;
    for (const entry of palette) {
        const coords = coordSelector(entry);
        const distSq = distanceSq(sourceCoords, coords);
        if (distSq < nearest) {
            second = nearest;
            nearest = distSq;
        } else if (distSq < second) {
            second = distSq;
        }
    }
    if (!Number.isFinite(nearest)) {
        return null;
    }
    return {
        nearestDistance: Math.sqrt(Math.max(nearest, 0)),
        secondNearestDistance: Math.sqrt(Math.max(second, 0)),
    } satisfies PaletteDistanceSummary;
}

function computeOklchDistanceSq(a: OklchVector, b: OklchVector): number {
    const deltaL = a.L - b.L;
    const deltaC = a.C - b.C;
    const avgChroma = Math.sqrt(Math.max(0, a.C * b.C));
    const hueDelta = DEG_TO_RAD * shortestAngleDegrees(a.h, b.h);
    const deltaH = 2 * avgChroma * Math.sin(hueDelta / 2);
    return deltaL * deltaL + deltaC * deltaC + deltaH * deltaH;
}

function labToLch(lab: OklabVector): OklchVector {
    const chroma = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
    const hue = Math.atan2(lab.b, lab.a) * (180 / Math.PI);
    return {
        L: lab.L,
        C: chroma,
        h: (hue + 360) % 360,
    } satisfies OklchVector;
}

function shortestAngleDegrees(a: number, b: number) {
    const normalizedA = ((a % 360) + 360) % 360;
    const normalizedB = ((b % 360) + 360) % 360;
    let delta = normalizedA - normalizedB;
    if (delta > 180) {
        delta -= 360;
    } else if (delta < -180) {
        delta += 360;
    }
    return delta;
}

function lerp(start: number, end: number, t: number) {
    return start + (end - start) * clamp01(t);
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
        case "luma-rgb":
        case "luma-lab":
        case "luma-oklab": {
            const luma = vector as { l: number };
            return [luma.l];
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

// function distanceSqAxes(a: AxisTriple, b: AxisTriple) {
//     const dx = (a[0] ?? 0) - (b[0] ?? 0);
//     const dy = (a[1] ?? 0) - (b[1] ?? 0);
//     const dz = (a[2] ?? 0) - (b[2] ?? 0);
//     return dx * dx + dy * dy + dz * dz;
// }

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function clampRgb255(rgb: { r: number; g: number; b: number }) {
    return {
        r: Math.min(255, Math.max(0, Math.round(rgb.r))),
        g: Math.min(255, Math.max(0, Math.round(rgb.g))),
        b: Math.min(255, Math.max(0, Math.round(rgb.b))),
    };
}
