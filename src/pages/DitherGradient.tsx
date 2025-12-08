import Head from "next/head";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parsePaletteDefinition } from "../utils/paletteDefinition";
import { ColorInterpolationMode, rgbUnitTo255 } from "../utils/colorSpaces";
import { hexToRgb } from "../utils/color";
import { useDevicePixelRatio } from "../hooks/useDevicePixelRatio";
import "../styles/DitherGradient.css";
import "../styles/PaletteDefinition.css";
import { fetchDitherSourceExamples, type ExampleImage } from "@/data/ditherSourceExamples";
import { useImageSource } from "@/hooks/useImageSource";
import { useDitherRenderer } from "@/hooks/useDitherRenderer";
import type { ReductionMode, SourceType } from "@/types/dither";
import {
    blendColorTowardPalette,
    DEFAULT_PALETTE_MAGNET_PARAMS,
    rgbToCoords,
    type PaletteMagnetParams,
    type ReductionPaletteEntry,
} from "@/utils/paletteDistance";
import { PaletteEditorCard } from "@/components/dither/PaletteEditorCard";
import { SourceControlsCard } from "@/components/dither/SourceControlsCard";
import { DitherControls } from "@/components/dither/DitherControls";
import { ReductionControls } from "@/components/dither/ReductionControls";
import { PreviewSection } from "@/components/dither/PreviewSection";
import { Tooltip } from "@/components/Tooltip";
import { ColorSpaceScatterPlot, type ScatterPoint } from "@/components/dither/ColorSpaceScatterPlot";
import { extractAxisTriple, type AxisTriple } from "@/utils/colorAxes";
import { applyGamutTransformToColor, type GamutTransform } from "@/utils/gamutTransform";
import { CANVAS_SIZE_MAX, CANVAS_SIZE_MIN, CANVAS_SIZE_STEP, type CanvasSize } from "@/utils/canvasSizing";
import {
    buildGradientField,
    resolveGradientControlPoints,
    sampleGradientField,
    type GradientAutoPlacementMode,
    type GradientField,
} from "@/utils/gradientField";
import {
    blendRotationMatrix,
    determinantMatrix3,
    identityMatrix3,
    isIdentityMatrix3,
    jacobiEigenDecomposition,
    multiplyMatrix3,
    transposeMatrix3,
    type Matrix3,
} from "@/utils/matrix3";
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
import { DEFAULT_PERCEPTUAL_BLUR_RADIUS_PX, type PerceptualSimilarityResult } from "@/utils/perceptualSimilarity";
import { MarkdownFile } from "@/components/MarkdownFile";
const VORONOI_CELL_OPTIONS = [2, 4, 8, 16, 32, 64];
const MAX_SCATTER_SOURCE_POINTS = 4000;
const DEFAULT_PALETTE_NUDGE_STRENGTH = 0.1;
const PERCEPTUAL_BLUR_MIN_PX = 0.5;
const PERCEPTUAL_BLUR_MAX_PX = 8;
const PERCEPTUAL_BLUR_STEP_PX = 0.25;


const RGB_THREE_LEVELS = [0, 128, 255] as const;

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
        label: "RGB Primaries",
        value: `#FF0000 // red\n#00FF00 // green\n#0000FF // blue\n-----\n#00FFFF // cyan\n#FF00FF // magenta\n#FFFF00 // yellow\n#000000 // black\n#FFFFFF // white`,
    },
    {
        label: "RGB Levels (3)",
        value: buildRgbLevelPalette(RGB_THREE_LEVELS),
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

type GamutStrengthSnapshot = {
    overall: number;
    translation: number;
    rotation: number;
    scale: AxisTriple;
};

export default function DitherGradientPage() {
    const [gradientPaletteText, setGradientPaletteText] = useState<string>(PALETTE_PRESETS[0].value);
    const [reductionPaletteText, setReductionPaletteText] = useState<string>(PALETTE_PRESETS[1].value);
    const [gradientAutoPlacementMode, setGradientAutoPlacementMode] = useState<GradientAutoPlacementMode>("grid");
    const [gradientInterpolationCurve, setGradientInterpolationCurve] = useState(0.5);
    const [interpolationMode, setInterpolationMode] = useState<ColorInterpolationMode>("oklch");
    const [ditherType, setDitherType] = useState<DitherType>("bayer4");
    const [ditherStrength, setDitherStrength] = useState(0.333);
    const [ditheringEnabled, setDitheringEnabled] = useState(true);
    const [savedDitherStrength, setSavedDitherStrength] = useState(ditherStrength);
    const [ditherSeed, setDitherSeed] = useState<number>(1);
    const [sourceType, setSourceType] = useState<SourceType>("gradient");
    const [voronoiCellsPerAxis, setVoronoiCellsPerAxis] = useState<number>(DEFAULT_VORONOI_CELLS);
    const [voronoiJitter, setVoronoiJitter] = useState<number>(DEFAULT_VORONOI_JITTER);
    const [errorDiffusionKernelId, setErrorDiffusionKernelId] = useState<ErrorDiffusionKernelId>(DEFAULT_ERROR_DIFFUSION_KERNEL);
    const [reductionMode, setReductionMode] = useState<ReductionMode>("palette");
    const [distanceColorSpace, setDistanceColorSpace] = useState<ColorInterpolationMode>("oklab");
    const [width, setWidth] = useState(160);
    const [height, setHeight] = useState(160);
    const [previewScale, setPreviewScale] = useState(2);
    const [perceptualBlurRadiusPx, setPerceptualBlurRadiusPx] = useState<number>(DEFAULT_PERCEPTUAL_BLUR_RADIUS_PX);
    const [perceptualMatch, setPerceptualMatch] = useState<PerceptualSimilarityResult | null>(null);
    const [ditherMaskBlurRadius, setDitherMaskBlurRadius] = useState(4);
    const [ditherMaskStrength, setDitherMaskStrength] = useState(3);
    const [sourceGamma, setSourceGamma] = useState(1);
    const [paletteMaskEnabled, setPaletteMaskEnabled] = useState(true);
    const [ditherErrorScale, setDitherErrorScale] = useState(5);
    const [ditherErrorExponent, setDitherErrorExponent] = useState(0.1);
    const [ditherAmbiguityExponent, setDitherAmbiguityExponent] = useState(0.1);
    const [ditherAmbiguityBias, setDitherAmbiguityBias] = useState(0.5);
    const [sourceAdjustmentsEnabled, setSourceAdjustmentsEnabled] = useState(true);
    const [gamutOverallStrength, setGamutOverallStrength] = useState(0.3);
    const [gamutTranslationStrength, setGamutTranslationStrength] = useState(1);
    const [gamutRotationStrength, setGamutRotationStrength] = useState(0.0);
    const [gamutScaleStrength, setGamutScaleStrength] = useState<AxisTriple>([1, 1, 1]);
    const [gamutFitEnabled, setGamutFitEnabled] = useState(true);
    const [savedGamutStrengths, setSavedGamutStrengths] = useState<GamutStrengthSnapshot>(() => ({
        overall: gamutOverallStrength,
        translation: gamutTranslationStrength,
        rotation: gamutRotationStrength,
        scale: [...gamutScaleStrength] as AxisTriple,
    }));
    const [paletteNudgeStrength, setPaletteNudgeStrength] = useState(DEFAULT_PALETTE_NUDGE_STRENGTH);
    const [paletteNudgeEnabled, setPaletteNudgeEnabled] = useState(false);
    const [savedPaletteNudgeStrength, setSavedPaletteNudgeStrength] = useState(DEFAULT_PALETTE_NUDGE_STRENGTH);
    const [paletteMagnetRadiusDir, setPaletteMagnetRadiusDir] = useState(DEFAULT_PALETTE_MAGNET_PARAMS.radiusDir);
    const [paletteMagnetAmbiguityPower, setPaletteMagnetAmbiguityPower] = useState(DEFAULT_PALETTE_MAGNET_PARAMS.kAmb);
    const [paletteMagnetNearestCount, setPaletteMagnetNearestCount] = useState(DEFAULT_PALETTE_MAGNET_PARAMS.kNearest);
    const [exampleImages, setExampleImages] = useState<ExampleImage[]>([]);
    const [areExamplesLoading, setAreExamplesLoading] = useState(true);
    const [exampleImagesError, setExampleImagesError] = useState<string | null>(null);
    const handleActivateImageSource = useCallback(() => setSourceType("image"), [setSourceType]);
    const handleAutoResizeCanvas = useCallback(
        ({ width: suggestedWidth, height: suggestedHeight }: CanvasSize) => {
            setWidth((previousWidth) => (previousWidth === suggestedWidth ? previousWidth : suggestedWidth));
            setHeight((previousHeight) => (previousHeight === suggestedHeight ? previousHeight : suggestedHeight));
        },
        [setWidth, setHeight]
    );
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
        onAutoResizeCanvas: handleAutoResizeCanvas,
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
    const [showGamutPreview, setShowGamutPreview] = useState(false);
    const [showDitherPreview, setShowDitherPreview] = useState(false);
    const [showReducedPreview, setShowReducedPreview] = useState(true);
    const [showPaletteErrorPreview, setShowPaletteErrorPreview] = useState(false);
    const [showPaletteAmbiguityPreview, setShowPaletteAmbiguityPreview] = useState(false);
    const [showPaletteModulationPreview, setShowPaletteModulationPreview] = useState(false);
    const [showPerceptualDeltaPreview, setShowPerceptualDeltaPreview] = useState(false);
    const [showPerceptualBlurReferencePreview, setShowPerceptualBlurReferencePreview] = useState(false);
    const [showPerceptualBlurTestPreview, setShowPerceptualBlurTestPreview] = useState(false);
    const devicePixelRatio = useDevicePixelRatio();

    const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const gamutCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const ditherCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const reducedCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const paletteErrorCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const paletteAmbiguityCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const paletteModulationCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const perceptualDeltaCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const perceptualBlurReferenceCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const perceptualBlurTestCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const parsedGradientPalette = useMemo(() => parsePaletteDefinition(gradientPaletteText), [gradientPaletteText]);
    const gradientSwatches = parsedGradientPalette.swatches;
    const gradientControlPoints = useMemo(
        () => resolveGradientControlPoints(gradientSwatches, gradientAutoPlacementMode),
        [gradientSwatches, gradientAutoPlacementMode]
    );
    const gradientField = useMemo(
        () => buildGradientField(gradientControlPoints, interpolationMode, gradientInterpolationCurve),
        [gradientControlPoints, interpolationMode, gradientInterpolationCurve]
    );

    const parsedReductionPalette = useMemo(() => parsePaletteDefinition(reductionPaletteText), [reductionPaletteText]);
    const reductionSwatches = parsedReductionPalette.swatches;
    const hasReductionPalette = reductionSwatches.length > 0;
    const paletteMagnetParams = useMemo<PaletteMagnetParams>(
        () => ({
            radiusDir: paletteMagnetRadiusDir,
            kAmb: paletteMagnetAmbiguityPower,
            kNearest: paletteMagnetNearestCount,
        }),
        [paletteMagnetRadiusDir, paletteMagnetAmbiguityPower, paletteMagnetNearestCount]
    );
    const effectivePaletteNudgeStrength = sourceAdjustmentsEnabled && paletteNudgeEnabled
        ? paletteNudgeStrength
        : 0;
    const paletteNudgeActive = effectivePaletteNudgeStrength > 0 && hasReductionPalette && reductionMode === "palette";
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
                gradientField,
                width,
                height,
                maxPoints: MAX_SCATTER_SOURCE_POINTS,
                colorSpace: distanceColorSpace,
            }),
        [
            sourceType,
            sourceImageData,
            gradientField,
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
    const sourceAxisStats = useMemo(
        () => computeAxisStats(sourceScatterPoints, distanceColorSpace),
        [sourceScatterPoints, distanceColorSpace]
    );
    const paletteAxisStats = useMemo(
        () => computeAxisStats(paletteScatterPoints, distanceColorSpace),
        [paletteScatterPoints, distanceColorSpace]
    );
    const gamutTransform = useMemo(() => {
        if (!sourceAxisStats || !paletteAxisStats) {
            return null;
        }
        const translationDelta: AxisTriple = [
            paletteAxisStats.mean[0] - sourceAxisStats.mean[0],
            paletteAxisStats.mean[1] - sourceAxisStats.mean[1],
            paletteAxisStats.mean[2] - sourceAxisStats.mean[2],
        ];
        const effectiveTranslationStrength = gamutOverallStrength * gamutTranslationStrength;
        const desiredMean: AxisTriple = [
            sourceAxisStats.mean[0] + translationDelta[0] * effectiveTranslationStrength,
            sourceAxisStats.mean[1] + translationDelta[1] * effectiveTranslationStrength,
            sourceAxisStats.mean[2] + translationDelta[2] * effectiveTranslationStrength,
        ];
        const scale: AxisTriple = [0, 0, 0];
        const translationActive = Math.abs(effectiveTranslationStrength) > 0.0001;
        for (let index = 0; index < 3; index++) {
            const sourceStd = sourceAxisStats.stdDev[index];
            const targetStd = paletteAxisStats.stdDev[index];
            const ratio = sourceStd > 1e-6 ? (targetStd > 0 ? targetStd / sourceStd : 1) : 1;
            const axisStrength = gamutScaleStrength[index] * gamutOverallStrength;
            scale[index] = 1 + axisStrength * (ratio - 1);
        }
        const scalingActive = gamutScaleStrength.some((value) => Math.abs(value * gamutOverallStrength) > 0.0001);
        const baseRotationMatrix = computeRotationAlignmentMatrix(sourceAxisStats, paletteAxisStats);
        const effectiveRotationStrength = gamutRotationStrength * gamutOverallStrength;
        const rotationMatrix = baseRotationMatrix
            ? blendRotationMatrix(baseRotationMatrix, effectiveRotationStrength)
            : identityMatrix3();
        const rotationActive = !isIdentityMatrix3(rotationMatrix);
        const isActive = translationActive || scalingActive || rotationActive;
        return {
            sourceMean: sourceAxisStats.mean,
            desiredMean,
            scale,
            rotationMatrix,
            isActive,
        } satisfies GamutTransform;
    }, [
        sourceAxisStats,
        paletteAxisStats,
        gamutOverallStrength,
        gamutTranslationStrength,
        gamutRotationStrength,
        gamutScaleStrength,
    ]);
    const activeGamutTransform = useMemo(() => (sourceAdjustmentsEnabled && gamutFitEnabled ? gamutTransform : null), [sourceAdjustmentsEnabled, gamutFitEnabled, gamutTransform]);
    const gamutScatterPoints = useMemo(() => {
        if (!activeGamutTransform || !activeGamutTransform.isActive || sourceScatterPoints.length === 0) {
            return [] as ScatterPoint[];
        }
        return sourceScatterPoints.map((point) => {
            let adjusted = applyGamutTransformToColor(
                { r: point.color[0] ?? 0, g: point.color[1] ?? 0, b: point.color[2] ?? 0 },
                activeGamutTransform,
                distanceColorSpace
            );
            if (paletteNudgeActive) {
                adjusted = blendColorTowardPalette(
                    adjusted,
                    reductionPaletteEntries,
                    distanceColorSpace,
                    effectivePaletteNudgeStrength,
                    paletteMagnetParams
                );
            }
            return buildScatterPointFromRgb(adjusted, distanceColorSpace);
        });
    }, [
        sourceScatterPoints,
        activeGamutTransform,
        distanceColorSpace,
        paletteNudgeActive,
        effectivePaletteNudgeStrength,
        reductionPaletteEntries,
        paletteMagnetParams,
    ]);
    const gammaControlsDisabled = !sourceAdjustmentsEnabled;
    const gammaActive = sourceAdjustmentsEnabled && Math.abs(sourceGamma - 1) > 0.01;
    const sourceAdjustmentsActive = Boolean(
        (activeGamutTransform && activeGamutTransform.isActive) || paletteNudgeActive || gammaActive
    );
    const gamutPreviewAvailable = sourceAdjustmentsActive;
    const gamutControlsDisabled = !sourceAxisStats || !paletteAxisStats || !sourceAdjustmentsEnabled;
    const gamutSlidersDisabled = gamutControlsDisabled || !gamutFitEnabled;
    const paletteNudgeToggleDisabled = !sourceAdjustmentsEnabled || !hasReductionPalette || reductionMode !== "palette";
    const paletteNudgeControlsDisabled = paletteNudgeToggleDisabled || !paletteNudgeEnabled;
    const ditherMaskControlsDisabled = !sourceAdjustmentsEnabled;
    const paletteMaskAvailable = hasReductionPalette && reductionMode === "palette";
    const paletteMaskToggleDisabled = ditherMaskControlsDisabled || !paletteMaskAvailable;
    const paletteMaskControlsDisabled = paletteMaskToggleDisabled || !paletteMaskEnabled;
    const palettePreviewAvailable = paletteMaskAvailable && !ditherMaskControlsDisabled;
    const perceptualBlurPreviewAvailable = hasReductionPalette && reductionMode === "palette" && showReducedPreview;
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
    const handleGamutOverallStrengthChange = (nextValue: number) => {
        const clamped = Math.max(0, Math.min(1, nextValue));
        setGamutOverallStrength(clamped);
    };
    const handleGamutTranslationChange = (nextValue: number) => {
        const clamped = Math.max(0, Math.min(1, nextValue));
        setGamutTranslationStrength(clamped);
    };
    const handleGamutRotationChange = (nextValue: number) => {
        const clamped = Math.max(0, Math.min(1, nextValue));
        setGamutRotationStrength(clamped);
    };
    const handleGamutScaleSliderChange = (axisIndex: number, nextValue: number) => {
        const clamped = Math.max(0, Math.min(1, nextValue));
        setGamutScaleStrength((previous) => {
            const next: AxisTriple = [previous[0], previous[1], previous[2]];
            next[axisIndex] = clamped;
            return next;
        });
    };
    const handleSourceAdjustmentsToggle = (nextEnabled: boolean) => {
        setSourceAdjustmentsEnabled(nextEnabled);
    };
    const handlePaletteNudgeChange = (nextValue: number) => {
        const clamped = Math.max(0, Math.min(1, nextValue));
        setPaletteNudgeStrength(clamped);
        setSavedPaletteNudgeStrength(clamped);
    };
    const handlePaletteNudgeToggle = (nextEnabled: boolean) => {
        setPaletteNudgeEnabled(nextEnabled);
        if (nextEnabled) {
            setPaletteNudgeStrength(savedPaletteNudgeStrength);
            return;
        }
        setSavedPaletteNudgeStrength(paletteNudgeStrength);
        setPaletteNudgeStrength(0);
    };
    const handleGamutFitToggle = (nextEnabled: boolean) => {
        setGamutFitEnabled(nextEnabled);
        if (nextEnabled) {
            setGamutOverallStrength(savedGamutStrengths.overall);
            setGamutTranslationStrength(savedGamutStrengths.translation);
            setGamutRotationStrength(savedGamutStrengths.rotation);
            setGamutScaleStrength([...savedGamutStrengths.scale] as AxisTriple);
            return;
        }
        setSavedGamutStrengths({
            overall: gamutOverallStrength,
            translation: gamutTranslationStrength,
            rotation: gamutRotationStrength,
            scale: [...gamutScaleStrength] as AxisTriple,
        });
        setGamutOverallStrength(0);
        setGamutTranslationStrength(0);
        setGamutRotationStrength(0);
        setGamutScaleStrength([0, 0, 0]);
    };
    const handleDitheringToggle = (nextEnabled: boolean) => {
        setDitheringEnabled(nextEnabled);
        if (nextEnabled) {
            setDitherStrength(savedDitherStrength);
            return;
        }
        setSavedDitherStrength(ditherStrength);
        setDitherStrength(0);
    };

    useEffect(() => {
        if (palettePreviewAvailable) {
            return;
        }
        if (showPaletteErrorPreview) {
            setShowPaletteErrorPreview(false);
        }
        if (showPaletteAmbiguityPreview) {
            setShowPaletteAmbiguityPreview(false);
        }
        if (showPaletteModulationPreview) {
            setShowPaletteModulationPreview(false);
        }
    }, [palettePreviewAvailable, showPaletteErrorPreview, showPaletteAmbiguityPreview, showPaletteModulationPreview]);

    useEffect(() => {
        if (perceptualBlurPreviewAvailable) {
            return;
        }
        if (showPerceptualDeltaPreview) {
            setShowPerceptualDeltaPreview(false);
        }
        if (showPerceptualBlurReferencePreview) {
            setShowPerceptualBlurReferencePreview(false);
        }
        if (showPerceptualBlurTestPreview) {
            setShowPerceptualBlurTestPreview(false);
        }
    }, [
        perceptualBlurPreviewAvailable,
        showPerceptualDeltaPreview,
        showPerceptualBlurReferencePreview,
        showPerceptualBlurTestPreview,
    ]);

    const paletteModulationParams = paletteMaskAvailable
        ? {
            errorScale: ditherErrorScale,
            errorExponent: ditherErrorExponent,
            ambiguityExponent: ditherAmbiguityExponent,
            ambiguityBias: ditherAmbiguityBias,
        }
        : null;
    const paletteModulationEnabled = sourceAdjustmentsEnabled && paletteMaskEnabled && paletteMaskAvailable;

    useDitherRenderer({
        width,
        height,
        sourceType,
        gradientField,
        sourceImageData,
        sourceGamma: sourceAdjustmentsEnabled ? sourceGamma : 1,
        ditherType,
        ditherStrength,
        ditherSeed,
        proceduralDitherTile,
        reductionMode,
        reductionPaletteEntries,
        distanceColorSpace,
        errorDiffusionKernelId,
        ditherMask: {
            blurRadius: sourceAdjustmentsEnabled ? ditherMaskBlurRadius : 0,
            strength: sourceAdjustmentsEnabled ? ditherMaskStrength : 0,
            paletteModulation: paletteModulationEnabled && paletteModulationParams ? paletteModulationParams : null,
        },
        paletteModulationParams,
        paletteModulationEnabled,
        paletteNudgeStrength: effectivePaletteNudgeStrength,
        paletteMagnetParams,
        gamutTransform: activeGamutTransform,
        sourceAdjustmentsActive,
        showSourcePreview,
        showGamutPreview,
        showDitherPreview,
        showReducedPreview,
        showPaletteErrorPreview: showPaletteErrorPreview && palettePreviewAvailable,
        showPaletteAmbiguityPreview: showPaletteAmbiguityPreview && palettePreviewAvailable,
        showPaletteModulationPreview: showPaletteModulationPreview && palettePreviewAvailable,
        showPerceptualDeltaPreview: showPerceptualDeltaPreview && perceptualBlurPreviewAvailable,
        showPerceptualBlurReferencePreview: showPerceptualBlurReferencePreview && perceptualBlurPreviewAvailable,
        showPerceptualBlurTestPreview: showPerceptualBlurTestPreview && perceptualBlurPreviewAvailable,
        canvasRefs: {
            source: sourceCanvasRef,
            gamut: gamutCanvasRef,
            dither: ditherCanvasRef,
            reduced: reducedCanvasRef,
            paletteError: paletteErrorCanvasRef,
            paletteAmbiguity: paletteAmbiguityCanvasRef,
            paletteModulation: paletteModulationCanvasRef,
            perceptualDelta: perceptualDeltaCanvasRef,
            perceptualBlurReference: perceptualBlurReferenceCanvasRef,
            perceptualBlurTest: perceptualBlurTestCanvasRef,
        },
        perceptualMatchOptions: {
            blurRadiusPx: perceptualBlurRadiusPx,
            onMatchComputed: setPerceptualMatch,
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
                <div className="dither-gradient-body">
                    <div className="dither-gradient-column dither-gradient-column--settings">
                        <div className="dither-gradient-settings-grid dither-gradient-stack">


                            <section className="dither-gradient-card settings">
                                <header>
                                    <strong>Canvas & Preview</strong>
                                </header>
                                <div className="dither-controlblock">
                                    <label>
                                        <div>Canvas Width ({width}px)</div>
                                        <input
                                            type="range"
                                            min={CANVAS_SIZE_MIN}
                                            max={CANVAS_SIZE_MAX}
                                            step={CANVAS_SIZE_STEP}
                                            value={width}
                                            onChange={(event) => setWidth(event.target.valueAsNumber)}
                                        />
                                    </label>
                                    <label>
                                        <div>Canvas Height ({height}px)</div>
                                        <input
                                            type="range"
                                            min={CANVAS_SIZE_MIN}
                                            max={CANVAS_SIZE_MAX}
                                            step={CANVAS_SIZE_STEP}
                                            value={height}
                                            onChange={(event) => setHeight(event.target.valueAsNumber)}
                                        />
                                    </label>
                                    <label>
                                        <div>Preview Scale ({previewScale}×)</div>
                                        <input type="range" min={1} max={4} step={1} value={previewScale} onChange={(event) => setPreviewScale(event.target.valueAsNumber)} />
                                    </label>
                                    <label>
                                        <div>Perceptual Blur Radius ({perceptualBlurRadiusPx.toFixed(2)} px)</div>
                                        <input
                                            type="range"
                                            min={PERCEPTUAL_BLUR_MIN_PX}
                                            max={PERCEPTUAL_BLUR_MAX_PX}
                                            step={PERCEPTUAL_BLUR_STEP_PX}
                                            value={perceptualBlurRadiusPx}
                                            onChange={(event) => setPerceptualBlurRadiusPx(event.target.valueAsNumber)}
                                        />
                                    </label>
                                </div>
                            </section>




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
                                    autoPlacementMode: gradientAutoPlacementMode,
                                    onAutoPlacementModeChange: setGradientAutoPlacementMode,
                                    interpolationCurve: gradientInterpolationCurve,
                                    onInterpolationCurveChange: setGradientInterpolationCurve,
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

                            <section className="dither-gradient-card source-adjustments-card">
                                <header>
                                    <div>
                                        <strong>Source Adjustments</strong>
                                        <span>Prepare the bitmap before dithering</span>
                                    </div>
                                    <label className="source-adjustments-toggle">
                                        <input
                                            type="checkbox"
                                            checked={sourceAdjustmentsEnabled}
                                            onChange={(event) => handleSourceAdjustmentsToggle(event.target.checked)}
                                        />
                                        Enable Source Adjustments
                                    </label>
                                </header>
                                <div className="controls-panel__fields">
                                    <div className="gamut-fit-controls">
                                        <h4>
                                            Gamut Fit
                                            <input
                                                type="checkbox"
                                                checked={gamutFitEnabled}
                                                onChange={(event) => handleGamutFitToggle(event.target.checked)}
                                                disabled={gamutControlsDisabled}
                                            />
                                        </h4>
                                        <label>
                                            Overall Strength ({Math.round(gamutOverallStrength * 100)}%)
                                            <input
                                                type="range"
                                                min={0}
                                                max={1}
                                                step={0.01}
                                                value={gamutOverallStrength}
                                                onChange={(event) => handleGamutOverallStrengthChange(event.target.valueAsNumber)}
                                                disabled={gamutSlidersDisabled}
                                            />
                                        </label>
                                        <label>
                                            Translation Strength ({Math.round(gamutTranslationStrength * 100)}%)
                                            <input
                                                type="range"
                                                min={0}
                                                max={1}
                                                step={0.01}
                                                value={gamutTranslationStrength}
                                                onChange={(event) => handleGamutTranslationChange(event.target.valueAsNumber)}
                                                disabled={gamutSlidersDisabled}
                                            />
                                        </label>
                                        <label>
                                            Rotation Strength ({Math.round(gamutRotationStrength * 100)}%)
                                            <input
                                                type="range"
                                                min={0}
                                                max={1}
                                                step={0.01}
                                                value={gamutRotationStrength}
                                                onChange={(event) => handleGamutRotationChange(event.target.valueAsNumber)}
                                                disabled={gamutSlidersDisabled}
                                            />
                                        </label>
                                        <div className="gamut-fit-controls__scale-grid">
                                            {scatterAxisLabels.map((axisLabel, axisIndex) => (
                                                <label key={`${axisLabel}-${axisIndex}`}>
                                                    {axisLabel} Scaling ({Math.round(gamutScaleStrength[axisIndex] * 100)}%)
                                                    <input
                                                        type="range"
                                                        min={0}
                                                        max={1}
                                                        step={0.01}
                                                        value={gamutScaleStrength[axisIndex]}
                                                        onChange={(event) => handleGamutScaleSliderChange(axisIndex, event.target.valueAsNumber)}
                                                        disabled={gamutSlidersDisabled}
                                                    />
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="palette-nudge-controls">
                                        <h4>
                                            Palette Nudge
                                            <input
                                                type="checkbox"
                                                checked={paletteNudgeEnabled}
                                                onChange={(event) => handlePaletteNudgeToggle(event.target.checked)}
                                                disabled={paletteNudgeToggleDisabled}
                                            />

                                        </h4>
                                        {!paletteNudgeControlsDisabled && (
                                            <>
                                                <label>
                                                    Strength ({Math.round(paletteNudgeStrength * 100)}%)
                                                    <input
                                                        type="range"
                                                        min={0}
                                                        max={1}
                                                        step={0.01}
                                                        value={paletteNudgeStrength}
                                                        onChange={(event) => handlePaletteNudgeChange(event.target.valueAsNumber)}
                                                        disabled={paletteNudgeControlsDisabled}
                                                    />
                                                </label>
                                                <div className="palette-nudge-controls__grid">
                                                    <Tooltip title="How far to look for palette neighbors when establishing a pull direction. Bigger values blend more swatches; smaller values stay laser-focused on the nearest entries.">
                                                        <label>
                                                            Direction Radius ({paletteMagnetRadiusDir.toFixed(2)})
                                                            <input
                                                                type="range"
                                                                min={0.05}
                                                                max={1}
                                                                step={0.01}
                                                                value={paletteMagnetRadiusDir}
                                                                onChange={(event) => setPaletteMagnetRadiusDir(event.target.valueAsNumber)}
                                                                disabled={paletteNudgeControlsDisabled}
                                                            />
                                                        </label>
                                                    </Tooltip>
                                                    <Tooltip title="Boosts pixels that sit between multiple palette colors. Higher values wait for truly ambiguous colors; lower values tug even when the best and second-best colors are far apart.">
                                                        <label>
                                                            Ambiguity Curve ({paletteMagnetAmbiguityPower.toFixed(2)})
                                                            <input
                                                                type="range"
                                                                min={0}
                                                                max={4}
                                                                step={0.05}
                                                                value={paletteMagnetAmbiguityPower}
                                                                onChange={(event) => setPaletteMagnetAmbiguityPower(event.target.valueAsNumber)}
                                                                disabled={paletteNudgeControlsDisabled}
                                                            />
                                                        </label>
                                                    </Tooltip>
                                                    <Tooltip title="Maximum number of nearby palette entries that contribute to the pull direction. Increase to average more neighbors; decrease to favor only the very closest colors.">
                                                        <label>
                                                            Nearest Colors ({paletteMagnetNearestCount})
                                                            <input
                                                                type="range"
                                                                min={1}
                                                                max={6}
                                                                step={1}
                                                                value={paletteMagnetNearestCount}
                                                                onChange={(event) => setPaletteMagnetNearestCount(event.target.valueAsNumber)}
                                                                disabled={paletteNudgeControlsDisabled}
                                                            />
                                                        </label>
                                                    </Tooltip>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <div className="gamma-correction-controls">
                                        <h4>Gamma Correction</h4>
                                        <label>
                                            Gamma (γ: {sourceGamma.toFixed(2)})
                                            <input
                                                type="range"
                                                min={0.2}
                                                max={3}
                                                step={0.05}
                                                value={sourceGamma}
                                                onChange={(event) => setSourceGamma(event.target.valueAsNumber)}
                                                disabled={gammaControlsDisabled}
                                            />
                                        </label>
                                        <p className="dither-gradient-note">
                                            Lower values brighten, higher values darken before other adjustments.
                                        </p>
                                    </div>
                                    <div className="dither-mask-controls">
                                        <h4>Dither Masking</h4>
                                        <label>
                                            Blur Radius ({ditherMaskBlurRadius}px)
                                            <input
                                                type="range"
                                                min={0}
                                                max={10}
                                                step={1}
                                                value={ditherMaskBlurRadius}
                                                onChange={(event) => setDitherMaskBlurRadius(event.target.valueAsNumber)}
                                                disabled={ditherMaskControlsDisabled}
                                            />
                                        </label>
                                        <label>
                                            Effect Strength ({Math.round(ditherMaskStrength * 100)}%)
                                            <input
                                                type="range"
                                                min={0}
                                                max={10}
                                                step={0.05}
                                                value={ditherMaskStrength}
                                                onChange={(event) => setDitherMaskStrength(event.target.valueAsNumber)}
                                                disabled={ditherMaskControlsDisabled}
                                            />
                                        </label>
                                        <div className="palette-mask-section">
                                            <label className="palette-mask-toggle">
                                                <input
                                                    type="checkbox"
                                                    checked={paletteMaskEnabled && paletteMaskAvailable}
                                                    onChange={(event) => setPaletteMaskEnabled(event.target.checked)}
                                                    disabled={paletteMaskToggleDisabled}
                                                />
                                                Palette Error/Ambiguity Weighting
                                            </label>
                                            {!paletteMaskAvailable && (
                                                <p className="dither-gradient-note">Provide a reduction palette to enable palette-based weighting.</p>
                                            )}
                                            <label>
                                                Error Scale ({ditherErrorScale.toFixed(0)})
                                                <input
                                                    type="range"
                                                    min={5}
                                                    max={150}
                                                    step={1}
                                                    value={ditherErrorScale}
                                                    onChange={(event) => setDitherErrorScale(event.target.valueAsNumber)}
                                                    disabled={paletteMaskControlsDisabled}
                                                />
                                            </label>
                                            <label>
                                                Error Exponent (kErr: {ditherErrorExponent.toFixed(2)})
                                                <input
                                                    type="range"
                                                    min={0.1}
                                                    max={4}
                                                    step={0.05}
                                                    value={ditherErrorExponent}
                                                    onChange={(event) => setDitherErrorExponent(event.target.valueAsNumber)}
                                                    disabled={paletteMaskControlsDisabled}
                                                />
                                            </label>
                                            <label>
                                                Ambiguity Exponent (kAmb: {ditherAmbiguityExponent.toFixed(2)})
                                                <input
                                                    type="range"
                                                    min={0.1}
                                                    max={4}
                                                    step={0.05}
                                                    value={ditherAmbiguityExponent}
                                                    onChange={(event) => setDitherAmbiguityExponent(event.target.valueAsNumber)}
                                                    disabled={paletteMaskControlsDisabled}
                                                />
                                            </label>
                                            <label>
                                                Ambiguity Bias ({Math.round(ditherAmbiguityBias * 100)}% base)
                                                <input
                                                    type="range"
                                                    min={0}
                                                    max={1}
                                                    step={0.05}
                                                    value={ditherAmbiguityBias}
                                                    onChange={(event) => setDitherAmbiguityBias(event.target.valueAsNumber)}
                                                    disabled={paletteMaskControlsDisabled}
                                                />
                                            </label>
                                            <p className="dither-gradient-note">
                                                Error boosts dithering where palette distances spike; ambiguity raises strength when two colors tie.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </section>


                            <section className="dither-gradient-card settings">
                                <header>
                                    <strong>Controls</strong>
                                </header>
                                <div className="controls-section-grid">
                                    <div className="controls-panel controls-panel--wide">
                                        <div className="controls-panel__header">
                                            <h3>
                                                Dither
                                                <input
                                                    type="checkbox"
                                                    checked={ditheringEnabled}
                                                    onChange={(event) => handleDitheringToggle(event.target.checked)}
                                                />

                                            </h3>
                                        </div>
                                        <div className="controls-panel__fields">
                                            <DitherControls
                                                ditherType={ditherType}
                                                onDitherTypeChange={setDitherType}
                                                ditherStrength={ditherStrength}
                                                onDitherStrengthChange={setDitherStrength}
                                                ditherStrengthDisabled={!ditheringEnabled}
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
                                </div>
                            </section>
                        </div>
                    </div>

                    <div className="dither-gradient-column dither-gradient-column--previews">
                        <div className="dither-gradient-preview-stack dither-gradient-stack">
                            <PreviewSection
                                sourceSummaryLabel={sourceSummaryLabel}
                                ditherType={ditherType}
                                showSourcePreview={showSourcePreview}
                                onToggleSourcePreview={setShowSourcePreview}
                                showGamutPreview={showGamutPreview}
                                onToggleGamutPreview={setShowGamutPreview}
                                gamutPreviewAvailable={gamutPreviewAvailable}
                                showDitherPreview={showDitherPreview}
                                onToggleDitherPreview={setShowDitherPreview}
                                showReducedPreview={showReducedPreview}
                                onToggleReducedPreview={setShowReducedPreview}
                                showPaletteErrorPreview={showPaletteErrorPreview}
                                onTogglePaletteErrorPreview={setShowPaletteErrorPreview}
                                paletteErrorPreviewAvailable={palettePreviewAvailable}
                                showPaletteAmbiguityPreview={showPaletteAmbiguityPreview}
                                onTogglePaletteAmbiguityPreview={setShowPaletteAmbiguityPreview}
                                paletteAmbiguityPreviewAvailable={palettePreviewAvailable}
                                showPaletteModulationPreview={showPaletteModulationPreview}
                                onTogglePaletteModulationPreview={setShowPaletteModulationPreview}
                                paletteModulationPreviewAvailable={palettePreviewAvailable}
                                showPerceptualDeltaPreview={showPerceptualDeltaPreview}
                                onTogglePerceptualDeltaPreview={setShowPerceptualDeltaPreview}
                                showPerceptualBlurReferencePreview={showPerceptualBlurReferencePreview}
                                onTogglePerceptualBlurReferencePreview={setShowPerceptualBlurReferencePreview}
                                showPerceptualBlurTestPreview={showPerceptualBlurTestPreview}
                                onTogglePerceptualBlurTestPreview={setShowPerceptualBlurTestPreview}
                                perceptualBlurPreviewAvailable={perceptualBlurPreviewAvailable}
                                sourceCanvasRef={sourceCanvasRef}
                                gamutCanvasRef={gamutCanvasRef}
                                ditherCanvasRef={ditherCanvasRef}
                                reducedCanvasRef={reducedCanvasRef}
                                paletteErrorCanvasRef={paletteErrorCanvasRef}
                                paletteAmbiguityCanvasRef={paletteAmbiguityCanvasRef}
                                paletteModulationCanvasRef={paletteModulationCanvasRef}
                                perceptualDeltaCanvasRef={perceptualDeltaCanvasRef}
                                perceptualBlurReferenceCanvasRef={perceptualBlurReferenceCanvasRef}
                                perceptualBlurTestCanvasRef={perceptualBlurTestCanvasRef}
                                width={width}
                                height={height}
                                previewScale={previewScale}
                                devicePixelRatio={devicePixelRatio}
                                sourceCanvasTitle={sourceCanvasTitle}
                                sourceCanvasDescription={sourceCanvasDescription}
                                reductionMode={reductionMode}
                                reductionSwatchCount={reductionSwatches.length}
                                perceptualMatch={perceptualMatch}
                            />

                            <section className="dither-gradient-card preview color-scatter-card">
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
                                            gamutPoints={gamutScatterPoints}
                                            palettePoints={paletteScatterPoints}
                                            axisLabels={scatterAxisLabels}
                                        />
                                    </div>
                                )}
                                <p className="dither-gradient-note">
                                    Up to {MAX_SCATTER_SOURCE_POINTS.toLocaleString()} samples are plotted in the current reduction color space ({distanceColorSpace.toUpperCase()}).
                                </p>
                            </section>

                            <section className="dither-gradient-card documentation-card">
                                <MarkdownFile path="/docs/dithering.md" />
                            </section>
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}

interface SourceScatterSampleOptions {
    sourceType: SourceType;
    sourceImageData: ImageData | null;
    gradientField: GradientField;
    width: number;
    height: number;
    maxPoints: number;
    colorSpace: ColorInterpolationMode;
}

function sampleSourceScatterPoints(options: SourceScatterSampleOptions): ScatterPoint[] {
    const { sourceType, sourceImageData, gradientField, width, height, maxPoints, colorSpace } = options;
    if (sourceType === "image") {
        return sampleImageScatterPoints(sourceImageData, maxPoints, colorSpace);
    }
    if (sourceType === "gradient") {
        return sampleGradientScatterPoints(gradientField, width, height, maxPoints, colorSpace);
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
    field: GradientField,
    width: number,
    height: number,
    maxPoints: number,
    colorSpace: ColorInterpolationMode
): ScatterPoint[] {
    if (field.points.length === 0 || maxPoints <= 0 || width <= 0 || height <= 0) {
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
        const color = sampleGradientField(field, u, v);
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

type AxisStats = {
    mean: AxisTriple;
    stdDev: AxisTriple;
    samples: AxisTriple[];
};

function computeAxisStats(points: ScatterPoint[], colorSpace: ColorInterpolationMode): AxisStats | null {
    if (!points.length) {
        return null;
    }
    const axesList = points.map((point) =>
        extractAxisTriple(
            { r: point.color[0] ?? 0, g: point.color[1] ?? 0, b: point.color[2] ?? 0 },
            colorSpace
        )
    );
    const sum: AxisTriple = [0, 0, 0];
    for (const axes of axesList) {
        sum[0] += axes[0];
        sum[1] += axes[1];
        sum[2] += axes[2];
    }
    const mean: AxisTriple = [sum[0] / axesList.length, sum[1] / axesList.length, sum[2] / axesList.length];
    const variance: AxisTriple = [0, 0, 0];
    for (const axes of axesList) {
        variance[0] += Math.pow(axes[0] - mean[0], 2);
        variance[1] += Math.pow(axes[1] - mean[1], 2);
        variance[2] += Math.pow(axes[2] - mean[2], 2);
    }
    const stdDev: AxisTriple = [
        Math.sqrt(variance[0] / axesList.length),
        Math.sqrt(variance[1] / axesList.length),
        Math.sqrt(variance[2] / axesList.length),
    ];
    return { mean, stdDev, samples: axesList };
}

function computeCovarianceMatrix(samples: AxisTriple[], mean: AxisTriple): Matrix3 | null {
    if (samples.length < 3) {
        return null;
    }
    const covariance: Matrix3 = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
    ];
    for (const sample of samples) {
        const dx = sample[0] - mean[0];
        const dy = sample[1] - mean[1];
        const dz = sample[2] - mean[2];
        covariance[0][0] += dx * dx;
        covariance[0][1] += dx * dy;
        covariance[0][2] += dx * dz;
        covariance[1][0] += dy * dx;
        covariance[1][1] += dy * dy;
        covariance[1][2] += dy * dz;
        covariance[2][0] += dz * dx;
        covariance[2][1] += dz * dy;
        covariance[2][2] += dz * dz;
    }
    const divisor = samples.length;
    if (divisor === 0) {
        return null;
    }
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            covariance[row][col] /= divisor;
        }
    }
    return covariance;
}

function ensureRightHandedBasis(basis: Matrix3): Matrix3 {
    if (determinantMatrix3(basis) >= 0) {
        return basis;
    }
    const adjusted: Matrix3 = [
        [...basis[0]],
        [...basis[1]],
        [...basis[2]],
    ];
    for (let row = 0; row < 3; row++) {
        adjusted[row][2] *= -1;
    }
    return adjusted;
}

function computeRotationAlignmentMatrix(sourceStats: AxisStats, paletteStats: AxisStats): Matrix3 | null {
    const sourceCovariance = computeCovarianceMatrix(sourceStats.samples, sourceStats.mean);
    const paletteCovariance = computeCovarianceMatrix(paletteStats.samples, paletteStats.mean);
    if (!sourceCovariance || !paletteCovariance) {
        return null;
    }
    const sourceEigen = jacobiEigenDecomposition(sourceCovariance).eigenvectors;
    const paletteEigen = jacobiEigenDecomposition(paletteCovariance).eigenvectors;
    const sourceBasis = ensureRightHandedBasis(sourceEigen);
    const paletteBasis = ensureRightHandedBasis(paletteEigen);
    return multiplyMatrix3(paletteBasis, transposeMatrix3(sourceBasis));
}

