import Head from "next/head";
import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { parsePaletteDefinition } from "../utils/paletteDefinition";
import { ColorInterpolationMode, convertHexToVector, interpolateGradientColor, rgb255ToVector, rgbUnitTo255 } from "../utils/colorSpaces";
import { hexToRgb } from "../utils/color";
import { useDevicePixelRatio } from "../hooks/useDevicePixelRatio";
import type { PaletteSwatchDefinition } from "../types/paletteDefinition";
import { PalettePresetButtons } from "../components/PalettePresetButtons";
import { GradientPreviewCanvas } from "../components/GradientPreviewCanvas";
import "../styles/DitherGradient.css";
import "../styles/PaletteDefinition.css";
import { PaletteDefinitionViewer } from "@/components/PaletteDefinitionViewer";

type DitherType = "none" | "bayer2" | "bayer4" | "bayer8";
type ReductionMode = "binary" | "palette" | "none";

const DEFAULT_PALETTE = `#1B1F3B // midnight
#F56476 // coral peak
#6C64FB // violet beam
#FEE440 // signal yellow
-----
#0D1321 // deep navy
#FF6978 // rose
#00C49A // aqua`;

const PALETTE_PRESETS = [
    {
        label: "Default",
        value: DEFAULT_PALETTE,
    },
    {
        label: "Pastel Stack",
        value: `#F6BD60 // sherbet\n#F7EDE2 // linen\n#F5CAC3 // blush\n#84A59D // sage\n-----\n#F28482 // grapefruit\n#B8F2E6 // mint\n#CDB4DB // lavender`,
    },
    {
        label: "Retro CRT",
        value: `#0F0F0F\n#1EE814\n#30B7FF\n#F7F05B\n-----\n#FF7F11\n#FA1E44\n#C201E2`,
    },
    {
        label: "B&W",
        value: `#0\n#f`,
    },
    {
        label: "Gray7",
        value: `#050505\n#2B2B2B\n#555555\n#808080\n-----\n#AAAAAA\n#D5D5D5\n#F5F5F5`,
    },
] as const;

const CORNER_LABELS = ["Top Left", "Top Right", "Bottom Left", "Bottom Right"] as const;
interface ReductionPaletteEntry {
    rgb: { r: number; g: number; b: number };
    coords: number[];
}

type PreviewStageKey = "source" | "dither" | "reduced";

interface PreviewStageConfig {
    key: PreviewStageKey;
    enabled: boolean;
    ref: MutableRefObject<HTMLCanvasElement | null>;
}

interface ActivePreviewStage {
    key: PreviewStageKey;
    ctx: CanvasRenderingContext2D;
    imageData: ImageData;
}

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
    const [gradientPaletteText, setGradientPaletteText] = useState(DEFAULT_PALETTE);
    const [reductionPaletteText, setReductionPaletteText] = useState(DEFAULT_PALETTE);
    const [cornerAssignments] = useState<number[]>([0, 1, 2, 3]);
    const [interpolationMode, setInterpolationMode] = useState<ColorInterpolationMode>("oklch");
    const [ditherType, setDitherType] = useState<DitherType>("bayer4");
    const [ditherStrength, setDitherStrength] = useState(0.35);
    const [reductionMode, setReductionMode] = useState<ReductionMode>("binary");
    const [binaryThreshold, setBinaryThreshold] = useState(127);
    const [distanceColorSpace, setDistanceColorSpace] = useState<ColorInterpolationMode>("lab");
    const [width, setWidth] = useState(240);
    const [height, setHeight] = useState(180);
    const [previewScale, setPreviewScale] = useState(2);
    const [showSourcePreview, setShowSourcePreview] = useState(true);
    const [showDitherPreview, setShowDitherPreview] = useState(true);
    const [showReducedPreview, setShowReducedPreview] = useState(true);
    const devicePixelRatio = useDevicePixelRatio();

    const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const ditherCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const reducedCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const parsedGradientPalette = useMemo(() => parsePaletteDefinition(gradientPaletteText), [gradientPaletteText]);
    const gradientSwatches = parsedGradientPalette.swatches;

    const parsedReductionPalette = useMemo(() => parsePaletteDefinition(reductionPaletteText), [reductionPaletteText]);
    const reductionSwatches = parsedReductionPalette.swatches;
    const hasReductionPalette = reductionSwatches.length > 0;

    const derivedCorners = useMemo(() => deriveCornerHexes(gradientSwatches, cornerAssignments), [gradientSwatches, cornerAssignments]);
    const reductionPaletteEntries = useMemo<ReductionPaletteEntry[]>(
        () =>
            reductionSwatches.map((swatch) => ({
                rgb: rgbUnitTo255(hexToRgb(swatch.hex)),
                coords: vectorToTuple(convertHexToVector(swatch.hex, distanceColorSpace), distanceColorSpace),
            })),
        [reductionSwatches, distanceColorSpace]
    );

    useEffect(() => {
        if (!hasReductionPalette && reductionMode === "palette") {
            setReductionMode("none");
        }
    }, [hasReductionPalette, reductionMode]);

    useEffect(() => {
        const previewStages: PreviewStageConfig[] = [
            { key: "source", enabled: showSourcePreview, ref: sourceCanvasRef },
            { key: "dither", enabled: showDitherPreview, ref: ditherCanvasRef },
            { key: "reduced", enabled: showReducedPreview, ref: reducedCanvasRef },
        ];

        if (derivedCorners.hexes.length < 4) {
            previewStages.forEach((stage) => {
                const canvas = stage.ref.current;
                if (!canvas) return;
                const ctx = canvas.getContext("2d");
                ctx?.clearRect(0, 0, canvas.width, canvas.height);
            });
            return;
        }

        const activeStages = previewStages
            .map((stage) => {
                if (!stage.enabled) return null;
                const canvas = stage.ref.current;
                if (!canvas) return null;
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (!ctx) return null;
                return {
                    key: stage.key,
                    ctx,
                    imageData: ctx.createImageData(width, height),
                } satisfies ActivePreviewStage;
            })
            .filter((stage): stage is ActivePreviewStage => stage !== null);

        if (activeStages.length === 0) {
            return;
        }

        const stageMap = activeStages.reduce((acc, stage) => {
            acc[stage.key] = stage;
            return acc;
        }, {} as Partial<Record<PreviewStageKey, ActivePreviewStage>>);

        for (let y = 0; y < height; y++) {
            const v = height === 1 ? 0 : y / (height - 1);
            for (let x = 0; x < width; x++) {
                const u = width === 1 ? 0 : x / (width - 1);
                const base = interpolateGradientColor(derivedCorners.hexes, u, v, interpolationMode);
                const sourceColor = clampRgb255(base);
                const jittered = applyDitherJitter(base, x, y, ditherType, ditherStrength);
                const ditheredColor = clampRgb255(jittered);
                const reducedColor = clampRgb255(
                    applyReduction(jittered, reductionMode, binaryThreshold, reductionPaletteEntries, distanceColorSpace)
                );

                const offset = (y * width + x) * 4;
                if (stageMap.source) {
                    writePixel(stageMap.source.imageData.data, offset, sourceColor);
                }
                if (stageMap.dither) {
                    writePixel(stageMap.dither.imageData.data, offset, ditheredColor);
                }
                if (stageMap.reduced) {
                    writePixel(stageMap.reduced.imageData.data, offset, reducedColor);
                }
            }
        }

        activeStages.forEach((stage) => {
            stage.ctx.putImageData(stage.imageData, 0, 0);
        });
    }, [
        derivedCorners.hexes,
        width,
        height,
        interpolationMode,
        ditherType,
        ditherStrength,
        reductionMode,
        binaryThreshold,
        distanceColorSpace,
        reductionPaletteEntries,
        showSourcePreview,
        showDitherPreview,
        showReducedPreview,
    ]);

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
                            <span>{gradientSwatches.length} swatch{gradientSwatches.length === 1 ? "" : "es"}</span>
                        </header>
                        <PalettePresetButtons presets={PALETTE_PRESETS} onSelect={setGradientPaletteText} />
                        <div style={{ display: "flex" }}>
                            <textarea
                                value={gradientPaletteText}
                                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setGradientPaletteText(event.target.value)}
                                spellCheck={false}
                            />
                            <PaletteDefinitionViewer swatches={gradientSwatches} rows={parsedGradientPalette.rows} />
                        </div>
                        {gradientSwatches.length === 0 && (
                            <p className="dither-gradient-warning">Add at least one valid color to generate a gradient.</p>
                        )}
                    </section>

                    <section className="dither-gradient-card palette">
                        <header>
                            <strong>Reduction Palette</strong>
                            <span>{reductionSwatches.length} swatch{reductionSwatches.length === 1 ? "" : "es"}</span>
                        </header>
                        <PalettePresetButtons presets={PALETTE_PRESETS} onSelect={setReductionPaletteText} />
                        <div style={{ display: "flex" }}>
                            <textarea
                                value={reductionPaletteText}
                                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setReductionPaletteText(event.target.value)}
                                spellCheck={false}
                                placeholder="Leave empty to disable palette reduction"
                            />
                            <PaletteDefinitionViewer swatches={reductionSwatches} rows={parsedReductionPalette.rows} />
                        </div>
                        {reductionMode === "palette" && reductionSwatches.length === 0 && (
                            <p className="dither-gradient-warning">Provide at least one valid color before enabling palette reduction.</p>
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
                                Palette Reduction
                                <select value={reductionMode} onChange={(event) => setReductionMode(event.target.value as ReductionMode)}>
                                    <option value="none">Disabled</option>
                                    <option value="binary">Binary (per channel)</option>
                                    <option value="palette" disabled={!hasReductionPalette}>Use palette ({reductionSwatches.length} colors)</option>
                                </select>
                            </label>
                            {reductionMode === "binary" && (
                                <label>
                                    Binary Threshold ({binaryThreshold})
                                    <input
                                        type="range"
                                        min={16}
                                        max={240}
                                        step={1}
                                        value={binaryThreshold}
                                        onChange={(event) => setBinaryThreshold(event.target.valueAsNumber)}
                                    />
                                </label>
                            )}
                            {reductionMode === "palette" && (
                                <label>
                                    Palette Distance Space
                                    <select value={distanceColorSpace} onChange={(event) => setDistanceColorSpace(event.target.value as ColorInterpolationMode)}>
                                        <option value="rgb">RGB</option>
                                        <option value="hsl">HSL</option>
                                        <option value="cmyk">CMYK</option>
                                        <option value="lab">LAB</option>
                                        <option value="ycbcr">YCbCr</option>
                                        <option value="oklch">OKLCH</option>
                                    </select>
                                </label>
                            )}
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
                </div>

                <div className="dither-gradient-layout">
                    <section className="dither-gradient-card preview">
                        <header>
                            <strong>Gradient Preview</strong>
                            <span>{interpolationMode.toUpperCase()} • {ditherType === "none" ? "No dithering" : ditherType.toUpperCase()}</span>
                        </header>
                        <div className="preview-toggle-list">
                            <label>
                                <input type="checkbox" checked={showSourcePreview} onChange={(event) => setShowSourcePreview(event.target.checked)} /> Source
                            </label>
                            <label>
                                <input type="checkbox" checked={showDitherPreview} onChange={(event) => setShowDitherPreview(event.target.checked)} /> Dithered
                            </label>
                            <label>
                                <input type="checkbox" checked={showReducedPreview} onChange={(event) => setShowReducedPreview(event.target.checked)} /> Palette Reduced
                            </label>
                        </div>
                        <div className="preview-canvas-grid">
                            {showSourcePreview && (
                                <GradientPreviewCanvas
                                    ref={sourceCanvasRef}
                                    title="Source Gradient"
                                    description="Interpolated"
                                    width={width}
                                    height={height}
                                    previewScale={previewScale}
                                    devicePixelRatio={devicePixelRatio}
                                />
                            )}
                            {showDitherPreview && (
                                <GradientPreviewCanvas
                                    ref={ditherCanvasRef}
                                    title="Dither Applied"
                                    description={ditherType === "none" ? "No jitter" : `${ditherType.toUpperCase()} pattern`}
                                    width={width}
                                    height={height}
                                    previewScale={previewScale}
                                    devicePixelRatio={devicePixelRatio}
                                />
                            )}
                            {showReducedPreview && (
                                <GradientPreviewCanvas
                                    ref={reducedCanvasRef}
                                    title="Palette Reduced"
                                    description={reductionMode === "none" ? "Disabled" : reductionMode === "binary" ? "Binary channels" : `Palette (${reductionSwatches.length})`}
                                    width={width}
                                    height={height}
                                    previewScale={previewScale}
                                    devicePixelRatio={devicePixelRatio}
                                />
                            )}
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

                <div className="dither-gradient-layout">
                    <section className="dither-gradient-card preview">
                        <header>
                            <strong>Color matching preview</strong>
                        </header>
                        <div>
                            TODO: for both palettes, and for each swatch (rows), show the top N closest matches in the other palette (columns) , with deltaE or distance metric visible. Tooltip to show more detail.
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

const OKLCH_CHROMA_NORMALIZER = 0.4;

function applyReduction(
    rgb: { r: number; g: number; b: number },
    mode: ReductionMode,
    binaryThreshold: number,
    palette: ReductionPaletteEntry[],
    distanceMode: ColorInterpolationMode
) {
    if (mode === "binary") {
        return stepRgb(rgb, binaryThreshold);
    }
    if (mode === "palette" && palette.length > 0) {
        return quantizeToPalette(rgb, palette, distanceMode);
    }
    return rgb;
}

function quantizeToPalette(rgb: { r: number; g: number; b: number }, palette: ReductionPaletteEntry[], distanceMode: ColorInterpolationMode) {
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

function rgbToCoords(rgb: { r: number; g: number; b: number }, mode: ColorInterpolationMode) {
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
        case "cmyk": {
            const cmyk = vector as { c: number; m: number; y: number; k: number };
            return [cmyk.c, cmyk.m, cmyk.y, cmyk.k];
        }
        case "lab": {
            const lab = vector as { l: number; a: number; b: number };
            return [lab.l / 100, lab.a / 128, lab.b / 128];
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
    const radians = (((degrees ?? 0) % 360) + 360) % 360 * (Math.PI / 180);
    return [Math.cos(radians), Math.sin(radians)];
}

function distanceSq(a: number[], b: number[]) {
    const length = Math.min(a.length, b.length);
    let total = 0;
    for (let index = 0; index < length; index++) {
        const delta = (a[index] ?? 0) - (b[index] ?? 0);
        total += delta * delta;
    }
    return total;
}

function writePixel(buffer: Uint8ClampedArray, offset: number, color: { r: number; g: number; b: number }) {
    buffer[offset] = color.r;
    buffer[offset + 1] = color.g;
    buffer[offset + 2] = color.b;
    buffer[offset + 3] = 255;
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

