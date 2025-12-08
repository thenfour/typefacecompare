import { RGB, hexToRgb, oklchToSrgbHex, rgbToLab } from "./color";

export type ColorInterpolationMode =
    | "rgb"
    | "hsl"
    | "hsv"
    | "luma-rgb"
    | "luma-lab"
    | "luma-oklab"
    | "lab"
    | "ycbcr"
    | "oklab"
    | "oklch";

export interface RGBColor {
    r: number;
    g: number;
    b: number;
}

interface HSLVector { h: number; s: number; l: number; }
interface HSVVector { h: number; s: number; v: number; }
interface LabVector { l: number; a: number; b: number; }
interface YCbCrVector { y: number; cb: number; cr: number; }
interface OklabVector { L: number; a: number; b: number; }
interface OklchVector { L: number; C: number; h: number; }
interface LumaVector { l: number; }

export type ColorVector =
    | RGB
    | HSLVector
    | HSVVector
    | LumaVector
    | LabVector
    | YCbCrVector
    | OklabVector
    | OklchVector;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const clamp255 = (value: number) => Math.min(255, Math.max(0, value));

export function rgb255ToUnit(color: RGBColor): RGB {
    return {
        r: clamp01(color.r / 255),
        g: clamp01(color.g / 255),
        b: clamp01(color.b / 255)
    };
}

export function rgbUnitTo255(color: RGB): RGBColor {
    return {
        r: clamp255(color.r * 255),
        g: clamp255(color.g * 255),
        b: clamp255(color.b * 255)
    };
}

export function interpolateGradientColor(corners: string[], u: number, v: number, mode: ColorInterpolationMode): RGBColor {
    if (corners.length < 4) {
        throw new Error("Expected four corner colors for bilinear gradient");
    }

    const [topLeft, topRight, bottomLeft, bottomRight] = corners;
    const tl = convertHexToVector(topLeft, mode);
    const tr = convertHexToVector(topRight, mode);
    const bl = convertHexToVector(bottomLeft, mode);
    const br = convertHexToVector(bottomRight, mode);

    const top = mixVectors(tl, tr, u, mode);
    const bottom = mixVectors(bl, br, u, mode);
    const blended = mixVectors(top, bottom, v, mode);

    const rgbUnit = vectorToRgb(blended, mode);
    return rgbUnitTo255(rgbUnit);
}

export function mixColorVectorsWeighted(vectors: ColorVector[], weights: number[], mode: ColorInterpolationMode): ColorVector {
    if (vectors.length === 0) {
        throw new Error("Cannot mix zero color vectors");
    }
    let accumulator: ColorVector | null = null;
    let accumulatedWeight = 0;
    for (let index = 0; index < vectors.length; index++) {
        const weight = Math.max(0, weights[index] ?? 0);
        if (!Number.isFinite(weight) || weight <= 0) {
            continue;
        }
        if (!accumulator) {
            accumulator = vectors[index];
            accumulatedWeight = weight;
            continue;
        }
        const nextTotal = accumulatedWeight + weight;
        if (nextTotal <= 0) {
            continue;
        }
        const t = weight / nextTotal;
        accumulator = mixVectors(accumulator, vectors[index], t, mode);
        accumulatedWeight = nextTotal;
    }
    return accumulator ?? vectors[0];
}

function mixVectors(a: ColorVector, b: ColorVector, t: number, mode: ColorInterpolationMode): ColorVector {
    const lerp = (start: number, end: number) => start + (end - start) * t;

    switch (mode) {
        case "rgb":
            return {
                r: lerp((a as RGB).r, (b as RGB).r),
                g: lerp((a as RGB).g, (b as RGB).g),
                b: lerp((a as RGB).b, (b as RGB).b)
            } satisfies RGB;
        case "hsl":
            return mixPolarHsl(a as HSLVector, b as HSLVector, lerp);
        case "hsv":
            return mixPolarHsv(a as HSVVector, b as HSVVector, lerp);
        case "luma-rgb":
        case "luma-lab":
        case "luma-oklab":
            return {
                l: lerp((a as LumaVector).l, (b as LumaVector).l)
            } satisfies LumaVector;
        case "lab":
            return {
                l: lerp((a as LabVector).l, (b as LabVector).l),
                a: lerp((a as LabVector).a, (b as LabVector).a),
                b: lerp((a as LabVector).b, (b as LabVector).b)
            } satisfies LabVector;
        case "oklab":
            return {
                L: lerp((a as OklabVector).L, (b as OklabVector).L),
                a: lerp((a as OklabVector).a, (b as OklabVector).a),
                b: lerp((a as OklabVector).b, (b as OklabVector).b)
            } satisfies OklabVector;
        case "ycbcr":
            return {
                y: lerp((a as YCbCrVector).y, (b as YCbCrVector).y),
                cb: lerp((a as YCbCrVector).cb, (b as YCbCrVector).cb),
                cr: lerp((a as YCbCrVector).cr, (b as YCbCrVector).cr)
            } satisfies YCbCrVector;
        case "oklch":
            return mixPolarOklch(a as OklchVector, b as OklchVector, lerp);
        default:
            return a;
    }
}

function mixPolarHsl(a: HSLVector, b: HSLVector, lerp: (start: number, end: number) => number): HSLVector {
    const [ax, ay] = polarToCartesian(a.s, a.h);
    const [bx, by] = polarToCartesian(b.s, b.h);
    const mx = lerp(ax, bx);
    const my = lerp(ay, by);
    const { radius, angleDegrees } = cartesianToPolar(mx, my);
    return {
        h: angleDegrees,
        s: clamp01(radius),
        l: lerp(a.l, b.l)
    } satisfies HSLVector;
}

function mixPolarHsv(a: HSVVector, b: HSVVector, lerp: (start: number, end: number) => number): HSVVector {
    const [ax, ay] = polarToCartesian(a.s, a.h);
    const [bx, by] = polarToCartesian(b.s, b.h);
    const mx = lerp(ax, bx);
    const my = lerp(ay, by);
    const { radius, angleDegrees } = cartesianToPolar(mx, my);
    return {
        h: angleDegrees,
        s: clamp01(radius),
        v: lerp(a.v, b.v)
    } satisfies HSVVector;
}

function mixPolarOklch(a: OklchVector, b: OklchVector, lerp: (start: number, end: number) => number): OklchVector {
    const [ax, ay] = polarToCartesian(a.C, a.h);
    const [bx, by] = polarToCartesian(b.C, b.h);
    const mx = lerp(ax, bx);
    const my = lerp(ay, by);
    const { radius, angleDegrees } = cartesianToPolar(mx, my);
    return {
        L: lerp(a.L, b.L),
        C: Math.max(0, radius),
        h: angleDegrees
    } satisfies OklchVector;
}

function lerpAngle(a: number, b: number, t: number) {
    const delta = ((((b - a) % 360) + 540) % 360) - 180;
    let value = a + delta * t;
    if (value < 0) value += 360;
    if (value >= 360) value -= 360;
    return value;
}

export function convertHexToVector(hex: string, mode: ColorInterpolationMode): ColorVector {
    const rgb = hexToRgb(hex);
    return rgbToVector(rgb, mode);
}

export function rgbUnitToVector(rgb: RGB, mode: ColorInterpolationMode): ColorVector {
    return rgbToVector(rgb, mode);
}

export function rgb255ToVector(color: RGBColor, mode: ColorInterpolationMode): ColorVector {
    const unit = rgb255ToUnit(color);
    return rgbToVector(unit, mode);
}

function rgbToVector(rgb: RGB, mode: ColorInterpolationMode): ColorVector {
    switch (mode) {
        case "rgb":
            return { ...rgb } satisfies RGB;
        case "hsl":
            return rgbToHsl(rgb);
        case "hsv":
            return rgbToHsv(rgb);
        case "luma-rgb":
            return rgbToLumaRgb(rgb);
        case "luma-lab":
            return rgbToLumaLab(rgb);
        case "luma-oklab":
            return rgbToLumaOklab(rgb);
        case "lab":
            return rgbToLab(rgb);
        case "oklab":
            return rgbToOklab(rgb);
        case "ycbcr":
            return rgbToYcbcr(rgb);
        case "oklch":
            return rgbToOklch(rgb);
        default:
            return rgb;
    }
}

export function vectorToRgb(vector: ColorVector, mode: ColorInterpolationMode): RGB {
    switch (mode) {
        case "rgb":
            return clampRgb(vector as RGB);
        case "hsl":
            return clampRgb(hslToRgb(vector as HSLVector));
        case "hsv":
            return clampRgb(hsvToRgb(vector as HSVVector));
        case "luma-rgb":
        case "luma-lab":
        case "luma-oklab":
            return clampRgb(lumaToRgb(vector as LumaVector));
        case "lab":
            return clampRgb(labToRgb(vector as LabVector));
        case "oklab":
            return clampRgb(oklabToRgb(vector as OklabVector));
        case "ycbcr":
            return clampRgb(ycbcrToRgb(vector as YCbCrVector));
        case "oklch":
            return clampRgb(oklchToRgb(vector as OklchVector));
        default:
            return clampRgb(vector as RGB);
    }
}

function clampRgb(color: RGB): RGB {
    return {
        r: clamp01(color.r),
        g: clamp01(color.g),
        b: clamp01(color.b)
    };
}

// HSL conversion helpers
function rgbToHsl(rgb: RGB): HSLVector {
    const r = rgb.r;
    const g = rgb.g;
    const b = rgb.b;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0));
                break;
            case g:
                h = ((b - r) / d + 2);
                break;
            case b:
                h = ((r - g) / d + 4);
                break;
        }
        h *= 60;
    }

    return { h, s, l };
}

function hslToRgb(hsl: HSLVector): RGB {
    const h = ((hsl.h % 360) + 360) % 360;
    const s = clamp01(hsl.s);
    const l = clamp01(hsl.l);

    if (s === 0) {
        return { r: l, g: l, b: l };
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hk = h / 360;

    const tr = hueToRgb(p, q, hk + 1 / 3);
    const tg = hueToRgb(p, q, hk);
    const tb = hueToRgb(p, q, hk - 1 / 3);

    return { r: tr, g: tg, b: tb };
}

function hueToRgb(p: number, q: number, t: number) {
    let temp = t;
    if (temp < 0) temp += 1;
    if (temp > 1) temp -= 1;
    if (temp < 1 / 6) return p + (q - p) * 6 * temp;
    if (temp < 1 / 2) return q;
    if (temp < 2 / 3) return p + (q - p) * (2 / 3 - temp) * 6;
    return p;
}

// HSV conversion helpers
function rgbToHsv(rgb: RGB): HSVVector {
    const r = rgb.r;
    const g = rgb.g;
    const b = rgb.b;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let h = 0;
    const s = max === 0 ? 0 : delta / max;
    const v = max;

    if (delta !== 0) {
        if (max === r) {
            h = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
        } else if (max === g) {
            h = ((b - r) / delta + 2) * 60;
        } else {
            h = ((r - g) / delta + 4) * 60;
        }
    }

    return { h, s, v } satisfies HSVVector;
}

function hsvToRgb(hsv: HSVVector): RGB {
    const h = ((hsv.h % 360) + 360) % 360;
    const s = clamp01(hsv.s);
    const v = clamp01(hsv.v);
    if (s === 0) {
        return { r: v, g: v, b: v } satisfies RGB;
    }
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;

    let r1 = 0;
    let g1 = 0;
    let b1 = 0;
    if (h < 60) {
        r1 = c;
        g1 = x;
    } else if (h < 120) {
        r1 = x;
        g1 = c;
    } else if (h < 180) {
        g1 = c;
        b1 = x;
    } else if (h < 240) {
        g1 = x;
        b1 = c;
    } else if (h < 300) {
        r1 = x;
        b1 = c;
    } else {
        r1 = c;
        b1 = x;
    }

    return {
        r: clamp01(r1 + m),
        g: clamp01(g1 + m),
        b: clamp01(b1 + m)
    } satisfies RGB;
}

function polarToCartesian(radius: number, degrees: number) {
    const radians = (((degrees ?? 0) % 360) + 360) % 360 * (Math.PI / 180);
    return [radius * Math.cos(radians), radius * Math.sin(radians)];
}

function cartesianToPolar(x: number, y: number) {
    const radius = Math.sqrt(x * x + y * y);
    const angleDegrees = (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
    return { radius, angleDegrees };
}

function rgbToLumaRgb(rgb: RGB): LumaVector {
    const l = clamp01(0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b);
    return { l } satisfies LumaVector;
}

function rgbToLumaLab(rgb: RGB): LumaVector {
    const lab = rgbToLab(rgb);
    return { l: clamp01(lab.l / 100) } satisfies LumaVector;
}

function rgbToLumaOklab(rgb: RGB): LumaVector {
    const oklab = rgbToOklab(rgb);
    return { l: clamp01(oklab.L) } satisfies LumaVector;
}

function lumaToRgb(vec: LumaVector): RGB {
    const value = clamp01(vec.l);
    return { r: value, g: value, b: value } satisfies RGB;
}

// YCbCr helpers (BT.601)
function rgbToYcbcr(rgb: RGB): YCbCrVector {
    const y = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
    const cb = (rgb.b - y) * 0.564 + 0.5;
    const cr = (rgb.r - y) * 0.713 + 0.5;
    return { y: clamp01(y), cb: clamp01(cb), cr: clamp01(cr) };
}

function ycbcrToRgb(vec: YCbCrVector): RGB {
    const y = vec.y;
    const cb = vec.cb - 0.5;
    const cr = vec.cr - 0.5;

    const r = y + 1.402 * cr;
    const g = y - 0.344136 * cb - 0.714136 * cr;
    const b = y + 1.772 * cb;
    return { r: clamp01(r), g: clamp01(g), b: clamp01(b) };
}

// LAB helpers
function labToRgb(lab: LabVector): RGB {
    const { x, y, z } = labToXyz(lab);
    return xyzToRgb({ x, y, z });
}

function labToXyz(lab: LabVector) {
    const yn = 1.0;
    const xn = 0.95047;
    const zn = 1.08883;
    const delta = 6 / 29;

    const fy = (lab.l + 16) / 116;
    const fx = fy + lab.a / 500;
    const fz = fy - lab.b / 200;

    const fx3 = fx * fx * fx;
    const fy3 = fy * fy * fy;
    const fz3 = fz * fz * fz;

    const xr = fx3 > delta * delta * delta ? fx3 : (fx - 4 / 29) * 3 * delta * delta;
    const yr = fy3 > delta * delta * delta ? fy3 : (fy - 4 / 29) * 3 * delta * delta;
    const zr = fz3 > delta * delta * delta ? fz3 : (fz - 4 / 29) * 3 * delta * delta;

    return {
        x: xr * xn,
        y: yr * yn,
        z: zr * zn
    };
}

function xyzToRgb(xyz: { x: number; y: number; z: number }): RGB {
    const rLin = xyz.x * 3.2404542 + xyz.y * -1.5371385 + xyz.z * -0.4985314;
    const gLin = xyz.x * -0.9692660 + xyz.y * 1.8760108 + xyz.z * 0.0415560;
    const bLin = xyz.x * 0.0556434 + xyz.y * -0.2040259 + xyz.z * 1.0572252;

    return {
        r: linearToSrgb(rLin),
        g: linearToSrgb(gLin),
        b: linearToSrgb(bLin)
    };
}

function linearToSrgb(value: number) {
    if (value <= 0.0031308) {
        return clamp01(12.92 * value);
    }
    return clamp01(1.055 * Math.pow(value, 1 / 2.4) - 0.055);
}

// OKLCH helpers
function rgbToOklch(rgb: RGB): OklchVector {
    const lms = rgbToOklab(rgb);
    const C = Math.sqrt(lms.a * lms.a + lms.b * lms.b);
    let h = Math.atan2(lms.b, lms.a) * (180 / Math.PI);
    if (h < 0) h += 360;
    return { L: lms.L, C, h };
}

function rgbToOklab(rgb: RGB): { L: number; a: number; b: number } {
    const r = srgbToLinearChannel(rgb.r);
    const g = srgbToLinearChannel(rgb.g);
    const b = srgbToLinearChannel(rgb.b);

    const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

    const lRoot = Math.cbrt(l);
    const mRoot = Math.cbrt(m);
    const sRoot = Math.cbrt(s);

    const L = 0.2104542553 * lRoot + 0.7936177850 * mRoot - 0.0040720468 * sRoot;
    const a = 1.9779984951 * lRoot - 2.4285922050 * mRoot + 0.4505937099 * sRoot;
    const bVal = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.8086757660 * sRoot;

    return { L, a, b: bVal };
}

function srgbToLinearChannel(value: number) {
    if (value <= 0.04045) {
        return value / 12.92;
    }
    return Math.pow((value + 0.055) / 1.055, 2.4);
}

function oklchToRgb(vec: OklchVector): RGB {
    const { rgb } = oklchToSrgbHex(vec.L, vec.C, vec.h);
    return rgb;
}

function oklabToRgb(vec: OklabVector): RGB {
    const l_ = vec.L + 0.3963377774 * vec.a + 0.2158037573 * vec.b;
    const m_ = vec.L - 0.1055613458 * vec.a - 0.0638541728 * vec.b;
    const s_ = vec.L - 0.0894841775 * vec.a - 1.2914855480 * vec.b;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    const rLin = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

    return {
        r: linearToSrgb(rLin),
        g: linearToSrgb(gLin),
        b: linearToSrgb(bLin)
    } satisfies RGB;
}
