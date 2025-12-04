import type { RGBColor, ColorInterpolationMode } from "./colorSpaces";
import { rgb255ToVector, vectorToRgb, rgbUnitTo255 } from "./colorSpaces";

export type AxisTriple = [number, number, number];

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const wrapHueNormalized = (value: number) => ((((value ?? 0) % 360) + 360) % 360) / 360;
const unwrapHueNormalized = (value: number) => ((((value ?? 0) % 1) + 1) % 1) * 360;
const OKLCH_CHROMA_NORMALIZER = 0.4;

export function extractAxisTriple(rgb: RGBColor, mode: ColorInterpolationMode): AxisTriple {
    const vector = rgb255ToVector(rgb, mode) as any;
    return vectorToAxes(vector, mode);
}

export function applyAxisTripleToRgb(rgb: RGBColor, axes: AxisTriple, mode: ColorInterpolationMode): RGBColor {
    const vector = rgb255ToVector(rgb, mode) as any;
    assignAxesToVector(vector, mode, axes);
    const rgbUnit = vectorToRgb(vector, mode);
    return rgbUnitTo255(rgbUnit);
}

function vectorToAxes(vector: any, mode: ColorInterpolationMode): AxisTriple {
    switch (mode) {
        case "rgb":
            return [vector.r, vector.g, vector.b];
        case "hsl":
            return [wrapHueNormalized(vector.h), clamp01(vector.s), clamp01(vector.l)];
        case "hsv":
            return [wrapHueNormalized(vector.h), clamp01(vector.s), clamp01(vector.v)];
        case "hwb":
            return [wrapHueNormalized(vector.h), clamp01(vector.w), clamp01(vector.b)];
        case "cmy":
            return [clamp01(vector.c), clamp01(vector.m), clamp01(vector.y)];
        case "cmyk":
            return [clamp01(vector.c), clamp01(vector.m), clamp01(vector.y)];
        case "luma-rgb":
        case "luma-lab":
        case "luma-oklab":
            return [clamp01(vector.l), 0, 0];
        case "lab":
            return [vector.l / 100, (vector.a + 128) / 256, (vector.b + 128) / 256];
        case "oklab":
            return [vector.L, vector.a, vector.b];
        case "ycbcr":
            return [vector.y, vector.cb, vector.cr];
        case "oklch":
            return [vector.L, vector.C / OKLCH_CHROMA_NORMALIZER, wrapHueNormalized(vector.h)];
        default:
            return [vector.r ?? 0, vector.g ?? 0, vector.b ?? 0];
    }
}

function assignAxesToVector(vector: any, mode: ColorInterpolationMode, axes: AxisTriple) {
    switch (mode) {
        case "rgb":
            vector.r = clamp01(axes[0]);
            vector.g = clamp01(axes[1]);
            vector.b = clamp01(axes[2]);
            break;
        case "hsl":
            vector.h = unwrapHueNormalized(axes[0]);
            vector.s = clamp01(axes[1]);
            vector.l = clamp01(axes[2]);
            break;
        case "hsv":
            vector.h = unwrapHueNormalized(axes[0]);
            vector.s = clamp01(axes[1]);
            vector.v = clamp01(axes[2]);
            break;
        case "hwb":
            vector.h = unwrapHueNormalized(axes[0]);
            vector.w = clamp01(axes[1]);
            vector.b = clamp01(axes[2]);
            break;
        case "cmy":
            vector.c = clamp01(axes[0]);
            vector.m = clamp01(axes[1]);
            vector.y = clamp01(axes[2]);
            break;
        case "cmyk":
            vector.c = clamp01(axes[0]);
            vector.m = clamp01(axes[1]);
            vector.y = clamp01(axes[2]);
            break;
        case "luma-rgb":
        case "luma-lab":
        case "luma-oklab":
            vector.l = clamp01(axes[0]);
            break;
        case "lab":
            vector.l = clamp(axes[0] * 100, 0, 100);
            vector.a = clamp(axes[1] * 256 - 128, -128, 128);
            vector.b = clamp(axes[2] * 256 - 128, -128, 128);
            break;
        case "oklab":
            vector.L = clamp01(axes[0]);
            vector.a = clamp(axes[1], -0.5, 0.5);
            vector.b = clamp(axes[2], -0.5, 0.5);
            break;
        case "ycbcr":
            vector.y = axes[0];
            vector.cb = axes[1];
            vector.cr = axes[2];
            break;
        case "oklch":
            vector.L = clamp01(axes[0]);
            vector.C = Math.max(0, axes[1] * OKLCH_CHROMA_NORMALIZER);
            vector.h = unwrapHueNormalized(axes[2]);
            break;
        default:
            vector.r = clamp01(axes[0]);
            vector.g = clamp01(axes[1]);
            vector.b = clamp01(axes[2]);
            break;
    }
}
