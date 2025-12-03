import Head from "next/head";
import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
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
import {
    buildProceduralDitherTile,
    DEFAULT_ERROR_DIFFUSION_KERNEL,
    ERROR_DIFFUSION_KERNELS,
    ErrorDiffusionKernel,
    ErrorDiffusionKernelId,
    DitherThresholdTile,
    DitherType,
    DITHER_DESCRIPTIONS,
    DITHER_LABELS,
    DITHER_TYPE_ORDER,
    applyDitherJitter,
    DEFAULT_VORONOI_CELLS,
    DEFAULT_VORONOI_JITTER,
    getErrorDiffusionKernel,
    isErrorDiffusionDither,
    usesSeededDither,
} from "../utils/dithering";
type ReductionMode = "binary" | "palette" | "none";
type DistanceFeature = "all" | "luminance" | "hsl-saturation" | "hsl-lightness" | "oklch-chroma";
type SourceType = "gradient" | "image";
type ImageScaleMode = "cover" | "contain" | "stretch" | "none";
type ImageSourceKind = "url" | "clipboard";
interface ImageSourceState {
    element: HTMLImageElement;
    label: string;
    kind: ImageSourceKind;
    cleanup?: () => void;
}
const DISTANCE_FEATURE_LABELS: Record<DistanceFeature, string> = {
    all: "All components",
    luminance: "Luminance / Lightness",
    "hsl-saturation": "HSL Saturation",
    "hsl-lightness": "HSL Lightness",
    "oklch-chroma": "OKLCH Chroma",
};
const DISTANCE_FEATURE_ORDER: DistanceFeature[] = ["all", "luminance", "hsl-saturation", "hsl-lightness", "oklch-chroma"];
const IMAGE_SCALE_MODE_LABELS: Record<ImageScaleMode, string> = {
    cover: "Cover",
    contain: "Contain",
    stretch: "Stretch",
    none: "No scaling",
};
const LUMINANCE_SUPPORTED_SPACES: ColorInterpolationMode[] = ["lab", "oklch", "ycbcr", "hsl"];
const VORONOI_CELL_OPTIONS = [2, 4, 8, 16, 32, 64];


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
        value: `#000000 // black\n#FFFFFF // white\n#813338 // red\n#75CEC8 // cyan\n#8E3C97 // purple\n#56AC4D // green\n#2E2C9B // blue\n#EDF171 // yellow\n#8E5029 // orange\n#553800 // brown\n#C46C71 // light red\n#4A4A4A // dark gray\n#7B7B7B // medium gray\n#A9FF9F // light green\n#706DEB // light blue\n#B2B2B2 // light gray`,
    },
    {
        label: "PICO-8",
        value: `#000000\n#1D2B53\n#7E2553\n#008751\n#AB5236\n#5F574F\n#C2C3C7\n#FFF1E8\n#FF004D\n#FFA300\n#FFEC27\n#00E436\n#29ADFF\n#83769C\n#FF77A8\n#FFCCAA`,
    },
    {
        label: "SWEETIE 16",
        value: `#1A1423\n#372549\n#774C60\n#B75D69\n#EACDC2\n#F4EBC3\n#F6F7D7\n#F1B5A4\n#E43A19\n#9E0031\n#4C2A85\n#67597A\n#424B54\n#2A2D34\n#1A1A1D\n#0F0A0A`,
    },
] as const;

//const CORNER_LABELS = ["Top Left", "Top Right", "Bottom Left", "Bottom Right"] as const;
interface ReductionPaletteEntry {
    rgb: { r: number; g: number; b: number };
    coords: number[];
}

type PreviewStageKey = "source" | "dither" | "reduced" | "projected";

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

// Returns whether the requested feature projection can be computed in the given color space.
function isDistanceFeatureSupported(mode: ColorInterpolationMode, feature: DistanceFeature) {
    if (feature === "all") {
        return true;
    }
    if (feature === "luminance") {
        return LUMINANCE_SUPPORTED_SPACES.includes(mode);
    }
    if (feature === "hsl-saturation" || feature === "hsl-lightness") {
        return mode === "hsl";
    }
    if (feature === "oklch-chroma") {
        return mode === "oklch";
    }
    return false;
}

function getSupportedDistanceFeatures(mode: ColorInterpolationMode): DistanceFeature[] {
    return DISTANCE_FEATURE_ORDER.filter((feature) => isDistanceFeatureSupported(mode, feature));
}


export default function DitherGradientPage() {
    const [gradientPaletteText, setGradientPaletteText] = useState<string>(PALETTE_PRESETS[0].value);
    const [reductionPaletteText, setReductionPaletteText] = useState<string>(PALETTE_PRESETS[1].value);
    const [cornerAssignments] = useState<number[]>([0, 1, 2, 3]);
    const [interpolationMode, setInterpolationMode] = useState<ColorInterpolationMode>("oklch");
    const [ditherType, setDitherType] = useState<DitherType>("bayer4");
    const [ditherStrength, setDitherStrength] = useState(0.333);
    const [ditherSeed, setDitherSeed] = useState<number>(1);
    const [sourceType, setSourceType] = useState<SourceType>("gradient");
    const [imageUrlInput, setImageUrlInput] = useState("");
    const [imageScaleMode, setImageScaleMode] = useState<ImageScaleMode>("cover");
    const [imageSource, setImageSource] = useState<ImageSourceState | null>(null);
    const [sourceImageData, setSourceImageData] = useState<ImageData | null>(null);
    const [isImportingImage, setIsImportingImage] = useState(false);
    const [imageImportError, setImageImportError] = useState<string | null>(null);
    const [voronoiCellsPerAxis, setVoronoiCellsPerAxis] = useState<number>(DEFAULT_VORONOI_CELLS);
    const [voronoiJitter, setVoronoiJitter] = useState<number>(DEFAULT_VORONOI_JITTER);
    const [errorDiffusionKernelId, setErrorDiffusionKernelId] = useState<ErrorDiffusionKernelId>(DEFAULT_ERROR_DIFFUSION_KERNEL);
    const [reductionMode, setReductionMode] = useState<ReductionMode>("palette");
    const [binaryThreshold, setBinaryThreshold] = useState(127);
    const [distanceColorSpace, setDistanceColorSpace] = useState<ColorInterpolationMode>("lab");
    const [distanceFeature, setDistanceFeature] = useState<DistanceFeature>("all");
    const [width, setWidth] = useState(256);
    const [height, setHeight] = useState(256);
    const [previewScale, setPreviewScale] = useState(2);
    const [showSourcePreview, setShowSourcePreview] = useState(true);
    const [showDitherPreview, setShowDitherPreview] = useState(false);
    const [showReducedPreview, setShowReducedPreview] = useState(true);
    const [showProjectedPreview, setShowProjectedPreview] = useState(false);
    const devicePixelRatio = useDevicePixelRatio();

    const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const ditherCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const reducedCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const projectedCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const parsedGradientPalette = useMemo(() => parsePaletteDefinition(gradientPaletteText), [gradientPaletteText]);
    const gradientSwatches = parsedGradientPalette.swatches;

    const parsedReductionPalette = useMemo(() => parsePaletteDefinition(reductionPaletteText), [reductionPaletteText]);
    const reductionSwatches = parsedReductionPalette.swatches;
    const hasReductionPalette = reductionSwatches.length > 0;

    const derivedCorners = useMemo(() => deriveCornerHexes(gradientSwatches, cornerAssignments), [gradientSwatches, cornerAssignments]);
    const reductionPaletteEntries = useMemo<ReductionPaletteEntry[]>(
        () =>
            reductionSwatches.map((swatch) => {
                const rgb255 = rgbUnitTo255(hexToRgb(swatch.hex));
                return {
                    rgb: rgb255,
                    coords: rgbToCoords(rgb255, distanceColorSpace, distanceFeature),
                };
            }),
        [reductionSwatches, distanceColorSpace, distanceFeature]
    );
    const supportedDistanceFeatures = useMemo(() => getSupportedDistanceFeatures(distanceColorSpace), [distanceColorSpace]);
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

    const replaceImageSource = useCallback((next: ImageSourceState | null) => {
        setImageSource((previous) => {
            if (previous?.cleanup) {
                try {
                    previous.cleanup();
                } catch {
                    // ignore cleanup failures
                }
            }
            return next;
        });
    }, []);

    useEffect(() => {
        if (!imageSource?.element) {
            setSourceImageData(null);
            return;
        }
        if (typeof document === "undefined") {
            return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            return;
        }
        drawImageWithScaleMode(ctx, imageSource.element, imageScaleMode, width, height);
        const nextImageData = ctx.getImageData(0, 0, width, height);
        setSourceImageData(nextImageData);
    }, [imageSource, width, height, imageScaleMode]);

    useEffect(() => {
        return () => {
            replaceImageSource(null);
        };
    }, [replaceImageSource]);

    const handleDistanceColorSpaceChange = (event: ChangeEvent<HTMLSelectElement>) => {
        const nextMode = event.target.value as ColorInterpolationMode;
        setDistanceColorSpace(nextMode);
        setDistanceFeature((previous: DistanceFeature) => {
            if (isDistanceFeatureSupported(nextMode, previous)) {
                return previous;
            }
            const nextFeatures = getSupportedDistanceFeatures(nextMode);
            return nextFeatures[0] ?? "all";
        });
    };

    const handleImportImage = async () => {
        const trimmedUrl = imageUrlInput.trim();
        if (!trimmedUrl) {
            setImageImportError("Enter an image URL");
            return;
        }
        if (typeof window === "undefined") {
            setImageImportError("Image import is only available in the browser");
            return;
        }
        setIsImportingImage(true);
        setImageImportError(null);
        try {
            const imageElement = await loadImageElementFromUrl(trimmedUrl);
            replaceImageSource({
                element: imageElement,
                label: "Imported URL",
                kind: "url",
            });
            setSourceType("image");
        } catch (error) {
            replaceImageSource(null);
            setImageImportError(error instanceof Error ? error.message : "Failed to import image");
        } finally {
            setIsImportingImage(false);
        }
    };

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        const handlePaste = (event: ClipboardEvent) => {
            const clipboardData = event.clipboardData;
            if (!clipboardData) {
                return;
            }
            const fileItem = Array.from(clipboardData.items).find((item) => item.kind === "file" && item.type.startsWith("image/"));
            if (!fileItem) {
                return;
            }
            const file = fileItem.getAsFile();
            if (!file) {
                return;
            }
            const objectUrl = URL.createObjectURL(file);
            const pastedImage = new Image();
            pastedImage.decoding = "async";
            pastedImage.onload = () => {
                replaceImageSource({
                    element: pastedImage,
                    label: "Pasted image",
                    kind: "clipboard",
                    cleanup: () => URL.revokeObjectURL(objectUrl),
                });
                setImageImportError(null);
                setSourceType("image");
                setImageUrlInput("");
            };
            pastedImage.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                setImageImportError("Unable to decode pasted image");
            };
            pastedImage.src = objectUrl;
        };
        window.addEventListener("paste", handlePaste);
        return () => window.removeEventListener("paste", handlePaste);
    }, [replaceImageSource]);

    useEffect(() => {
        const previewStages: PreviewStageConfig[] = [
            { key: "source", enabled: showSourcePreview, ref: sourceCanvasRef },
            { key: "dither", enabled: showDitherPreview, ref: ditherCanvasRef },
            { key: "reduced", enabled: showReducedPreview, ref: reducedCanvasRef },
            { key: "projected", enabled: showProjectedPreview, ref: projectedCanvasRef },
        ];

        const useErrorDiffusion = isErrorDiffusion && selectedErrorDiffusionKernel;
        const errorDiffusionContext = useErrorDiffusion
            ? createErrorDiffusionContext(width, height, selectedErrorDiffusionKernel)
            : null;

        const requiresGradientData = sourceType === "gradient";
        const requiresImageData = sourceType === "image";
        if ((requiresGradientData && derivedCorners.hexes.length < 4) || (requiresImageData && !sourceImageData)) {
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
                const base = sampleSourceColor(
                    sourceType,
                    derivedCorners.hexes,
                    interpolationMode,
                    u,
                    v,
                    x,
                    y,
                    sourceImageData
                );
                const sourceColor = clampRgb255(base);
                let ditheredColor: { r: number; g: number; b: number };
                let reducedColor: { r: number; g: number; b: number };
                if (errorDiffusionContext) {
                    const result = applyErrorDiffusionToPixel(
                        base,
                        x,
                        y,
                        errorDiffusionContext,
                        ditherStrength,
                        reductionMode,
                        binaryThreshold,
                        reductionPaletteEntries,
                        distanceColorSpace,
                        distanceFeature
                    );
                    ditheredColor = result.ditheredColor;
                    reducedColor = result.quantizedColor;
                } else {
                    const jittered = applyDitherJitter(base, x, y, ditherType, ditherStrength, ditherSeed, proceduralDitherTile);
                    ditheredColor = clampRgb255(jittered);
                    reducedColor = clampRgb255(
                        applyReduction(
                            jittered,
                            reductionMode,
                            binaryThreshold,
                            reductionPaletteEntries,
                            distanceColorSpace,
                            distanceFeature
                        )
                    );
                }
                let projectedColor: { r: number; g: number; b: number } | null = null;
                if (stageMap.projected) {
                    projectedColor =
                        distanceFeature === "all"
                            ? sourceColor
                            : coordsToPreviewRgb(rgbToCoords(sourceColor, distanceColorSpace, distanceFeature));
                }

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
                if (stageMap.projected && projectedColor) {
                    writePixel(stageMap.projected.imageData.data, offset, projectedColor);
                }
            }
            if (errorDiffusionContext) {
                advanceErrorDiffusionRow(errorDiffusionContext);
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
        ditherSeed,
        reductionMode,
        binaryThreshold,
        distanceColorSpace,
        reductionPaletteEntries,
        proceduralDitherTile,
        errorDiffusionKernelId,
        showSourcePreview,
        showDitherPreview,
        showReducedPreview,
        showProjectedPreview,
        distanceFeature,
        sourceType,
        sourceImageData,
    ]);

    // const handleCornerChange = (cornerIndex: number, swatchIndex: number) => {
    //     setCornerAssignments((prev) => {
    //         const next = [...prev];
    //         next[cornerIndex] = swatchIndex;
    //         return next;
    //     });
    // };

    const projectedPreviewDescription = distanceFeature === "all" ? "Same as source" : `${DISTANCE_FEATURE_LABELS[distanceFeature]} projection`;
    const seedEnabled = usesSeededDither(ditherType);
    const isVoronoiDither = ditherType === "voronoi-cluster";
    const isErrorDiffusion = isErrorDiffusionDither(ditherType);
    const selectedErrorDiffusionKernel = getErrorDiffusionKernel(errorDiffusionKernelId);
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
                    <Link href="/">&#8592; TypefaceComparisonTool</Link>
                    <h1>Bilinear Dither Gradient Lab</h1>
                </div>

                <div className="dither-gradient-layout">
                    <section className="dither-gradient-card palette">
                        <header>
                            <strong>Gradient Palette (should be 4 colors)</strong>
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
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                <span>Source</span>
                                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                                    <label style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                        <input
                                            type="radio"
                                            name="source-type"
                                            value="gradient"
                                            checked={sourceType === "gradient"}
                                            onChange={() => setSourceType("gradient")}
                                        />
                                        Gradient
                                    </label>
                                    <label style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                        <input
                                            type="radio"
                                            name="source-type"
                                            value="image"
                                            checked={sourceType === "image"}
                                            onChange={() => setSourceType("image")}
                                        />
                                        Image
                                    </label>
                                </div>
                            </div>
                            {sourceType === "image" && (
                                <>
                                    <label>
                                        Image URL
                                        <div style={{ display: "flex", gap: "0.5rem" }}>
                                            <input
                                                type="url"
                                                placeholder="https://example.com/image.png"
                                                value={imageUrlInput}
                                                onChange={(event) => setImageUrlInput(event.target.value)}
                                            />
                                            <button
                                                type="button"
                                                onClick={handleImportImage}
                                                disabled={isImportingImage || !imageUrlInput.trim()}
                                            >
                                                {isImportingImage ? "Importing…" : "Import"}
                                            </button>
                                        </div>
                                    </label>
                                    <label>
                                        Image Scaling
                                        <select
                                            value={imageScaleMode}
                                            onChange={(event) => setImageScaleMode(event.target.value as ImageScaleMode)}
                                        >
                                            {Object.entries(IMAGE_SCALE_MODE_LABELS).map(([value, label]) => (
                                                <option value={value} key={value}>
                                                    {label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    {imageSource && !imageImportError && (
                                        <p className="dither-gradient-note">
                                            {imageSource.label} • {imageSource.element.naturalWidth}×{imageSource.element.naturalHeight}px
                                        </p>
                                    )}
                                    {imageImportError && <p className="dither-gradient-warning">{imageImportError}</p>}
                                    {!imageSourceReady && !imageImportError && !imageSource && (
                                        <p className="dither-gradient-warning">Import an image to enable the image source.</p>
                                    )}
                                    <p className="dither-gradient-note">Tip: You can also paste an image directly (Ctrl/Cmd+V).</p>
                                </>
                            )}
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
                                    {DITHER_TYPE_ORDER.map((type) => (
                                        <option value={type} key={type}>
                                            {DITHER_LABELS[type]}
                                        </option>
                                    ))}
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
                                Pattern Seed {seedEnabled ? "" : "(not used)"}
                                <input
                                    type="number"
                                    min={0}
                                    max={99999999}
                                    step={1}
                                    value={ditherSeed}
                                    onChange={(event) => {
                                        const next = event.target.valueAsNumber;
                                        setDitherSeed(Number.isFinite(next) ? next : 0);
                                    }}
                                    disabled={!seedEnabled}
                                />
                            </label>
                            {isErrorDiffusion && (
                                <label>
                                    Error Diffusion Kernel
                                    <select
                                        value={errorDiffusionKernelId}
                                        onChange={(event) =>
                                            setErrorDiffusionKernelId(event.target.value as ErrorDiffusionKernelId)
                                        }
                                    >
                                        {ERROR_DIFFUSION_KERNELS.map((kernel) => (
                                            <option value={kernel.id} key={kernel.id}>
                                                {kernel.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            )}
                            {isVoronoiDither && (
                                <>
                                    <label>
                                        Voronoi Cells per Axis
                                        <select
                                            value={voronoiCellsPerAxis}
                                            onChange={(event) => setVoronoiCellsPerAxis(Number(event.target.value))}
                                        >
                                            {VORONOI_CELL_OPTIONS.map((option) => (
                                                <option value={option} key={option}>
                                                    {option}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        Voronoi Jitter ({voronoiJitter.toFixed(2)})
                                        <input
                                            type="range"
                                            min={0}
                                            max={1}
                                            step={0.05}
                                            value={voronoiJitter}
                                            onChange={(event) => setVoronoiJitter(Number(event.target.value))}
                                        />
                                    </label>
                                </>
                            )}
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
                                    <select value={distanceColorSpace} onChange={handleDistanceColorSpaceChange}>
                                        <option value="rgb">RGB</option>
                                        <option value="hsl">HSL</option>
                                        <option value="cmyk">CMYK</option>
                                        <option value="lab">LAB</option>
                                        <option value="ycbcr">YCbCr</option>
                                        <option value="oklch">OKLCH</option>
                                    </select>
                                </label>
                            )}
                            {reductionMode === "palette" && (
                                <label>
                                    Distance Feature
                                    <select value={distanceFeature} onChange={(event) => setDistanceFeature(event.target.value as DistanceFeature)}>
                                        {supportedDistanceFeatures.map((feature) => (
                                            <option value={feature} key={feature}>
                                                {DISTANCE_FEATURE_LABELS[feature]}
                                            </option>
                                        ))}
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
                            <span>
                                {sourceSummaryLabel} • {ditherType === "none" ? "No dithering" : DITHER_LABELS[ditherType]}
                            </span>
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
                            <label>
                                <input type="checkbox" checked={showProjectedPreview} onChange={(event) => setShowProjectedPreview(event.target.checked)} /> Distance Projection
                            </label>
                        </div>
                        <div className="preview-canvas-grid">
                            {showSourcePreview && (
                                <GradientPreviewCanvas
                                    ref={sourceCanvasRef}
                                    title={sourceCanvasTitle}
                                    description={sourceCanvasDescription}
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
                                    description={DITHER_DESCRIPTIONS[ditherType]}
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
                            {showProjectedPreview && (
                                <GradientPreviewCanvas
                                    ref={projectedCanvasRef}
                                    title="Distance Projection"
                                    description={projectedPreviewDescription}
                                    width={width}
                                    height={height}
                                    previewScale={previewScale}
                                    devicePixelRatio={devicePixelRatio}
                                />
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

/**
 * Resolves the four corner colors to hex strings.
 * Missing indices wrap through the available swatches so gradients still render with short palettes.
 */
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

/**
 * Applies the currently selected reduction strategy to a single RGB pixel.
 * rgb values are in 0-255 range, binaryThreshold is also 0-255, palette entries carry cached coordinates.
 */
function applyReduction(
    rgb: { r: number; g: number; b: number },
    mode: ReductionMode,
    binaryThreshold: number,
    palette: ReductionPaletteEntry[],
    distanceMode: ColorInterpolationMode,
    distanceFeature: DistanceFeature
) {
    if (mode === "binary") {
        return stepRgb(rgb, binaryThreshold);
    }
    if (mode === "palette" && palette.length > 0) {
        return quantizeToPalette(rgb, palette, distanceMode, distanceFeature);
    }
    return rgb;
}

/**
 * Snaps the provided RGB pixel to the closest palette entry using the chosen color space + feature projection.
 * Returns the palette RGB (0-255) for the best match, or the input when the palette is empty.
 */
function quantizeToPalette(
    rgb: { r: number; g: number; b: number },
    palette: ReductionPaletteEntry[],
    distanceMode: ColorInterpolationMode,
    distanceFeature: DistanceFeature
) {
    if (palette.length === 0) {
        return rgb;
    }
    const targetCoords = rgbToCoords(rgb, distanceMode, distanceFeature);
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

/**
 * Converts an sRGB pixel (0-255) into a unit-space vector for the requested color space and optional feature.
 * Returns a numeric tuple (0-1-ish values) suitable for Euclidean distance comparisons.
 */
function rgbToCoords(rgb: { r: number; g: number; b: number }, mode: ColorInterpolationMode, feature: DistanceFeature) {
    const vector = rgb255ToVector(rgb, mode);
    const coords = vectorToTuple(vector, mode);
    return projectDistanceFeature(vector, coords, mode, feature);
}

/**
 * Projects the coordinate list onto a specific feature (e.g., luminance) when requested.
 * Input vector is whatever structure convertHexToVector emitted for the given color space.
 */
function projectDistanceFeature(
    vector: ReturnType<typeof convertHexToVector>,
    coords: number[],
    mode: ColorInterpolationMode,
    feature: DistanceFeature
): number[] {
    if (!isDistanceFeatureSupported(mode, feature)) {
        throw new Error(`Distance feature ${feature} is not supported in ${mode}`);
    }
    if (feature === "all") {
        return coords;
    }
    if (feature === "luminance") {
        if (mode === "lab") {
            const labVector = vector as { l?: number };
            return [Math.max(0, Math.min(1, (labVector.l ?? 0) / 100))];
        }
        if (mode === "oklch") {
            const oklchVector = vector as { L?: number };
            return [oklchVector.L ?? 0];
        }
        if (mode === "ycbcr") {
            const ycbcrVector = vector as { y?: number };
            return [ycbcrVector.y ?? 0];
        }
        if (mode === "hsl") {
            const hslVector = vector as { l?: number };
            return [hslVector.l ?? 0];
        }
        throw new Error(`Unhandled luminance mode: ${mode}`);
    }
    if (feature === "hsl-saturation" && mode === "hsl") {
        const hslVector = vector as { s?: number };
        return [hslVector.s ?? 0];
    }
    if (feature === "hsl-lightness" && mode === "hsl") {
        const hslVector = vector as { l?: number };
        return [hslVector.l ?? 0];
    }
    if (feature === "oklch-chroma" && mode === "oklch") {
        const oklchVector = vector as { C?: number };
        return [Math.max(0, (oklchVector.C ?? 0) / OKLCH_CHROMA_NORMALIZER)];
    }
    return coords;
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

// Simple squared Euclidean distance between tuples of equal (or truncated) length.
function distanceSq(a: number[], b: number[]) {
    const length = Math.min(a.length, b.length);
    let total = 0;
    for (let index = 0; index < length; index++) {
        const delta = (a[index] ?? 0) - (b[index] ?? 0);
        total += delta * delta;
    }
    return total;
}

// Converts projected coordinate tuples into RGB for visualization. Components cycle over R/G/B as needed.
function coordsToPreviewRgb(coords: number[]) {
    // if (coords.length === 0) {
    //     return { r: 0, g: 0, b: 0 };
    // }
    const normalized = coords.map((value) => normalizeCoordComponent(value));
    const sample = (channelIndex: number) => normalized[channelIndex % normalized.length];
    return clampRgb255({
        r: sample(0),
        g: sample(1),
        b: sample(2),
    });
}

function normalizeCoordComponent(value: number) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    if (value >= 0 && value <= 1) {
        return Math.round(Math.min(1, Math.max(0, value)) * 255);
    }
    const shifted = (value + 1) / 2; // approximate -1..1 range to 0..1
    return Math.round(Math.min(1, Math.max(0, shifted)) * 255);
}

// Writes a single pixel into an ImageData buffer using 0-255 channel ranges.
function sampleSourceColor(
    sourceType: SourceType,
    cornerHexes: string[],
    interpolationMode: ColorInterpolationMode,
    u: number,
    v: number,
    x: number,
    y: number,
    sourceImageData: ImageData | null
) {
    if (sourceType === "image" && sourceImageData) {
        const clampedX = Math.max(0, Math.min(sourceImageData.width - 1, x));
        const clampedY = Math.max(0, Math.min(sourceImageData.height - 1, y));
        const offset = (clampedY * sourceImageData.width + clampedX) * 4;
        const data = sourceImageData.data;
        return {
            r: data[offset] ?? 0,
            g: data[offset + 1] ?? 0,
            b: data[offset + 2] ?? 0,
        };
    }
    return interpolateGradientColor(cornerHexes, u, v, interpolationMode);
}

function writePixel(buffer: Uint8ClampedArray, offset: number, color: { r: number; g: number; b: number }) {
    buffer[offset] = color.r;
    buffer[offset + 1] = color.g;
    buffer[offset + 2] = color.b;
    buffer[offset + 3] = 255;
}

interface ErrorDiffusionContext {
    kernel: ErrorDiffusionKernel;
    rowBuffers: Float32Array[];
    width: number;
    height: number;
}

function createErrorDiffusionContext(width: number, height: number, kernel: ErrorDiffusionKernel): ErrorDiffusionContext {
    const bufferCount = Math.max(1, kernel.maxDy + 1);
    const rowBuffers = Array.from({ length: bufferCount }, () => new Float32Array(width * 3));
    return { kernel, rowBuffers, width, height };
}

function advanceErrorDiffusionRow(context: ErrorDiffusionContext) {
    if (context.rowBuffers.length === 0) {
        return;
    }
    const finished = context.rowBuffers.shift();
    if (!finished) {
        return;
    }
    finished.fill(0);
    context.rowBuffers.push(finished);
}

function applyErrorDiffusionToPixel(
    baseColor: { r: number; g: number; b: number },
    x: number,
    y: number,
    context: ErrorDiffusionContext,
    strength: number,
    reductionMode: ReductionMode,
    binaryThreshold: number,
    palette: ReductionPaletteEntry[],
    distanceMode: ColorInterpolationMode,
    distanceFeature: DistanceFeature
) {
    const currentRow = context.rowBuffers[0];
    const index = x * 3;
    const adjusted = {
        r: baseColor.r + (currentRow[index] ?? 0),
        g: baseColor.g + (currentRow[index + 1] ?? 0),
        b: baseColor.b + (currentRow[index + 2] ?? 0),
    };
    currentRow[index] = 0;
    currentRow[index + 1] = 0;
    currentRow[index + 2] = 0;

    const ditheredColor = clampRgb255(adjusted);
    const quantizedColor = clampRgb255(
        applyReduction(ditheredColor, reductionMode, binaryThreshold, palette, distanceMode, distanceFeature)
    );
    const error = {
        r: ditheredColor.r - quantizedColor.r,
        g: ditheredColor.g - quantizedColor.g,
        b: ditheredColor.b - quantizedColor.b,
    };
    if (strength > 0) {
        diffuseError(error, x, y, context, strength);
    }
    return { ditheredColor, quantizedColor };
}

function diffuseError(
    error: { r: number; g: number; b: number },
    x: number,
    y: number,
    context: ErrorDiffusionContext,
    strength: number
) {
    const { kernel, rowBuffers, width, height } = context;
    if (kernel.divisor === 0) {
        return;
    }
    for (const offset of kernel.offsets) {
        const targetX = x + offset.dx;
        const targetY = y + offset.dy;
        if (targetX < 0 || targetX >= width) {
            continue;
        }
        if (targetY < 0 || targetY >= height) {
            continue;
        }
        const buffer = rowBuffers[offset.dy];
        if (!buffer) {
            continue;
        }
        const contribution = (offset.weight / kernel.divisor) * strength;
        if (contribution === 0) {
            continue;
        }
        const idx = targetX * 3;
        buffer[idx] += error.r * contribution;
        buffer[idx + 1] += error.g * contribution;
        buffer[idx + 2] += error.b * contribution;
    }
}


// applies hard step function to each RGB channel (if n < step, return 0 else return 255)
// Binary per-channel threshold (0-255 inputs/threshold) used by the "binary" reduction mode.
function stepRgb(rgb: { r: number; g: number; b: number }, step: number) {
    return {
        r: rgb.r < step ? 0 : 255,
        g: rgb.g < step ? 0 : 255,
        b: rgb.b < step ? 0 : 255,
    };
}


// Rounds and clamps intermediate floating-point channel values into valid 0-255 integers.
function clampRgb255(rgb: { r: number; g: number; b: number }) {
    return {
        r: Math.min(255, Math.max(0, Math.round(rgb.r))),
        g: Math.min(255, Math.max(0, Math.round(rgb.g))),
        b: Math.min(255, Math.max(0, Math.round(rgb.b))),
    };
}

async function loadImageElementFromUrl(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.decoding = "async";
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Unable to load image"));
        image.src = url;
    });
}

function drawImageWithScaleMode(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    mode: ImageScaleMode,
    targetWidth: number,
    targetHeight: number
) {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (sourceWidth <= 0 || sourceHeight <= 0) {
        ctx.clearRect(0, 0, targetWidth, targetHeight);
        return;
    }
    ctx.clearRect(0, 0, targetWidth, targetHeight);
    let drawWidth = targetWidth;
    let drawHeight = targetHeight;
    let dx = 0;
    let dy = 0;
    if (mode === "stretch") {
        drawWidth = targetWidth;
        drawHeight = targetHeight;
    } else if (mode === "none") {
        drawWidth = sourceWidth;
        drawHeight = sourceHeight;
    } else {
        const scale = mode === "cover"
            ? Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight)
            : Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
        drawWidth = sourceWidth * scale;
        drawHeight = sourceHeight * scale;
    }
    dx = (targetWidth - drawWidth) / 2;
    dy = (targetHeight - drawHeight) / 2;
    if (mode === "none") {
        dx = 0;
        dy = 0;
    }
    ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
}

