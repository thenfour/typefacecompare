import { GeneratedVariation, PaletteSwatch, Variation } from "../types/palette";

export type RGB = { r: number; g: number; b: number };

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }

function linToSrgb(u: number) {
    return u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(u, 1 / 2.4) - 0.055;
}

export function oklchToSrgbHex(L: number, C: number, hDeg: number): { hex: string; rgb: RGB; inGamut: boolean } {
    const rad = (hDeg * Math.PI) / 180;
    const a = Math.cos(rad) * C;
    const b = Math.sin(rad) * C;

    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    let r_lin = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    let g_lin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    let b_lin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

    const inGamut = r_lin >= 0 && r_lin <= 1 && g_lin >= 0 && g_lin <= 1 && b_lin >= 0 && b_lin <= 1;

    const rgb: RGB = { r: clamp01(linToSrgb(r_lin)), g: clamp01(linToSrgb(g_lin)), b: clamp01(linToSrgb(b_lin)) };
    const hex = rgbToHex(rgb);
    return { hex, rgb, inGamut };
}

export function rgbToHex({ r, g, b }: RGB): string {
    const to = (v: number) => {
        const n = Math.round(clamp01(v) * 255);
        return n.toString(16).padStart(2, "0");
    };
    return `#${to(r)}${to(g)}${to(b)}`;
}

export function hexToRgb(hex: string): RGB {
    const s = hex.replace(/#/g, "");
    const r = parseInt(s.substring(0, 2), 16) / 255;
    const g = parseInt(s.substring(2, 4), 16) / 255;
    const b = parseInt(s.substring(4, 6), 16) / 255;
    return { r, g, b };
}

export function srgbToLinear({ r, g, b }: RGB): RGB {
    const f = (u: number) => (u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4));
    return { r: f(r), g: f(g), b: f(b) };
}

export function relativeLuminance(rgb: RGB) {
    const lin = srgbToLinear(rgb);
    return 0.2126 * lin.r + 0.7152 * lin.g + 0.0722 * lin.b;
}

export function wcagContrast(a: RGB, b: RGB) {
    const L1 = relativeLuminance(a);
    const L2 = relativeLuminance(b);
    const hi = Math.max(L1, L2);
    const lo = Math.min(L1, L2);
    return (hi + 0.05) / (lo + 0.05);
}

export function rgbToXyz(rgb: RGB): { x: number; y: number; z: number } {
    const { r, g, b } = srgbToLinear(rgb);
    const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
    const y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
    const z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;
    return { x, y, z };
}

function labF(t: number): number {
    const delta = 6 / 29;
    return t > delta * delta * delta ? Math.pow(t, 1 / 3) : (t / (3 * delta * delta) + 4 / 29);
}

export function xyzToLab(xyz: { x: number; y: number; z: number }): { l: number; a: number; b: number } {
    const xn = 0.95047;
    const yn = 1.00000;
    const zn = 1.08883;

    const fx = labF(xyz.x / xn);
    const fy = labF(xyz.y / yn);
    const fz = labF(xyz.z / zn);

    const l = 116 * fy - 16;
    const a = 500 * (fx - fy);
    const b = 200 * (fy - fz);

    return { l, a, b };
}

export function rgbToLab(rgb: RGB): { l: number; a: number; b: number } {
    return xyzToLab(rgbToXyz(rgb));
}

export function deltaE(rgb1: RGB, rgb2: RGB): number {
    const lab1 = rgbToLab(rgb1);
    const lab2 = rgbToLab(rgb2);

    const dl = lab1.l - lab2.l;
    const da = lab1.a - lab2.a;
    const db = lab1.b - lab2.b;

    return Math.sqrt(dl * dl + da * da + db * db);
}

export function findClosestColor(targetIndex: number, palette: ReadonlyArray<{ hex: string }>): { index: number; distance: number } {
    let closestIndex = -1;
    let minDistance = Infinity;

    for (let i = 0; i < palette.length; i++) {
        if (i === targetIndex) continue;

        const targetRgb = hexToRgb(palette[targetIndex].hex);
        const compareRgb = hexToRgb(palette[i].hex);
        const distance = deltaE(targetRgb, compareRgb);

        if (distance < minDistance) {
            minDistance = distance;
            closestIndex = i;
        }
    }

    return { index: closestIndex, distance: minDistance };
}

export function orderPaletteMaxContrast(palette: PaletteSwatch[]): PaletteSwatch[] {
    if (palette.length <= 1) return [...palette];

    const ordered = [palette[0]];
    const remaining = palette.slice(1);

    while (remaining.length > 0) {
        const lastColor = ordered[ordered.length - 1];
        let maxDistance = -1;
        let bestIndex = 0;

        for (let i = 0; i < remaining.length; i++) {
            const distance = deltaE(hexToRgb(lastColor.hex), hexToRgb(remaining[i].hex));
            if (distance > maxDistance) {
                maxDistance = distance;
                bestIndex = i;
            }
        }

        ordered.push(remaining[bestIndex]);
        remaining.splice(bestIndex, 1);
    }

    return ordered;
}

export function orderPaletteMinContrast(palette: PaletteSwatch[]): PaletteSwatch[] {
    if (palette.length <= 1) return [...palette];

    const ordered = [palette[0]];
    const remaining = palette.slice(1);

    while (remaining.length > 0) {
        const lastColor = ordered[ordered.length - 1];
        let minDistance = Infinity;
        let bestIndex = 0;

        for (let i = 0; i < remaining.length; i++) {
            const distance = deltaE(hexToRgb(lastColor.hex), hexToRgb(remaining[i].hex));
            if (distance < minDistance) {
                minDistance = distance;
                bestIndex = i;
            }
        }

        ordered.push(remaining[bestIndex]);
        remaining.splice(bestIndex, 1);
    }

    return ordered;
}

export function generateVariation(baseL: number, baseC: number, baseH: number, variation: Variation): GeneratedVariation {
    const newL = Math.max(0, Math.min(1, baseL + variation.deltaL));
    const newC = Math.max(0, Math.min(0.4, baseC + variation.deltaC));
    let newH = (baseH + variation.deltaH) % 360;
    if (newH < 0) newH += 360;

    const result = gamutFitByChroma(newL, newC, newH);
    return {
        hex: result.hex,
        L: newL,
        C: result.C,
        h: newH,
        inGamut: result.inGamut
    };
}

export function gamutFitByChroma(L: number, C: number, hDeg: number, maxIter = 48) {
    let c = C;
    let res = oklchToSrgbHex(L, c, hDeg);
    let i = 0;
    while (!res.inGamut && i < maxIter) {
        c *= 0.96;
        res = oklchToSrgbHex(L, c, hDeg);
        i++;
    }
    return { ...res, C: c };
}

export function findLForContrast({ baseL, C, hDeg, label, target, preferLight }: {
    baseL: number; C: number; hDeg: number; label: RGB; target: number; preferLight: boolean;
}) {
    let lo = preferLight ? baseL : 0.02;
    let hi = preferLight ? 0.98 : baseL;
    let best = gamutFitByChroma(baseL, C, hDeg);
    if (wcagContrast(hexToRgb(best.hex), label) >= target) return { ...best, L: baseL };

    for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2;
        const cand = gamutFitByChroma(mid, C, hDeg);
        const ratio = wcagContrast(hexToRgb(cand.hex), label);
        const ok = ratio >= target;
        if (preferLight) {
            if (ok) { best = { ...cand }; hi = mid; } else { lo = mid; }
        } else {
            if (ok) { best = { ...cand }; lo = mid; } else { hi = mid; }
        }
    }
    return { ...best, L: preferLight ? hi : lo };
}

export function mulberry32(seed: number) {
    let t = seed >>> 0;
    return function () {
        t |= 0; t = (t + 0x6D2B79F5) | 0;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}
