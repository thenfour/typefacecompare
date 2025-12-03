import Head from "next/head";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parsePaletteDefinition } from "../utils/paletteDefinition";
import { ColorInterpolationMode, interpolateGradientColor, rgbUnitTo255 } from "../utils/colorSpaces";
import { hexToRgb } from "../utils/color";
import { useDevicePixelRatio } from "../hooks/useDevicePixelRatio";
import type { PaletteSwatchDefinition } from "../types/paletteDefinition";
import "../styles/DitherGradient.css";
import "../styles/PaletteDefinition.css";
import { fetchDitherSourceExamples, type ExampleImage } from "@/data/ditherSourceExamples";
import { useImageSource } from "@/hooks/useImageSource";
import { useDitherRenderer } from "@/hooks/useDitherRenderer";
import type { ReductionMode, SourceType } from "@/types/dither";
import { rgbToCoords, type ReductionPaletteEntry } from "@/utils/paletteDistance";
import { PaletteEditorCard } from "@/components/dither/PaletteEditorCard";
import { SourceControlsCard } from "@/components/dither/SourceControlsCard";
import { DitherControls } from "@/components/dither/DitherControls";
import { ReductionControls } from "@/components/dither/ReductionControls";
import { PreviewSection } from "@/components/dither/PreviewSection";
import { ColorSpaceScatterPlot, type ScatterPoint } from "@/components/dither/ColorSpaceScatterPlot";
import {
    buildProceduralDitherTile,
    DEFAULT_ERROR_DIFFUSION_KERNEL,
    ErrorDiffusionKernelId,
    DitherThresholdTile,
    DitherType,
    DEFAULT_VORONOI_CELLS,
    DEFAULT_VORONOI_JITTER,
    isErrorDiffusionDither,
    usesSeededDither,
} from "../utils/dithering";
const VORONOI_CELL_OPTIONS = [2, 4, 8, 16, 32, 64];
const MAX_SCATTER_SOURCE_POINTS = 4000;


const RGB_THREE_LEVELS = [0, 128, 255] as const;
const RGB_FOUR_LEVELS = [0, 85, 170, 255] as const;

function buildRgbLevelPalette(levels: readonly number[], chunkSize = 8) {
    const toHex = (value: number) => value.toString(16).padStart(2, "0").toUpperCase();
    const entries: string[] = [];
    for (const r of levels) {
        for (const g of levels) {
            for (const b of levels) {
                entries.push(`#${toHex(r)}${toHex(g)}${toHex(b)}`);
            }
        }
    }
    if (entries.length <= chunkSize) {
        return entries.join("\n");
    }
    const chunks: string[] = [];
    for (let i = 0; i < entries.length; i += chunkSize) {
        chunks.push(entries.slice(i, i + chunkSize).join("\n"));
    }
    return chunks.join("\n-----\n");
}

const PALETTE_PRESETS = [
    {
        label: "B&W",
        value: `#0\n#f`,
    },
    {
        label: "grad4",
        value: `#800
#cbb
-----
#88f
#113`,
    },
    {
        label: "Grayscale4",
        value: `#000000\n#555555\n#AAAAAA\n#FFFFFF`,
    },
    {
        label: "Grayscale8",
        value: `#000000\n#242424\n#484848\n#6D6D6D\n#919191\n#B6B6B6\n#DADADA\n#FFFFFF`,
    },
    {
        label: "Grayscale16",
        value: `#000000\n#111111\n#222222\n#333333\n#444444\n#555555\n#666666\n#777777\n-----\n#888888\n#999999\n#AAAAAA\n#BBBBBB\n#CCCCCC\n#DDDDDD\n#EEEEEE\n#FFFFFF`,
    },
    {
        label: "RGB Primaries",
        value: `#FF0000 // red\n#00FF00 // green\n#0000FF // blue\n-----\n#00FFFF // cyan\n#FF00FF // magenta\n#FFFF00 // yellow\n#000000 // black\n#FFFFFF // white`,
    },
    {
        label: "RGB Levels (3)",
        value: buildRgbLevelPalette(RGB_THREE_LEVELS),
    },
    {
        label: "RGB Levels (4)",
        value: buildRgbLevelPalette(RGB_FOUR_LEVELS),
    },
    {
        label: "Pastels",
        value: `#F6BD60 // sherbet\n#F7EDE2 // linen\n#F5CAC3 // blush\n#84A59D // sage\n-----\n#F28482 // grapefruit\n#B8F2E6 // mint\n#CDB4DB // lavender`,
    },
    {
        label: "C64",
        value: `#000000 // black\n#FFFFFF // white\n#813338 // red\n#75CEC8 // cyan\n#8E3C97 // purple\n#56AC4D // green\n#2E2C9B // blue\n#EDF171 // yellow\n-----\n#8E5029 // orange\n#553800 // brown\n#C46C71 // light red\n#4A4A4A // dark gray\n#7B7B7B // medium gray\n#A9FF9F // light green\n#706DEB // light blue\n#B2B2B2 // light gray`,
    },
    {
        label: "PICO-8",
        value: `#000000\n#1D2B53\n#7E2553\n#008751\n#AB5236\n#5F574F\n#C2C3C7\n#FFF1E8\n-----\n#FF004D\n#FFA300\n#FFEC27\n#00E436\n#29ADFF\n#83769C\n#FF77A8\n#FFCCAA`,
    },
    {
        label: "SWEETIE 16",
        value: `#1A1423\n#372549\n#774C60\n#B75D69\n#EACDC2\n#F4EBC3\n#F6F7D7\n#F1B5A4\n-----\n#E43A19\n#9E0031\n#4C2A85\n#67597A\n#424B54\n#2A2D34\n#1A1A1D\n#0F0A0A`,
    },
] as const;


export default function DitherGradientPage() {
    const [gradientPaletteText, setGradientPaletteText] = useState<string>(PALETTE_PRESETS[0].value);
    const [reductionPaletteText, setReductionPaletteText] = useState<string>(PALETTE_PRESETS[1].value);
    const [cornerAssignments] = useState<number[]>([0, 1, 2, 3]);
    const [interpolationMode, setInterpolationMode] = useState<ColorInterpolationMode>("oklch");
    const [ditherType, setDitherType] = useState<DitherType>("bayer4");
    const [ditherStrength, setDitherStrength] = useState(0.333);
    const [ditherSeed, setDitherSeed] = useState<number>(1);
    const [sourceType, setSourceType] = useState<SourceType>("gradient");
    const [voronoiCellsPerAxis, setVoronoiCellsPerAxis] = useState<number>(DEFAULT_VORONOI_CELLS);
    const [voronoiJitter, setVoronoiJitter] = useState<number>(DEFAULT_VORONOI_JITTER);
    const [errorDiffusionKernelId, setErrorDiffusionKernelId] = useState<ErrorDiffusionKernelId>(DEFAULT_ERROR_DIFFUSION_KERNEL);
    const [reductionMode, setReductionMode] = useState<ReductionMode>("palette");
    const [distanceColorSpace, setDistanceColorSpace] = useState<ColorInterpolationMode>("lab");
    const [width, setWidth] = useState(256);
    const [height, setHeight] = useState(256);
    const [previewScale, setPreviewScale] = useState(2);
    const [exampleImages, setExampleImages] = useState<ExampleImage[]>([]);
    const [areExamplesLoading, setAreExamplesLoading] = useState(true);
    const [exampleImagesError, setExampleImagesError] = useState<string | null>(null);
    const handleActivateImageSource = useCallback(() => setSourceType("image"), [setSourceType]);
    const {
        imageUrlInput,
        setImageUrlInput,
        imageScaleMode,
        setImageScaleMode,
        imageSource,
        sourceImageData,
        importImageFromUrl,
        importExampleImage,
        isImportingImage,
        imageImportError,
    } = useImageSource({
        width,
        height,
        onActivateImageSource: handleActivateImageSource,
    });
    useEffect(() => {
        let isMounted = true;
        const loadExamples = async () => {
            setAreExamplesLoading(true);
            try {
                const images = await fetchDitherSourceExamples();
                if (!isMounted) {
                    return;
                }
                setExampleImages(images);
                setExampleImagesError(null);
            } catch (error) {
                if (!isMounted) {
                    return;
                }
                setExampleImages([]);
                setExampleImagesError(error instanceof Error ? error.message : "Unable to load example images");
            } finally {
                if (isMounted) {
                    setAreExamplesLoading(false);
                }
            }
        };
        void loadExamples();
        return () => {
            isMounted = false;
        };
    }, []);
    const [showSourcePreview, setShowSourcePreview] = useState(true);
    const [showDitherPreview, setShowDitherPreview] = useState(false);
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

    const derivedCornerHexes = useMemo(() => deriveCornerHexes(gradientSwatches, cornerAssignments), [gradientSwatches, cornerAssignments]);
    const reductionPaletteEntries = useMemo<ReductionPaletteEntry[]>(
        () =>
            reductionSwatches.map((swatch) => {
                const rgb255 = rgbUnitTo255(hexToRgb(swatch.hex));
                return {
                    rgb: rgb255,
                    coords: rgbToCoords(rgb255, distanceColorSpace),
                };
            }),
        [reductionSwatches, distanceColorSpace]
    );
    const sourceScatterPoints = useMemo(
        () =>
            sampleSourceScatterPoints({
                sourceType,
                sourceImageData,
                derivedCornerHexes,
                interpolationMode,
                width,
                height,
                maxPoints: MAX_SCATTER_SOURCE_POINTS,
                colorSpace: distanceColorSpace,
            }),
        [
            sourceType,
            sourceImageData,
            derivedCornerHexes,
            interpolationMode,
            width,
            height,
            distanceColorSpace,
        ]
    );
    const paletteScatterPoints = useMemo(
        () => paletteEntriesToScatterPoints(reductionPaletteEntries, distanceColorSpace),
        [reductionPaletteEntries, distanceColorSpace]
    );
    const scatterAxisLabels = useMemo(() => getColorSpaceAxisLabels(distanceColorSpace), [distanceColorSpace]);
    const proceduralDitherTile: DitherThresholdTile | null = useMemo(
        () =>
            buildProceduralDitherTile(ditherType, ditherSeed, {
                voronoi: {
                    cellsPerAxis: voronoiCellsPerAxis,
                    jitter: voronoiJitter,
                },
            }),
        [ditherType, ditherSeed, voronoiCellsPerAxis, voronoiJitter]
    );

    const handleDistanceColorSpaceChange = (nextMode: ColorInterpolationMode) => {
        setDistanceColorSpace(nextMode);
    };

    useDitherRenderer({
        width,
        height,
        sourceType,
        derivedCornerHexes,
        interpolationMode,
        sourceImageData,
        ditherType,
        ditherStrength,
        ditherSeed,
        proceduralDitherTile,
        reductionMode,
        reductionPaletteEntries,
        distanceColorSpace,
        errorDiffusionKernelId,
        showSourcePreview,
        showDitherPreview,
        showReducedPreview,
        canvasRefs: {
            source: sourceCanvasRef,
            dither: ditherCanvasRef,
            reduced: reducedCanvasRef,
        },
    });
    const seedEnabled = usesSeededDither(ditherType);
    const isVoronoiDither = ditherType === "voronoi-cluster";
    const isErrorDiffusion = isErrorDiffusionDither(ditherType);
    const usingImageSource = sourceType === "image";
    const imageSourceReady = !!sourceImageData;
    const sourceSummaryLabel = usingImageSource
        ? imageSource?.label ?? "Image source"
        : `${interpolationMode.toUpperCase()} gradient`;
    const sourceCanvasTitle = usingImageSource ? "Source Image" : "Source Gradient";
    const sourceCanvasDescription = usingImageSource
        ? imageSource?.label ?? "Imported bitmap"
        : "Interpolated";

    return (
        <>
            <Head>
                <title>Dither Gradient Lab</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>
            <main className="dither-gradient-page">
                <div className="dither-gradient-header">
                    <h1>Bilinear Dither Gradient Lab</h1>
                </div>

                <div className="dither-gradient-layout">
                    <SourceControlsCard
                        sourceType={sourceType}
                        onSourceTypeChange={setSourceType}
                        sourceSummary={sourceSummaryLabel}
                        gradientControls={{
                            swatchCountLabel: `${gradientSwatches.length} swatch${gradientSwatches.length === 1 ? "" : "es"}`,
                            presets: PALETTE_PRESETS,
                            onSelectPreset: setGradientPaletteText,
                            lospecTargetLabel: "gradient palette",
                            value: gradientPaletteText,
                            onChangeValue: setGradientPaletteText,
                            swatches: gradientSwatches,
                            rows: parsedGradientPalette.rows,
                            footer:
                                gradientSwatches.length === 0 ? (
                                    <p className="dither-gradient-warning">Add at least one valid color to generate a gradient.</p>
                                ) : null,
                            interpolationMode,
                            onInterpolationModeChange: setInterpolationMode,
                        }}
                        imageControls={{
                            imageUrlInput,
                            onImageUrlChange: setImageUrlInput,
                            onImportImage: importImageFromUrl,
                            exampleImages,
                            exampleImagesLoading: areExamplesLoading,
                            exampleImagesError,
                            onImportExampleImage: importExampleImage,
                            isImportingImage,
                            imageScaleMode,
                            onImageScaleModeChange: setImageScaleMode,
                            imageSource,
                            imageImportError,
                            imageSourceReady,
                        }}
                    />

                    <PaletteEditorCard
                        title="Reduction Palette"
                        swatchCountLabel={`${reductionSwatches.length} swatch${reductionSwatches.length === 1 ? "" : "es"}`}
                        presets={PALETTE_PRESETS}
                        onSelectPreset={setReductionPaletteText}
                        lospecTargetLabel="reduction palette"
                        value={reductionPaletteText}
                        onChangeValue={setReductionPaletteText}
                        swatches={reductionSwatches}
                        rows={parsedReductionPalette.rows}
                        placeholder="Leave empty to disable palette reduction"
                        footer={
                            reductionMode === "palette" && reductionSwatches.length === 0 ? (
                                <p className="dither-gradient-warning">
                                    Provide at least one valid color before enabling palette reduction.
                                </p>
                            ) : null
                        }
                    />

                    <section className="dither-gradient-card settings">
                        <header>
                            <strong>Controls</strong>
                        </header>
                        <div className="controls-section-grid">
                            <div className="controls-panel controls-panel--wide">
                                <div className="controls-panel__header">
                                    <h3>Dither</h3>
                                </div>
                                <div className="controls-panel__fields">
                                    <DitherControls
                                        ditherType={ditherType}
                                        onDitherTypeChange={setDitherType}
                                        ditherStrength={ditherStrength}
                                        onDitherStrengthChange={setDitherStrength}
                                        ditherSeed={ditherSeed}
                                        onDitherSeedChange={setDitherSeed}
                                        seedEnabled={seedEnabled}
                                        isErrorDiffusion={isErrorDiffusion}
                                        errorDiffusionKernelId={errorDiffusionKernelId}
                                        onErrorDiffusionKernelChange={setErrorDiffusionKernelId}
                                        isVoronoiDither={isVoronoiDither}
                                        voronoiCellsPerAxis={voronoiCellsPerAxis}
                                        onVoronoiCellsChange={setVoronoiCellsPerAxis}
                                        voronoiCellOptions={VORONOI_CELL_OPTIONS}
                                        voronoiJitter={voronoiJitter}
                                        onVoronoiJitterChange={setVoronoiJitter}
                                    />
                                </div>
                            </div>

                            <div className="controls-panel controls-panel--wide">
                                <div className="controls-panel__header">
                                    <h3>Reduction</h3>
                                </div>
                                <div className="controls-panel__fields">
                                    <ReductionControls
                                        reductionMode={reductionMode}
                                        onReductionModeChange={setReductionMode}
                                        hasReductionPalette={hasReductionPalette}
                                        reductionSwatchCount={reductionSwatches.length}
                                        distanceColorSpace={distanceColorSpace}
                                        onDistanceColorSpaceChange={handleDistanceColorSpaceChange}
                                    />
                                </div>
                            </div>

                            <div className="controls-panel">
                                <div className="controls-panel__header">
                                    <h3>Canvas & Preview</h3>
                                </div>
                                <div className="controls-panel__fields">
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
                            </div>
                        </div>
                    </section>
                </div>

                <div className="dither-gradient-layout">
                    <PreviewSection
                        sourceSummaryLabel={sourceSummaryLabel}
                        ditherType={ditherType}
                        showSourcePreview={showSourcePreview}
                        onToggleSourcePreview={setShowSourcePreview}
                        showDitherPreview={showDitherPreview}
                        onToggleDitherPreview={setShowDitherPreview}
                        showReducedPreview={showReducedPreview}
                        onToggleReducedPreview={setShowReducedPreview}
                        sourceCanvasRef={sourceCanvasRef}
                        ditherCanvasRef={ditherCanvasRef}
                        reducedCanvasRef={reducedCanvasRef}
                        width={width}
                        height={height}
                        previewScale={previewScale}
                        devicePixelRatio={devicePixelRatio}
                        sourceCanvasTitle={sourceCanvasTitle}
                        sourceCanvasDescription={sourceCanvasDescription}
                        reductionMode={reductionMode}
                        reductionSwatchCount={reductionSwatches.length}
                    />
                </div>

                <div className="dither-gradient-layout">
                    <section className="dither-gradient-card preview">
                        <header>
                            <strong>Color Space Scatter</strong>
                            <span>{distanceColorSpace.toUpperCase()} sample distribution</span>
                        </header>
                        {sourceScatterPoints.length === 0 && paletteScatterPoints.length === 0 ? (
                            <div className="color-scatter-container--empty">Import an image or define a reduction palette to preview color samples.</div>
                        ) : (
                            <div className="color-scatter-container">
                                <ColorSpaceScatterPlot
                                    sourcePoints={sourceScatterPoints}
                                    palettePoints={paletteScatterPoints}
                                    axisLabels={scatterAxisLabels}
                                />
                            </div>
                        )}
                        <p className="dither-gradient-note">
                            Up to {MAX_SCATTER_SOURCE_POINTS.toLocaleString()} samples are plotted in the current reduction color space ({distanceColorSpace.toUpperCase()}).
                        </p>
                    </section>
                </div>
            </main>
        </>
    );
}

/**
 * Resolves the four corner colors to hex strings.
 * Missing indices wrap through the available swatches so gradients still render with short palettes.
 */
function deriveCornerHexes(swatches: PaletteSwatchDefinition[], requested: number[]) {
    if (swatches.length === 0) {
        return [] as string[];
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
    return hexes;
}

interface SourceScatterSampleOptions {
    sourceType: SourceType;
    sourceImageData: ImageData | null;
    derivedCornerHexes: string[];
    interpolationMode: ColorInterpolationMode;
    width: number;
    height: number;
    maxPoints: number;
    colorSpace: ColorInterpolationMode;
}

function sampleSourceScatterPoints(options: SourceScatterSampleOptions): ScatterPoint[] {
    const { sourceType, sourceImageData, derivedCornerHexes, interpolationMode, width, height, maxPoints, colorSpace } = options;
    if (sourceType === "image") {
        return sampleImageScatterPoints(sourceImageData, maxPoints, colorSpace);
    }
    if (sourceType === "gradient") {
        return sampleGradientScatterPoints(derivedCornerHexes, interpolationMode, width, height, maxPoints, colorSpace);
    }
    return [];
}

function sampleImageScatterPoints(imageData: ImageData | null, maxPoints: number, colorSpace: ColorInterpolationMode): ScatterPoint[] {
    if (!imageData || maxPoints <= 0) {
        return [];
    }
    const totalPixels = imageData.width * imageData.height;
    if (totalPixels === 0) {
        return [];
    }
    const clampMaxPoints = Math.min(maxPoints, totalPixels);
    const step = Math.max(1, Math.floor(totalPixels / clampMaxPoints));
    const result: ScatterPoint[] = [];
    const { data } = imageData;
    for (let pixelIndex = 0; pixelIndex < totalPixels && result.length < clampMaxPoints; pixelIndex += step) {
        const dataIndex = pixelIndex * 4;
        result.push(
            buildScatterPointFromRgb(
                { r: data[dataIndex], g: data[dataIndex + 1], b: data[dataIndex + 2] },
                colorSpace
            )
        );
    }
    return result;
}

function sampleGradientScatterPoints(
    cornerHexes: string[],
    interpolationMode: ColorInterpolationMode,
    width: number,
    height: number,
    maxPoints: number,
    colorSpace: ColorInterpolationMode
): ScatterPoint[] {
    if (cornerHexes.length < 4 || maxPoints <= 0 || width <= 0 || height <= 0) {
        return [];
    }
    const totalPixels = width * height;
    const clampMaxPoints = Math.min(maxPoints, totalPixels);
    const step = Math.max(1, Math.floor(totalPixels / clampMaxPoints));
    const result: ScatterPoint[] = [];
    for (let pixelIndex = 0; pixelIndex < totalPixels && result.length < clampMaxPoints; pixelIndex += step) {
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);
        const u = width === 1 ? 0 : x / (width - 1);
        const v = height === 1 ? 0 : y / (height - 1);
        const color = interpolateGradientColor(cornerHexes, u, v, interpolationMode);
        result.push(buildScatterPointFromRgb(color, colorSpace));
    }
    return result;
}

function paletteEntriesToScatterPoints(entries: ReductionPaletteEntry[], colorSpace: ColorInterpolationMode): ScatterPoint[] {
    return entries.map((entry) => buildScatterPointFromRgb(entry.rgb, colorSpace));
}

function buildScatterPointFromRgb(rgb: { r: number; g: number; b: number }, mode: ColorInterpolationMode): ScatterPoint {
    return {
        coords: projectRgbToColorSpace(rgb, mode),
        color: [rgb.r, rgb.g, rgb.b],
    };
}

function projectRgbToColorSpace(rgb: { r: number; g: number; b: number }, mode: ColorInterpolationMode): [number, number, number] {
    const coords = rgbToCoords(rgb, mode);
    return [coords[0] ?? 0, coords[1] ?? 0, coords[2] ?? 0];
}

function getColorSpaceAxisLabels(mode: ColorInterpolationMode): [string, string, string] {
    const labels = COLOR_SPACE_AXIS_LABELS[mode];
    if (labels) {
        return labels;
    }
    return ["Axis 1", "Axis 2", "Axis 3"];
}

const COLOR_SPACE_AXIS_LABELS: Partial<Record<ColorInterpolationMode, [string, string, string]>> = {
    rgb: ["Red", "Green", "Blue"],
    hsl: ["Hue X", "Hue Y", "Saturation"],
    hsv: ["Hue X", "Hue Y", "Value"],
    hwb: ["Hue X", "Hue Y", "Whiteness"],
    ryb: ["Hue X", "Hue Y", "Value"],
    "luma-rgb": ["Luma", "Axis 2", "Axis 3"],
    "luma-lab": ["Luma", "Axis 2", "Axis 3"],
    "luma-oklab": ["Luma", "Axis 2", "Axis 3"],
    cmy: ["Cyan", "Magenta", "Yellow"],
    cmyk: ["Cyan", "Magenta", "Yellow"],
    lab: ["L*", "a*", "b*"],
    oklab: ["L", "a", "b"],
    ycbcr: ["Y", "Cb", "Cr"],
    oklch: ["L", "Chroma", "Hue X"],
};

