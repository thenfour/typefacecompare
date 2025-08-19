import Head from "next/head";
import React, { useMemo, useState } from "react";
import "../styles/PaletteLab.css";

// --- Minimal OKLCH → sRGB + WCAG contrast utilities (no deps) -----------------
// OKLCH and Oklab formulae per Björn Ottosson (2020)

type RGB = { r: number; g: number; b: number }; // sRGB [0..1]

type Variation = {
    name: string;
    deltaL: number;    // -1.0 to +1.0 (full range)
    deltaC: number;    // -0.5 to +0.5 (full chroma range)
    deltaH: number;    // -180° to +180° (full hue wheel)
    enabled: boolean;
};

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }

function oklchToSrgbHex(L: number, C: number, hDeg: number): { hex: string; rgb: RGB; inGamut: boolean } {
    const rad = (hDeg * Math.PI) / 180;
    const a = Math.cos(rad) * C;
    const b = Math.sin(rad) * C;

    // Oklab → LMS' (nonlinear)
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

    // Remove cube root nonlinearity
    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    // LMS → linear sRGB
    let r_lin = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    let g_lin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    let b_lin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

    const inGamut = r_lin >= 0 && r_lin <= 1 && g_lin >= 0 && g_lin <= 1 && b_lin >= 0 && b_lin <= 1;

    function linToSrgb(u: number) {
        return u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(u, 1 / 2.4) - 0.055;
    }

    const rgb: RGB = { r: clamp01(linToSrgb(r_lin)), g: clamp01(linToSrgb(g_lin)), b: clamp01(linToSrgb(b_lin)) };
    const hex = rgbToHex(rgb);
    return { hex, rgb, inGamut };
}

function rgbToHex({ r, g, b }: RGB): string {
    const to = (v: number) => {
        const n = Math.round(clamp01(v) * 255);
        return n.toString(16).padStart(2, "0");
    };
    return `#${to(r)}${to(g)}${to(b)}`;
}

function hexToRgb(hex: string): RGB {
    const s = hex.replace(/#/g, "");
    const r = parseInt(s.substring(0, 2), 16) / 255;
    const g = parseInt(s.substring(2, 4), 16) / 255;
    const b = parseInt(s.substring(4, 6), 16) / 255;
    return { r, g, b };
}

function srgbToLinear({ r, g, b }: RGB): RGB {
    const f = (u: number) => (u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4));
    return { r: f(r), g: f(g), b: f(b) };
}

function relativeLuminance(rgb: RGB) {
    const lin = srgbToLinear(rgb);
    return 0.2126 * lin.r + 0.7152 * lin.g + 0.0722 * lin.b;
}

function wcagContrast(a: RGB, b: RGB) {
    const L1 = relativeLuminance(a);
    const L2 = relativeLuminance(b);
    const hi = Math.max(L1, L2);
    const lo = Math.min(L1, L2);
    return (hi + 0.05) / (lo + 0.05);
}

// Convert sRGB to XYZ color space
function rgbToXyz(rgb: RGB): { x: number; y: number; z: number } {
    const { r, g, b } = srgbToLinear(rgb);

    // sRGB to XYZ matrix (D65 illuminant)
    const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
    const y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
    const z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;

    return { x, y, z };
}

// Convert XYZ to Lab color space
function xyzToLab(xyz: { x: number; y: number; z: number }): { l: number; a: number; b: number } {
    // D65 illuminant white point
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

// Lab f function
function labF(t: number): number {
    const delta = 6 / 29;
    return t > delta * delta * delta ? Math.pow(t, 1 / 3) : (t / (3 * delta * delta) + 4 / 29);
}

// Convert RGB directly to Lab
function rgbToLab(rgb: RGB): { l: number; a: number; b: number } {
    return xyzToLab(rgbToXyz(rgb));
}

// Calculate Delta E CIE76 color difference (perceptually accurate)
function deltaE(rgb1: RGB, rgb2: RGB): number {
    const lab1 = rgbToLab(rgb1);
    const lab2 = rgbToLab(rgb2);

    const dl = lab1.l - lab2.l;
    const da = lab1.a - lab2.a;
    const db = lab1.b - lab2.b;

    return Math.sqrt(dl * dl + da * da + db * db);
}

// Find the closest color in a palette to a given color (excluding itself)
function findClosestColor(targetIndex: number, palette: any[]): { index: number; distance: number } {
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

// Order palette to maximize contrast between adjacent colors using greedy algorithm
function orderPaletteMaxContrast(palette: any[]): any[] {
    if (palette.length <= 1) return [...palette];

    const ordered = [palette[0]]; // Start with first color
    const remaining = palette.slice(1);

    while (remaining.length > 0) {
        const lastColor = ordered[ordered.length - 1];
        let maxDistance = -1;
        let bestIndex = 0;

        // Find the color with maximum distance to the last ordered color
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

// Order palette to minimize contrast between adjacent colors using nearest neighbor
function orderPaletteMinContrast(palette: any[]): any[] {
    if (palette.length <= 1) return [...palette];

    const ordered = [palette[0]]; // Start with first color
    const remaining = palette.slice(1);

    while (remaining.length > 0) {
        const lastColor = ordered[ordered.length - 1];
        let minDistance = Infinity;
        let bestIndex = 0;

        // Find the color with minimum distance to the last ordered color
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
}// Generate a variation of a color by modulating OKLCH values
function generateVariation(baseL: number, baseC: number, baseH: number, variation: Variation): { hex: string; L: number; C: number; h: number; inGamut: boolean } {
    const newL = Math.max(0, Math.min(1, baseL + variation.deltaL));
    const newC = Math.max(0, Math.min(0.4, baseC + variation.deltaC)); // Cap chroma at reasonable max
    let newH = (baseH + variation.deltaH) % 360;
    if (newH < 0) newH += 360;

    const result = gamutFitByChroma(newL, newC, newH);
    return {
        hex: result.hex,
        L: newL,
        C: result.C, // Use the gamut-fitted chroma
        h: newH,
        inGamut: result.inGamut
    };
}

function gamutFitByChroma(L: number, C: number, hDeg: number, maxIter = 48) {
    // Reduce chroma until the color is in sRGB gamut
    let c = C;
    let res = oklchToSrgbHex(L, c, hDeg);
    let i = 0;
    while (!res.inGamut && i < maxIter) {
        c *= 0.96; // gentle shrink
        res = oklchToSrgbHex(L, c, hDeg);
        i++;
    }
    return { ...res, C: c };
}

// Find the minimal L (for black label) or maximal L (for white label) to meet contrast
function findLForContrast({ baseL, C, hDeg, label, target, preferLight }: {
    baseL: number; C: number; hDeg: number; label: RGB; target: number; preferLight: boolean;
}) {
    let lo = preferLight ? baseL : 0.02;
    let hi = preferLight ? 0.98 : baseL;
    let best = gamutFitByChroma(baseL, C, hDeg);
    // Quick check: if base already meets contrast, return it (after gamut fit)
    if (wcagContrast(hexToRgb(best.hex), label) >= target) return { ...best, L: baseL };

    // Binary search on L
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

// Deterministic tiny PRNG (Mulberry32)
function mulberry32(seed: number) {
    let t = seed >>> 0;
    return function () {
        t |= 0; t = (t + 0x6D2B79F5) | 0;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

// --- UI -----------------------------------------------------------------------
function PaletteLab() {
    const [count, setCount] = useState(5);
    const [L, setL] = useState(0.78);            // light backgrounds
    const [C, setC] = useState(0.12);            // chroma (0..0.3 is reasonable)
    const [hueSpan, setHueSpan] = useState(320); // degrees spanned across palette
    const [hueOffset, setHueOffset] = useState(300); // starting hue in degrees
    const [jitter, setJitter] = useState(12);    // ± jitter in degrees
    const [targetContrast, setTargetContrast] = useState(10); // WCAG ratio
    const [labelHex, setLabelHex] = useState("#000000");
    const [equalizeL, setEqualizeL] = useState(true);
    const [seed, setSeed] = useState(12345);
    const [showSimilarColors, setShowSimilarColors] = useState(true);
    const [minColorDistance, setMinColorDistance] = useState(10);

    // Variations
    const [enableVariations, setEnableVariations] = useState(false);
    const [numVariations, setNumVariations] = useState(2);
    const [variations, setVariations] = useState<Variation[]>([
        { name: "hover", deltaL: 0.05, deltaC: -0.02, deltaH: 0, enabled: true },
        { name: "disabled", deltaL: 0.10, deltaC: -0.08, deltaH: 0, enabled: true },
        { name: "accent", deltaL: 0, deltaC: 0.02, deltaH: 30, enabled: false },
        { name: "dark", deltaL: -0.15, deltaC: 0, deltaH: 0, enabled: false },
    ]);

    const labelRgb = useMemo(() => hexToRgb(labelHex), [labelHex]);
    const preferLight = useMemo(() => wcagContrast(hexToRgb("#ffffff"), labelRgb) > wcagContrast(hexToRgb("#000000"), labelRgb), [labelRgb]);

    const palette = useMemo(() => {
        const rng = mulberry32(seed);
        const hues: number[] = [];
        for (let i = 0; i < count; i++) {
            const base = hueOffset + (hueSpan * i) / Math.max(1, count);
            const j = (rng() * 2 - 1) * jitter; // [-jitter, +jitter]
            let h = (base + j) % 360; if (h < 0) h += 360;
            hues.push(h);
        }

        // First pass: compute required L per color to meet contrast target (adjust up for black label, down for white)
        const requiredL: number[] = [];
        const colors = hues.map((h) => {
            const fit = findLForContrast({ baseL: L, C, hDeg: h, label: labelRgb, target: targetContrast, preferLight });
            requiredL.push(fit.L);
            return { h, Lfit: fit.L, Cfit: fit.C, hex: fit.hex, rgb: hexToRgb(fit.hex) };
        });

        // Equalize L across the set for similar luminance perception
        let baseColors: any[];
        if (equalizeL && colors.length > 0) {
            const Lfinal = preferLight ? Math.max(...requiredL) : Math.min(...requiredL);
            baseColors = colors.map(({ h }) => {
                const fixed = gamutFitByChroma(Lfinal, C, h);
                const rgb = hexToRgb(fixed.hex);
                const ratio = wcagContrast(rgb, labelRgb);
                return { h, L: Lfinal, C: fixed.C, hex: fixed.hex, ratio };
            });
        } else {
            baseColors = colors.map(({ h, Lfit, Cfit, hex }) => ({ h, L: Lfit, C: Cfit, hex, ratio: wcagContrast(hexToRgb(hex), labelRgb) }));
        }

        // Add closest color information and variations
        return baseColors.map((color, index) => {
            const closest = findClosestColor(index, baseColors);

            // Generate variations if enabled
            let colorVariations: any[] = [];
            if (enableVariations) {
                const activeVariations = variations.slice(0, numVariations).filter(v => v.enabled);
                colorVariations = activeVariations.map(variation => {
                    const varColor = generateVariation(color.L, color.C, color.h, variation);
                    return {
                        name: variation.name,
                        hex: varColor.hex,
                        L: varColor.L,
                        C: varColor.C,
                        h: varColor.h,
                        inGamut: varColor.inGamut
                    };
                });
            }

            return {
                ...color,
                closestIndex: closest.index,
                closestDistance: closest.distance,
                isTooSimilar: closest.distance < minColorDistance,
                variations: colorVariations
            };
        });
    }, [count, L, C, hueSpan, hueOffset, jitter, targetContrast, labelRgb, seed, equalizeL, preferLight, minColorDistance, enableVariations, numVariations, variations]);

    const allMeet = palette.every((p) => p.ratio >= targetContrast);
    const tooSimilarCount = palette.filter((p) => p.isTooSimilar).length;

    function copyHexes() {
        const list = palette.map((p) => p.hex.replace('#', '')).join(",");
        navigator.clipboard?.writeText(list);
    }

    function exportConfig() {
        const config = {
            count,
            L,
            C,
            hueSpan,
            hueOffset,
            jitter,
            targetContrast,
            minColorDistance,
            labelHex,
            equalizeL,
            showSimilarColors,
            seed,
            enableVariations,
            numVariations,
            variations
        };
        navigator.clipboard?.writeText(JSON.stringify(config, null, 2));
    }

    function importConfig() {
        navigator.clipboard?.readText().then(text => {
            try {
                const config = JSON.parse(text);
                // Validate and apply config
                if (typeof config.count === 'number') setCount(config.count);
                if (typeof config.L === 'number') setL(config.L);
                if (typeof config.C === 'number') setC(config.C);
                if (typeof config.hueSpan === 'number') setHueSpan(config.hueSpan);
                if (typeof config.hueOffset === 'number') setHueOffset(config.hueOffset);
                if (typeof config.jitter === 'number') setJitter(config.jitter);
                if (typeof config.targetContrast === 'number') setTargetContrast(config.targetContrast);
                if (typeof config.minColorDistance === 'number') setMinColorDistance(config.minColorDistance);
                if (typeof config.labelHex === 'string') setLabelHex(config.labelHex);
                if (typeof config.equalizeL === 'boolean') setEqualizeL(config.equalizeL);
                if (typeof config.showSimilarColors === 'boolean') setShowSimilarColors(config.showSimilarColors);
                if (typeof config.seed === 'number') setSeed(config.seed);
                if (typeof config.enableVariations === 'boolean') setEnableVariations(config.enableVariations);
                if (typeof config.numVariations === 'number') setNumVariations(config.numVariations);
                if (Array.isArray(config.variations)) setVariations(config.variations);
            } catch (e) {
                alert('Invalid configuration JSON. Please check the clipboard content.');
            }
        }).catch(() => {
            alert('Could not read from clipboard. Please ensure you have copied a valid configuration.');
        });
    }

    // Calculate ordered palettes for swatch lists
    const maxContrastPalette = orderPaletteMaxContrast(palette);
    const minContrastPalette = orderPaletteMinContrast(palette);

    return (
        <div className="palette-lab-container">
            <h1 className="palette-lab-title">PaletteLab — OKLCH generator</h1>
            <p className="palette-lab-muted palette-lab-small">Evenly-spaced hues with matched luminance, gamut-aware, and guaranteed contrast against a label color. Each color is shown with its closest match to help identify similar colors at a glance. Great for band handles, meters, and UI accents.</p>

            {/* Controls */}
            <div className="palette-lab-grid">
                {/* Color Parameters */}
                <div className="palette-lab-compact-panel">
                    <h3 className="palette-lab-label" style={{ marginBottom: 12 }}>Color Parameters</h3>
                    <CompactSlider label="Target L (OKLCH)" value={L} min={0.6} max={0.9} step={0.005} onChange={setL} />
                    <CompactSlider label="Chroma (OKLCH)" value={C} min={0.04} max={0.24} step={0.002} onChange={setC} />
                </div>

                {/* Hue Distribution */}
                <div className="palette-lab-compact-panel">
                    <h3 className="palette-lab-label" style={{ marginBottom: 12 }}>Hue Distribution</h3>
                    <CompactSlider label="Hue Offset (°)" value={hueOffset} min={0} max={360} step={1} onChange={setHueOffset} />
                    <CompactSlider label="Hue Span (°)" value={hueSpan} min={120} max={360} step={1} onChange={setHueSpan} />
                    <CompactSlider label="Hue Jitter (°)" value={jitter} min={0} max={30} step={1} onChange={setJitter} />
                </div>

                {/* Quality & Validation */}
                <div className="palette-lab-compact-panel">
                    <h3 className="palette-lab-label" style={{ marginBottom: 12 }}>Quality & Validation</h3>
                    <CompactSlider label="Target Contrast" value={targetContrast} min={4} max={15} step={0.1} onChange={setTargetContrast} />
                    <CompactSlider label="Min Color Distance (ΔE)" value={minColorDistance} min={1} max={50} step={0.5} onChange={setMinColorDistance} />
                    <label className="palette-lab-row palette-lab-small" style={{ marginTop: 8, justifyContent: 'flex-start' }}>
                        <input type="checkbox" checked={showSimilarColors} onChange={(e) => setShowSimilarColors(e.target.checked)} style={{ marginRight: 8 }} />
                        Show color similarity comparison
                    </label>
                </div>

                {/* Generation Settings */}
                <div className="palette-lab-compact-panel">
                    <h3 className="palette-lab-label" style={{ marginBottom: 12 }}>Generation Settings</h3>
                    <CompactSlider label="# Colors" value={count} min={3} max={12} step={1} onChange={setCount} />
                    <div className="palette-lab-slider-row">
                        <label className="palette-lab-slider-label">Seed</label>
                        <input type="number" className="palette-lab-number" style={{ flex: 1, margin: '0 8px' }} value={seed} onChange={(e) => setSeed(parseInt(e.target.value || "0", 10))} />
                        <button className="palette-lab-btn palette-lab-btn-dark" onClick={() => setSeed(Math.floor(Math.random() * 1e9))}>Shuffle</button>
                    </div>
                    <label className="palette-lab-row palette-lab-small" style={{ marginTop: 8, justifyContent: 'flex-start' }}>
                        <input type="checkbox" checked={equalizeL} onChange={(e) => setEqualizeL(e.target.checked)} style={{ marginRight: 8 }} />
                        Equalize luminance across colors
                    </label>
                </div>

                {/* Label Color */}
                <div className="palette-lab-compact-panel">
                    <h3 className="palette-lab-label" style={{ marginBottom: 12 }}>Label / Text Color</h3>
                    <div className="palette-lab-row" style={{ marginBottom: 8 }}>
                        <input type="color" value={labelHex} onChange={(e) => setLabelHex(e.target.value)} className="palette-lab-colorbox" />
                        <input className="palette-lab-input" style={{ flex: 1 }} value={labelHex} onChange={(e) => setLabelHex(e.target.value)} />
                        <button onClick={() => setLabelHex("#000000")} className="palette-lab-btn palette-lab-btn-dark">Black</button>
                        <button onClick={() => setLabelHex("#ffffff")} className="palette-lab-btn">White</button>
                    </div>
                    <div className="palette-lab-muted palette-lab-small">Target ≥ 7:1 for UI text; 10–12:1 looks crisp.</div>
                </div>

                {/* Variations */}
                <div className="palette-lab-compact-panel">
                    <h3 className="palette-lab-label" style={{ marginBottom: 12 }}>Color Variations</h3>
                    <label className="palette-lab-row palette-lab-small" style={{ marginBottom: 12, justifyContent: 'flex-start' }}>
                        <input type="checkbox" checked={enableVariations} onChange={(e) => setEnableVariations(e.target.checked)} style={{ marginRight: 8 }} />
                        Enable color variations
                    </label>

                    {enableVariations && (
                        <>
                            <CompactSlider label="# Variations" value={numVariations} min={1} max={4} step={1} onChange={setNumVariations} />

                            {variations.slice(0, numVariations).map((variation, i) => (
                                <div key={i} style={{ marginTop: 12, padding: 12, background: '#f8f8f8', borderRadius: 6 }}>
                                    <div className="palette-lab-slider-row">
                                        <input
                                            type="checkbox"
                                            checked={variation.enabled}
                                            onChange={(e) => {
                                                const newVariations = [...variations];
                                                newVariations[i].enabled = e.target.checked;
                                                setVariations(newVariations);
                                            }}
                                            style={{ marginRight: 8 }}
                                        />
                                        <input
                                            type="text"
                                            value={variation.name}
                                            onChange={(e) => {
                                                const newVariations = [...variations];
                                                newVariations[i].name = e.target.value;
                                                setVariations(newVariations);
                                            }}
                                            style={{ flex: 1, padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4 }}
                                            placeholder={`Variation ${i + 1}`}
                                        />
                                    </div>

                                    {variation.enabled && (
                                        <>
                                            <div className="palette-lab-slider-row" style={{ marginTop: 8 }}>
                                                <label className="palette-lab-slider-label" style={{ minWidth: '60px' }}>ΔL</label>
                                                <input
                                                    type="range"
                                                    min={-1}
                                                    max={1}
                                                    step={0.01}
                                                    value={variation.deltaL}
                                                    onChange={(e) => {
                                                        const newVariations = [...variations];
                                                        newVariations[i].deltaL = parseFloat(e.target.value);
                                                        setVariations(newVariations);
                                                    }}
                                                    className="palette-lab-slider-input"
                                                />
                                                <span className="palette-lab-slider-value" style={{ minWidth: '50px' }}>{variation.deltaL.toFixed(2)}</span>
                                            </div>

                                            <div className="palette-lab-slider-row">
                                                <label className="palette-lab-slider-label" style={{ minWidth: '60px' }}>ΔC</label>
                                                <input
                                                    type="range"
                                                    min={-0.5}
                                                    max={0.5}
                                                    step={0.01}
                                                    value={variation.deltaC}
                                                    onChange={(e) => {
                                                        const newVariations = [...variations];
                                                        newVariations[i].deltaC = parseFloat(e.target.value);
                                                        setVariations(newVariations);
                                                    }}
                                                    className="palette-lab-slider-input"
                                                />
                                                <span className="palette-lab-slider-value" style={{ minWidth: '50px' }}>{variation.deltaC.toFixed(2)}</span>
                                            </div>

                                            <div className="palette-lab-slider-row">
                                                <label className="palette-lab-slider-label" style={{ minWidth: '60px' }}>ΔH</label>
                                                <input
                                                    type="range"
                                                    min={-180}
                                                    max={180}
                                                    step={1}
                                                    value={variation.deltaH}
                                                    onChange={(e) => {
                                                        const newVariations = [...variations];
                                                        newVariations[i].deltaH = parseFloat(e.target.value);
                                                        setVariations(newVariations);
                                                    }}
                                                    className="palette-lab-slider-input"
                                                />
                                                <span className="palette-lab-slider-value" style={{ minWidth: '50px' }}>{variation.deltaH.toFixed(0)}°</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>

            {/* Swatches */}
            <div className="palette-lab-grid">
                {palette.map((p, i) => {
                    const closestColor = p.closestIndex >= 0 ? palette[p.closestIndex] : null;
                    return (
                        <div key={i} className={`palette-lab-card ${p.isTooSimilar ? 'similar' : ''}`}>
                            {showSimilarColors ? (
                                <div className="palette-lab-swatch-comparison">

                                    <div className="palette-lab-swatch-main" style={{ background: p.hex }}>
                                        <div>
                                            <span style={{ color: labelHex, fontWeight: 600 }}>{`Band ${i + 1}`}</span>
                                            <span className="palette-lab-pill" style={{ color: "#111" }}>{p.hex}</span>

                                            <div>
                                                <div>contrast: {p.ratio.toFixed(1)}:1</div>
                                                <div>h≈{Math.round(p.h)}° · L={p.L.toFixed(3)} · C={p.C.toFixed(3)}</div>
                                            </div>


                                            {/* Variations */}
                                            {enableVariations && p.variations && p.variations.length > 0 && (
                                                <div className="palette-lab-swatch-variations" style={{ paddingBottom: 20 }}>
                                                    {p.variations.map((variation: any, vi: number) => (
                                                        <div key={vi} className="palette-lab-variation-swatch" style={{ background: variation.hex }}>
                                                            <span className="palette-lab-variation-label">{variation.name}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {closestColor && (
                                        <div className="palette-lab-swatch-closest" style={{ background: closestColor.hex }}>
                                            <span className="palette-lab-closest-label">#{p.closestIndex + 1}</span>
                                            {showSimilarColors && (
                                                <div className="palette-lab-similarity-info">
                                                    closest: Band #{p.closestIndex + 1}
                                                    <div>ΔE={p.closestDistance.toFixed(1)}</div>
                                                    {p.isTooSimilar && <span className="palette-lab-too-similar"> (too similar!)</span>}
                                                </div>
                                            )}
                                        </div>
                                    )}


                                </div>
                            ) : (
                                <div className="palette-lab-swatch-header" style={{ background: p.hex }}>
                                    <span style={{ color: labelHex, fontWeight: 600 }}>{`Band ${i + 1}`}</span>
                                    {p.hex}
                                    <div>
                                        <div>contrast: {p.ratio.toFixed(1)}:1</div>
                                        <div>h≈{Math.round(p.h)}° · L={p.L.toFixed(3)} · C={p.C.toFixed(3)}</div>
                                    </div>
                                </div>
                            )}

                        </div>
                    );
                })}
            </div>            {/* Export */}
            <div className="palette-lab-panel">
                <div className="palette-lab-row">
                    <div className="palette-lab-small">
                        {allMeet ? <span className="palette-lab-ok">✓ All swatches meet target contrast</span> : <span className="palette-lab-warn">⚠ Some swatches miss target contrast</span>}
                        <br />
                        {tooSimilarCount === 0 ?
                            <span className="palette-lab-ok">✓ No colors are too similar</span> :
                            <span className="palette-lab-warn">⚠ {tooSimilarCount} color{tooSimilarCount > 1 ? 's' : ''} too similar (ΔE &lt; {minColorDistance})</span>
                        }
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button onClick={copyHexes} className="palette-lab-btn palette-lab-btn-dark">Copy hex list</button>
                        <button onClick={exportConfig} className="palette-lab-btn">Export config</button>
                        <button onClick={importConfig} className="palette-lab-btn">Import config</button>
                    </div>
                </div>
            </div>

            {/* Ordered Swatch Lists */}
            <div className="palette-lab-panel">

                <div>
                    <div className="palette-lab-small" style={{ marginBottom: 8 }}>
                        <strong>Minimum Adjacent Contrast:</strong> Colors ordered for smoothest visual transitions
                    </div>
                    <div className="palette-lab-swatch-list">
                        {minContrastPalette.map((color, i) => (
                            <div
                                key={`min-${i}`}
                                className="palette-lab-swatch-item"
                                style={{
                                    backgroundColor: color.hex,
                                    color: labelHex
                                }}
                                title={`${color.hex} - Contrast: ${color.ratio.toFixed(1)}:1`}
                            >
                                {color.hex}
                            </div>
                        ))}
                    </div>
                </div>
                <div >
                    <div className="palette-lab-small" style={{ marginBottom: 8 }}>
                        <strong>Maximum Adjacent Contrast:</strong> Colors ordered to maximize visual separation between neighbors
                    </div>
                    <div className="palette-lab-swatch-list">
                        {maxContrastPalette.map((color, i) => (
                            <div
                                key={`max-${i}`}
                                className="palette-lab-swatch-item"
                                style={{
                                    backgroundColor: color.hex,
                                    color: labelHex
                                }}
                                title={`${color.hex} - Contrast: ${color.ratio.toFixed(1)}:1`}
                            >
                                {color.hex}
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            <footer className="palette-lab-footer">
                Built for quick palette exploration. Uses OKLCH for perceptual controls; gamut-fitting reduces chroma to keep colors displayable. WCAG contrast is computed against your label color and (optionally) equalized across the set.
            </footer>
        </div>
    );
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
    return (
        <div className="palette-lab-panel">
            <div className="palette-lab-row" style={{ marginBottom: 8 }}>
                <label className="palette-lab-label">{label}</label>
                <span className="palette-lab-value">{typeof value === 'number' ? value.toFixed(step < 1 ? 3 : 0) : String(value)}</span>
            </div>
            <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="palette-lab-range" />
        </div>
    );
}

function CompactSlider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
    return (
        <div className="palette-lab-slider-row">
            <label className="palette-lab-slider-label">{label}</label>
            <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="palette-lab-slider-input" />
            <span className="palette-lab-slider-value">{typeof value === 'number' ? value.toFixed(step < 1 ? 3 : 0) : String(value)}</span>
        </div>
    );
}


export default function PaletteLabPage() {
    return (
        <>
            <Head>
                <title>PaletteLab</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>
            <PaletteLab />
        </>
    );
}
