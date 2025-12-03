import Head from "next/head";
import React, { useEffect, useMemo, useState } from "react";
import { PaletteSwatchCard } from "../components/PaletteSwatchCard";
import { BaseColor, PaletteSwatch, SwatchVariation, Variation } from "../types/palette";
import "../styles/PaletteLab.css";

// --- Minimal OKLCH → sRGB + WCAG contrast utilities (no deps) -----------------
import type { RGB } from "../utils/color";
import {
    findClosestColor,
    findLForContrast,
    generateVariation,
    gamutFitByChroma,
    hexToRgb,
    mulberry32,
    orderPaletteMaxContrast,
    orderPaletteMinContrast,
    wcagContrast
} from "../utils/color";

// --- UI -----------------------------------------------------------------------


const SwatchList: React.FC<{
    palette: PaletteSwatch[];
    labelHex?: string;
}> = ({ palette, labelHex }) => {
    return <div className="palette-lab-swatch-list">
        {palette.map((color, i) => (
            <div
                key={`min-${i}`}
                className="palette-lab-swatch-item"
                style={{
                    backgroundColor: color.hex,
                    color: labelHex,
                }}
                title={`${color.hex} - Contrast: ${color.ratio.toFixed(1)}:1`}
            >
                {color.hex}
            </div>
        ))}
    </div>

};



function PaletteLab() {
    const [count, setCount] = useState(5);
    const [L, setL] = useState(0.78);            // light backgrounds
    const [C, setC] = useState(0.12);            // chroma (0..0.3 is reasonable)
    const [hueSpan, setHueSpan] = useState(320); // degrees spanned across palette
    const [hueOffset, setHueOffset] = useState(300); // starting hue in degrees
    const [jitter, setJitter] = useState(12);    // ± jitter in degrees
    const [targetContrast, setTargetContrast] = useState(10); // WCAG ratio
    const [labelHex, setLabelHex] = useState("#000000");
    const [backgroundHex, setBackgroundHex] = useState("#ffffff");
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

    const labelRgb = useMemo<RGB>(() => hexToRgb(labelHex), [labelHex]);
    const preferLight = useMemo(() => wcagContrast(hexToRgb("#ffffff"), labelRgb) > wcagContrast(hexToRgb("#000000"), labelRgb), [labelRgb]);

    useEffect(() => {
        if (typeof document !== "undefined") {
            document.documentElement.style.setProperty("--bg-color", backgroundHex);
        }
    }, [backgroundHex]);

    const palette = useMemo<PaletteSwatch[]>(() => {
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
            return { h, Lfit: fit.L, Cfit: fit.C, hex: fit.hex };
        });

        // Equalize L across the set for similar luminance perception
        let baseColors: BaseColor[];
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
            let colorVariations: SwatchVariation[] = [];
            if (enableVariations) {
                const activeVariations = variations.slice(0, numVariations).filter(v => v.enabled);
                colorVariations = activeVariations.map((variation): SwatchVariation => {
                    const varColor = generateVariation(color.L, color.C, color.h, variation);
                    return {
                        name: variation.name,
                        ...varColor
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
            backgroundHex,
            equalizeL,
            showSimilarColors,
            seed,
            enableVariations,
            numVariations,
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
                if (typeof config.backgroundHex === 'string') setBackgroundHex(config.backgroundHex);
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

    // calculate variation palettes for max / min contrast.
    const maxContrastVariationPalettes: PaletteSwatch[][] = [];
    const activeVariations = enableVariations ? variations.slice(0, numVariations).filter(v => v.enabled) : [];
    for (let v = 0; v < activeVariations.length; v++) {
        const variation = activeVariations[v];
        const varPalette = maxContrastPalette.map((swatch) => {
            const varColor = generateVariation(swatch.L, swatch.C, swatch.h, variation);
            return {
                ...swatch,
                hex: varColor.hex,
            };
        });
        maxContrastVariationPalettes.push(varPalette);
    };

    const minContrastVariationPalettes: PaletteSwatch[][] = [];
    for (let v = 0; v < activeVariations.length; v++) {
        const variation = activeVariations[v];
        const varPalette = minContrastPalette.map((swatch) => {
            const varColor = generateVariation(swatch.L, swatch.C, swatch.h, variation);
            return {
                ...swatch,
                hex: varColor.hex,
            };
        });
        minContrastVariationPalettes.push(varPalette);
    }

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
                    <div className="palette-lab-muted palette-lab-small" style={{ marginTop: 12 }}>Background (controls CSS var <code>--bg-color</code> for swatch previews)</div>
                    <div className="palette-lab-row" style={{ marginTop: 4 }}>
                        <input type="color" value={backgroundHex} onChange={(e) => setBackgroundHex(e.target.value)} className="palette-lab-colorbox" />
                        <input className="palette-lab-input" style={{ flex: 1 }} value={backgroundHex} onChange={(e) => setBackgroundHex(e.target.value)} />
                        <button onClick={() => setBackgroundHex("#ffffff")} className="palette-lab-btn">Reset</button>
                    </div>
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
            <div className="palette-lab-grid palette-lab-swatch-grid">
                {palette.map((p, i) => {
                    const closestColor = p.closestIndex >= 0 ? palette[p.closestIndex] : null;
                    return (
                        <PaletteSwatchCard
                            key={`${p.hex}-${i}`}
                            swatch={p}
                            index={i}
                            labelHex={labelHex}
                            showSimilarColors={showSimilarColors}
                            enableVariations={enableVariations}
                            closestColor={closestColor}
                        />
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
                    <SwatchList palette={minContrastPalette} labelHex={labelHex} />
                    {minContrastVariationPalettes.map((palette, index) => (
                        <SwatchList key={index} palette={palette} labelHex={labelHex} />
                    ))}
                </div>
                <div >
                    <div className="palette-lab-small" style={{ marginBottom: 8 }}>
                        <strong>Maximum Adjacent Contrast:</strong> Colors ordered to maximize visual separation between neighbors
                    </div>
                    <SwatchList palette={maxContrastPalette} labelHex={labelHex} />
                    {maxContrastVariationPalettes.map((palette, index) => (
                        <SwatchList key={index} palette={palette} labelHex={labelHex} />
                    ))}
                </div>

            </div>

            <footer className="palette-lab-footer">
                Built for quick palette exploration. Uses OKLCH for perceptual controls; gamut-fitting reduces chroma to keep colors displayable. WCAG contrast is computed against your label color and (optionally) equalized across the set.
            </footer>
        </div>
    );
}

// function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
//     return (
//         <div className="palette-lab-panel">
//             <div className="palette-lab-row" style={{ marginBottom: 8 }}>
//                 <label className="palette-lab-label">{label}</label>
//                 <span className="palette-lab-value">{typeof value === 'number' ? value.toFixed(step < 1 ? 3 : 0) : String(value)}</span>
//             </div>
//             <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="palette-lab-range" />
//         </div>
//     );
// }

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
