import Head from "next/head";
import React, { useMemo, useState } from "react";

// --- Minimal OKLCH → sRGB + WCAG contrast utilities (no deps) -----------------
// OKLCH and Oklab formulae per Björn Ottosson (2020)

type RGB = { r: number; g: number; b: number }; // sRGB [0..1]

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

const CSS = `
:root{--gap:16px}
*{box-sizing:border-box}
body{margin:0}
.container{min-height:100vh;background:#f5f5f7;color:#111;padding:24px;display:flex;flex-direction:column;gap:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,Helvetica Neue,Arial,Apple Color Emoji,Segoe UI Emoji}
.title{font-size:20px;font-weight:600}
.muted{color:#666}
.small{font-size:12px}
.grid{display:grid;gap:16px;grid-template-columns:1fr}
@media(min-width:900px){.grid{grid-template-columns:repeat(2,1fr)}}
@media(min-width:1280px){.grid{grid-template-columns:repeat(3,1fr)}}
.panel{background:#fff;border:1px solid #ddd;border-radius:8px;padding:12px}
.row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.label{font-size:14px;font-weight:600}
.value{font-size:12px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,Liberation Mono,monospace;color:#444}
.range{width:100%}
.input,.number{padding:6px 8px;border:1px solid #ccc;border-radius:6px;min-width:100px}
.colorbox{width:44px;height:28px;border:1px solid #ccc;border-radius:4px}
.btn{padding:6px 10px;border:1px solid #333;border-radius:6px;background:#f0f0f0;color:#111;cursor:pointer}
.btn-dark{background:#111;color:#fff;border-color:#111}
.btn:active{transform:translateY(1px)}
.card{border:1px solid #ddd;border-radius:12px;overflow:hidden;background:#fff}
.card.similar{border:2px solid #ff6b6b;box-shadow:0 2px 8px rgba(255,107,107,0.2)}
.swatchHeader{height:80px;display:flex;align-items:center;justify-content:space-between;padding:0 12px}
.swatchComparison{display:flex;height:80px}
.swatchMain{flex:2;display:flex;align-items:center;justify-content:space-between;padding:0 12px}
.swatchClosest{flex:1;display:flex;align-items:center;justify-content:center;border-left:2px solid rgba(255,255,255,0.3);position:relative}
.closestLabel{position:absolute;top:4px;left:4px;font-size:10px;background:rgba(0,0,0,0.5);color:white;padding:2px 4px;border-radius:3px}
.pill{font-size:12px;padding:3px 6px;background:rgba(255,255,255,0.7);border-radius:6px}
.cardMeta{display:flex;align-items:center;justify-content:space-between;padding:12px}
.similarityInfo{font-size:11px;color:#666;margin-top:4px}
.tooSimilar{color:#ff6b6b;font-weight:600}
.code{margin-top:12px;font-size:12px;background:#fafafa;border:1px solid #eee;padding:12px;border-radius:8px;overflow:auto}
.ok{color:#0a7f4f;font-weight:600}
.warn{color:#b06000;font-weight:600}
.footer{font-size:12px;color:#666}
`;

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

        // Add closest color information
        return baseColors.map((color, index) => {
            const closest = findClosestColor(index, baseColors);
            return {
                ...color,
                closestIndex: closest.index,
                closestDistance: closest.distance,
                isTooSimilar: closest.distance < minColorDistance // configurable threshold
            };
        });
    }, [count, L, C, hueSpan, hueOffset, jitter, targetContrast, labelRgb, seed, equalizeL, preferLight, minColorDistance]);

    const allMeet = palette.every((p) => p.ratio >= targetContrast);
    const tooSimilarCount = palette.filter((p) => p.isTooSimilar).length;

    function copyHexes() {
        const list = palette.map((p) => p.hex.replace('#', '')).join(",");
        navigator.clipboard?.writeText(list);
    }

    return (
        <div className="container">
            <style>{CSS}</style>
            <h1 className="title">PaletteLab — OKLCH generator</h1>
            <p className="muted small">Evenly-spaced hues with matched luminance, gamut-aware, and guaranteed contrast against a label color. Each color is shown with its closest match to help identify similar colors at a glance. Great for band handles, meters, and UI accents.</p>

            {/* Controls */}
            <div className="grid">
                <Slider label="# Colors" value={count} min={3} max={12} step={1} onChange={setCount} />
                <Slider label="Target L (OKLCH)" value={L} min={0.6} max={0.9} step={0.005} onChange={setL} />
                <Slider label="Chroma (OKLCH)" value={C} min={0.04} max={0.24} step={0.002} onChange={setC} />
                <Slider label="Hue Offset (°)" value={hueOffset} min={0} max={360} step={1} onChange={setHueOffset} />
                <Slider label="Hue Span (°)" value={hueSpan} min={120} max={360} step={1} onChange={setHueSpan} />
                <Slider label="Hue Jitter (°)" value={jitter} min={0} max={30} step={1} onChange={setJitter} />
                <Slider label="Target Contrast" value={targetContrast} min={4} max={15} step={0.1} onChange={setTargetContrast} />
                <Slider label="Min Color Distance (ΔE)" value={minColorDistance} min={1} max={50} step={0.5} onChange={setMinColorDistance} />
                <div className="panel">
                    <label className="label">Similarity Display</label>
                    <label className="row small" style={{ marginTop: 8, justifyContent: 'flex-start' }}>
                        <input type="checkbox" checked={showSimilarColors} onChange={(e) => setShowSimilarColors(e.target.checked)} style={{ marginRight: 8 }} />
                        Show closest color comparison
                    </label>
                    <div className="muted small" style={{ marginTop: 8 }}>Displays each color alongside its closest match to help identify similar colors. ΔE &lt; {minColorDistance} will be flagged as too similar.</div>
                </div>
                <div className="panel">
                    <label className="label">Label / Text Color</label>
                    <div className="row" style={{ marginTop: 8 }}>
                        <input type="color" value={labelHex} onChange={(e) => setLabelHex(e.target.value)} className="colorbox" />
                        <input className="input" value={labelHex} onChange={(e) => setLabelHex(e.target.value)} />
                        <div className="row" style={{ justifyContent: 'flex-start' }}>
                            <button onClick={() => setLabelHex("#000000")} className="btn btn-dark">Black</button>
                            <button onClick={() => setLabelHex("#ffffff")} className="btn">White</button>
                        </div>
                    </div>
                    <div className="muted small" style={{ marginTop: 8 }}>Tip: keep black for light swatches, white for dark. Target ≥ 7:1 for small UI text; 10–12:1 looks crisp.</div>
                </div>
                <div className="panel">
                    <label className="label">Seed</label>
                    <div className="row" style={{ marginTop: 8 }}>
                        <input type="number" className="number" value={seed} onChange={(e) => setSeed(parseInt(e.target.value || "0", 10))} />
                        <button className="btn btn-dark" onClick={() => setSeed(Math.floor(Math.random() * 1e9))}>Shuffle</button>
                    </div>
                    <label className="row small" style={{ marginTop: 8, justifyContent: 'flex-start' }}>
                        <input type="checkbox" checked={equalizeL} onChange={(e) => setEqualizeL(e.target.checked)} style={{ marginRight: 8 }} />
                        Equalize luminance across colors
                    </label>
                </div>
            </div>

            {/* Swatches */}
            <div className="grid">
                {palette.map((p, i) => {
                    const closestColor = p.closestIndex >= 0 ? palette[p.closestIndex] : null;
                    return (
                        <div key={i} className={`card ${p.isTooSimilar ? 'similar' : ''}`}>
                            {showSimilarColors ? (
                                <div className="swatchComparison">
                                    <div className="swatchMain" style={{ background: p.hex }}>
                                        <span style={{ color: labelHex, fontWeight: 600 }}>{`Band ${i + 1}`}</span>
                                        <span className="pill" style={{ color: "#111" }}>{p.hex}</span>
                                    </div>
                                    {closestColor && (
                                        <div className="swatchClosest" style={{ background: closestColor.hex }}>
                                            <span className="closestLabel">#{p.closestIndex + 1}</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="swatchHeader" style={{ background: p.hex }}>
                                    <span style={{ color: labelHex, fontWeight: 600 }}>{`Band ${i + 1}`}</span>
                                    <span className="pill" style={{ color: "#111" }}>{p.hex}</span>
                                </div>
                            )}
                            <div className="cardMeta">
                                <div>
                                    <div>contrast: <span className="value">{p.ratio.toFixed(1)}:1</span></div>
                                    {showSimilarColors && (
                                        <div className="similarityInfo">
                                            closest: <span className="value">Band #{p.closestIndex + 1}</span>
                                            {p.isTooSimilar && <span className="tooSimilar"> (too similar!)</span>}
                                        </div>
                                    )}
                                </div>
                                <div className="muted small">
                                    <div>h≈{Math.round(p.h)}° · L={p.L.toFixed(3)} · C={p.C.toFixed(3)}</div>
                                    {showSimilarColors && <div>ΔE={p.closestDistance.toFixed(1)}</div>}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Export */}
            <div className="panel">
                <div className="row">
                    <div className="small">
                        {allMeet ? <span className="ok">✓ All swatches meet target contrast</span> : <span className="warn">⚠ Some swatches miss target contrast</span>}
                        <br />
                        {tooSimilarCount === 0 ?
                            <span className="ok">✓ No colors are too similar</span> :
                            <span className="warn">⚠ {tooSimilarCount} color{tooSimilarCount > 1 ? 's' : ''} too similar (ΔE &lt; {minColorDistance})</span>
                        }
                    </div>
                    <button onClick={copyHexes} className="btn btn-dark">Copy hex list</button>
                </div>
                <pre className="code">const bandColors = [
                    ${palette.map(p => `  "${p.hex.replace('#', '')}"`).join(",")}
                    ];
                </pre>
            </div>

            <footer className="footer">
                Built for quick palette exploration. Uses OKLCH for perceptual controls; gamut-fitting reduces chroma to keep colors displayable. WCAG contrast is computed against your label color and (optionally) equalized across the set.
            </footer>
        </div>
    );
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
    return (
        <div className="panel">
            <div className="row" style={{ marginBottom: 8 }}>
                <label className="label">{label}</label>
                <span className="value">{typeof value === 'number' ? value.toFixed(step < 1 ? 3 : 0) : String(value)}</span>
            </div>
            <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="range" />
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
