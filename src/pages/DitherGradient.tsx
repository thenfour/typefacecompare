import Head from "next/head";
import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { parsePaletteDefinition } from "../utils/paletteDefinition";
import { ColorInterpolationMode, interpolateGradientColor } from "../utils/colorSpaces";
import { useDevicePixelRatio } from "../hooks/useDevicePixelRatio";
import type { PaletteSwatchDefinition } from "../types/paletteDefinition";
import "../styles/DitherGradient.css";

type DitherType = "none" | "bayer2" | "bayer4" | "bayer8";

const DEFAULT_PALETTE = `#1B1F3B // midnight
#F56476 // coral peak
#6C64FB // violet beam
#FEE440 // signal yellow
-----
#0D1321 // deep navy
#FF6978 // rose
#00C49A // aqua`;

const CORNER_LABELS = ["Top Left", "Top Right", "Bottom Left", "Bottom Right"] as const;

const BAYER_MATRICES: Record<Exclude<DitherType, "none">, number[][]> = {
    bayer2: [
        [0, 2],
        [3, 1],
    ],
    bayer4: [
        [0, 12, 3, 15],
        [8, 4, 11, 7],
        [2, 14, 1, 13],
        [10, 6, 9, 5],
    ],
    bayer8: [
        [0, 32, 8, 40, 2, 34, 10, 42],
        [48, 16, 56, 24, 50, 18, 58, 26],
        [12, 44, 4, 36, 14, 46, 6, 38],
        [60, 28, 52, 20, 62, 30, 54, 22],
        [3, 35, 11, 43, 1, 33, 9, 41],
        [51, 19, 59, 27, 49, 17, 57, 25],
        [15, 47, 7, 39, 13, 45, 5, 37],
        [63, 31, 55, 23, 61, 29, 53, 21],
    ],
};

export default function DitherGradientPage() {
    const [paletteText, setPaletteText] = useState(DEFAULT_PALETTE);
    const [cornerAssignments, setCornerAssignments] = useState<number[]>([0, 1, 2, 3]);
    const [interpolationMode, setInterpolationMode] = useState<ColorInterpolationMode>("oklch");
    const [ditherType, setDitherType] = useState<DitherType>("bayer4");
    const [ditherStrength, setDitherStrength] = useState(0.35);
    const [width, setWidth] = useState(240);
    const [height, setHeight] = useState(180);
    const [previewScale, setPreviewScale] = useState(2);
    const devicePixelRatio = useDevicePixelRatio();

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const parsedPalette = useMemo(() => parsePaletteDefinition(paletteText), [paletteText]);
    const swatches = parsedPalette.swatches;

    useEffect(() => {
        if (swatches.length === 0) {
            return;
        }
        // setCornerAssignments((prev) => {
        //     const next = buildCornerIndices(swatches, prev);
        //     const changed = next.some((value, index) => value !== prev[index]);
        //     return changed ? next : prev;
        // });
    }, [swatches]);

    const derivedCorners = useMemo(() => deriveCornerHexes(swatches, cornerAssignments), [swatches, cornerAssignments]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        if (derivedCorners.hexes.length < 4) {
            ctx.clearRect(0, 0, width, height);
            return;
        }

        canvas.width = width;
        canvas.height = height;
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;

        for (let y = 0; y < height; y++) {
            const v = height === 1 ? 0 : y / (height - 1);
            for (let x = 0; x < width; x++) {
                const u = width === 1 ? 0 : x / (width - 1);
                const rgb = interpolateGradientColor(derivedCorners.hexes, u, v, interpolationMode);
                const jittered = applyDitherJitter(rgb, x, y, ditherType, ditherStrength);

                const reducedColor = stepRgb(jittered, 127);

                // hard-step to demonstrate dithering effect over limited palette.
                // TODO: allow user-defined palette reduction.
                const dithered = clampRgb255(reducedColor);

                const offset = (y * width + x) * 4;
                data[offset] = dithered.r;
                data[offset + 1] = dithered.g;
                data[offset + 2] = dithered.b;
                data[offset + 3] = 255;
            }
        }

        ctx.putImageData(imageData, 0, 0);
    }, [derivedCorners.hexes, width, height, interpolationMode, ditherType, ditherStrength]);

    // const handleCornerChange = (cornerIndex: number, swatchIndex: number) => {
    //     setCornerAssignments((prev) => {
    //         const next = [...prev];
    //         next[cornerIndex] = swatchIndex;
    //         return next;
    //     });
    // };

    return (
        <>
            <Head>
                <title>Dither Gradient Lab</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>
            <main className="dither-gradient-page">
                <div className="dither-gradient-header">
                    <Link href="/">&#8592; TypefaceComparisonTool</Link>
                    <h1>Bilinear Dither Gradient Lab</h1>
                    <p>
                        Paste palette text, pick four corners, and explore bilinear gradients in multiple color spaces with optional ordered dithering.
                        When fewer than four colors are provided, corners recycle across the whole palette automatically.
                    </p>
                </div>

                <div className="dither-gradient-layout">
                    <section className="dither-gradient-card palette">
                        <header>
                            <strong>Palette Definition</strong>
                            <span>{swatches.length} swatch{swatches.length === 1 ? "" : "es"}</span>
                        </header>
                        <textarea
                            value={paletteText}
                            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setPaletteText(event.target.value)}
                            spellCheck={false}
                        />
                        {swatches.length === 0 && (
                            <p className="dither-gradient-warning">Add at least one valid color to generate a gradient.</p>
                        )}
                    </section>

                    <section className="dither-gradient-card settings">
                        <header>
                            <strong>Controls</strong>
                        </header>
                        <div className="control-grid">
                            <label>
                                Interpolation Space
                                <select value={interpolationMode} onChange={(event) => setInterpolationMode(event.target.value as ColorInterpolationMode)}>
                                    <option value="rgb">RGB</option>
                                    <option value="hsl">HSL</option>
                                    <option value="cmyk">CMYK</option>
                                    <option value="lab">LAB</option>
                                    <option value="ycbcr">YCbCr</option>
                                    <option value="oklch">OKLCH</option>
                                </select>
                            </label>
                            <label>
                                Dither Pattern
                                <select value={ditherType} onChange={(event) => setDitherType(event.target.value as DitherType)}>
                                    <option value="none">None</option>
                                    <option value="bayer2">2×2 Bayer</option>
                                    <option value="bayer4">4×4 Bayer</option>
                                    <option value="bayer8">8×8 Bayer</option>
                                </select>
                            </label>
                            <label>
                                Dither Strength ({ditherStrength.toFixed(2)})
                                <input
                                    type="range"
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    value={ditherStrength}
                                    onChange={(event) => setDitherStrength(event.target.valueAsNumber)}
                                    disabled={ditherType === "none"}
                                />
                            </label>
                            <label>
                                Canvas Width ({width}px)
                                <input type="range" min={64} max={512} step={8} value={width} onChange={(event) => setWidth(event.target.valueAsNumber)} />
                            </label>
                            <label>
                                Canvas Height ({height}px)
                                <input type="range" min={64} max={512} step={8} value={height} onChange={(event) => setHeight(event.target.valueAsNumber)} />
                            </label>
                            <label>
                                Preview Scale ({previewScale}×)
                                <input type="range" min={1} max={4} step={1} value={previewScale} onChange={(event) => setPreviewScale(event.target.valueAsNumber)} />
                            </label>
                        </div>
                    </section>
                    {/* 
                    <section className="dither-gradient-card corners">
                        <header>
                            <strong>Corner Colors</strong>
                            <span>Pick any swatch per corner; repeats are allowed.</span>
                        </header>
                        <div className="corner-grid">
                            {CORNER_LABELS.map((label, index) => (
                                <div key={label} className="corner-control">
                                    <span>{label}</span>
                                    <select
                                        value={swatches.length === 0 ? "" : cornerAssignments[index] ?? 0}
                                        onChange={(event) => handleCornerChange(index, Number(event.target.value))}
                                        disabled={swatches.length === 0}
                                    >
                                        {swatches.map((swatch, swatchIndex) => (
                                            <option value={swatchIndex} key={swatch.tokenId}>
                                                #{swatch.ordinal + 1} — {swatch.hex}
                                            </option>
                                        ))}
                                    </select>
                                    <div
                                        className="corner-swatch-preview"
                                        style={{ backgroundColor: derivedCorners.hexes[index] ?? "transparent" }}
                                    />
                                </div>
                            ))}
                        </div>
                    </section> */}

                    <section className="dither-gradient-card preview">
                        <header>
                            <strong>Gradient Preview</strong>
                            <span>{interpolationMode.toUpperCase()} • {ditherType === "none" ? "No dithering" : ditherType.toUpperCase()}</span>
                        </header>
                        <div className="preview-stage">
                            <canvas
                                ref={canvasRef}
                                style={{
                                    width: (width * previewScale) / (devicePixelRatio || 1),
                                    height: (height * previewScale) / (devicePixelRatio || 1),
                                    imageRendering: "pixelated"
                                }}
                            />
                        </div>
                        <div className="corner-summary">
                            {derivedCorners.hexes.length === 4 ? (
                                derivedCorners.hexes.map((hex, index) => (
                                    <div key={index} className="corner-summary-item">
                                        <div className="color-chip" style={{ backgroundColor: hex }} />
                                        <div>
                                            <span>{CORNER_LABELS[index]}</span>
                                            <strong>{hex}</strong>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="dither-gradient-warning">Waiting for valid palette input…</p>
                            )}
                        </div>
                    </section>
                </div>
            </main>
        </>
    );
}

// function buildCornerIndices(swatches: PaletteSwatchDefinition[], previous: number[]): number[] {
//     if (swatches.length === 0) {
//         return previous;
//     }
//     const next = new Array(4).fill(0).map((_, index) => {
//         const candidate = previous[index];
//         if (typeof candidate === "number" && swatches[candidate]) {
//             return candidate;
//         }
//         return index % swatches.length;
//     });
//     return next;
// }

function deriveCornerHexes(swatches: PaletteSwatchDefinition[], requested: number[]) {
    if (swatches.length === 0) {
        return { hexes: [] as string[] };
    }
    const hexes: string[] = [];
    for (let index = 0; index < 4; index++) {
        const candidate = requested[index];
        if (typeof candidate === "number" && swatches[candidate]) {
            hexes.push(swatches[candidate].hex);
        } else {
            const fallback = swatches[index % swatches.length].hex;
            hexes.push(fallback);
        }
    }
    return { hexes };
}

function addRgb(rgb: { r: number; g: number; b: number }, offset: number) {
    return {
        r: rgb.r + offset,
        g: rgb.g + offset,
        b: rgb.b + offset,
    };
}

function applyDitherJitter(rgb255: { r: number; g: number; b: number }, x: number, y: number, type: DitherType, strength: number) {
    if (type === "none") {
        return rgb255;
    }
    const matrix = BAYER_MATRICES[type];
    const size = matrix.length;
    const denominator = size * size;
    // matrix source is scaled 0..(N*N-1); we convert to -0.5..+0.5 range for easier centering
    const matrixSrcValue = matrix[y % size][x % size];
    const threshold = (matrixSrcValue + 0.5) / denominator - 0.5;
    const jitter = threshold * strength * 255; // convert threshold (0,1) to RGB channel offset (-128,128) scaled by strength

    const jitteredColor = addRgb(rgb255, jitter);
    return jitteredColor;
}

// applies hard step function to each RGB channel (if n < step, return 0 else return 255)
function stepRgb(rgb: { r: number; g: number; b: number }, step: number) {
    return {
        r: rgb.r < step ? 0 : 255,
        g: rgb.g < step ? 0 : 255,
        b: rgb.b < step ? 0 : 255,
    };
}


function clampRgb255(rgb: { r: number; g: number; b: number }) {
    return {
        r: Math.min(255, Math.max(0, Math.round(rgb.r))),
        g: Math.min(255, Math.max(0, Math.round(rgb.g))),
        b: Math.min(255, Math.max(0, Math.round(rgb.b))),
    };
}

