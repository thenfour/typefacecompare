import { RGB, hexToRgb, oklchToSrgbHex, rgbToLab } from "./color";

export type ColorInterpolationMode = "rgb" | "hsl" | "cmyk" | "lab" | "ycbcr" | "oklch";

export interface RGBColor {
    r: number;
    g: number;
    b: number;
}

interface HSLVector { h: number; s: number; l: number; }
interface CMYKVector { c: number; m: number; y: number; k: number; }
interface LabVector { l: number; a: number; b: number; }
interface YCbCrVector { y: number; cb: number; cr: number; }
interface OklchVector { L: number; C: number; h: number; }

type ColorVector = RGB | HSLVector | CMYKVector | LabVector | YCbCrVector | OklchVector;

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
            return {
                h: lerpAngle((a as HSLVector).h, (b as HSLVector).h, t),
                s: lerp((a as HSLVector).s, (b as HSLVector).s),
                l: lerp((a as HSLVector).l, (b as HSLVector).l)
            } satisfies HSLVector;
        case "cmyk":
            return {
                c: lerp((a as CMYKVector).c, (b as CMYKVector).c),
                m: lerp((a as CMYKVector).m, (b as CMYKVector).m),
                y: lerp((a as CMYKVector).y, (b as CMYKVector).y),
                k: lerp((a as CMYKVector).k, (b as CMYKVector).k)
            } satisfies CMYKVector;
        case "lab":
            return {
                l: lerp((a as LabVector).l, (b as LabVector).l),
                a: lerp((a as LabVector).a, (b as LabVector).a),
                b: lerp((a as LabVector).b, (b as LabVector).b)
            } satisfies LabVector;
        case "ycbcr":
            return {
                y: lerp((a as YCbCrVector).y, (b as YCbCrVector).y),
                cb: lerp((a as YCbCrVector).cb, (b as YCbCrVector).cb),
                cr: lerp((a as YCbCrVector).cr, (b as YCbCrVector).cr)
            } satisfies YCbCrVector;
        case "oklch":
            return {
                L: lerp((a as OklchVector).L, (b as OklchVector).L),
                C: lerp((a as OklchVector).C, (b as OklchVector).C),
                h: lerpAngle((a as OklchVector).h, (b as OklchVector).h, t)
            } satisfies OklchVector;
        default:
            return a;
    }
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
        case "cmyk":
            return rgbToCmyk(rgb);
        case "lab":
            return rgbToLab(rgb);
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
        case "cmyk":
            return clampRgb(cmykToRgb(vector as CMYKVector));
        case "lab":
            return clampRgb(labToRgb(vector as LabVector));
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

// CMYK helpers
function rgbToCmyk(rgb: RGB): CMYKVector {
    const c = 1 - rgb.r;
    const m = 1 - rgb.g;
    const y = 1 - rgb.b;
    const k = Math.min(c, m, y);

    if (k === 1) {
        return { c: 0, m: 0, y: 0, k: 1 };
    }

    return {
        c: (c - k) / (1 - k),
        m: (m - k) / (1 - k),
        y: (y - k) / (1 - k),
        k
    };
}

function cmykToRgb(cmyk: CMYKVector): RGB {
    const r = (1 - cmyk.c) * (1 - cmyk.k);
    const g = (1 - cmyk.m) * (1 - cmyk.k);
    const b = (1 - cmyk.y) * (1 - cmyk.k);
    return { r: clamp01(r), g: clamp01(g), b: clamp01(b) };
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
