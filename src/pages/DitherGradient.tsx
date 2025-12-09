import Head from "next/head";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parsePaletteDefinition } from "../utils/paletteDefinition";
import { ColorInterpolationMode, rgb255ToVector, rgbUnitTo255 } from "../utils/colorSpaces";
import { hexToRgb } from "../utils/color";
import { useDevicePixelRatio } from "../hooks/useDevicePixelRatio";
import "../styles/DitherGradient.css";
import "../styles/PaletteDefinition.css";
import { fetchDitherSourceExamples, type ExampleImage } from "@/data/ditherSourceExamples";
import { useImageSource } from "@/hooks/useImageSource";
import { useDitherRenderer } from "@/hooks/useDitherRenderer";
import type { ReductionMode, SourceType } from "@/types/dither";
import {
    applyPaletteGravityNudge,
    DEFAULT_PALETTE_GRAVITY_PARAMS,
    rgbToCoords,
    type PaletteGravityParams,
    type ReductionPaletteEntry,
} from "@/utils/paletteDistance";
import { PaletteEditorCard } from "@/components/dither/PaletteEditorCard";
import { SourceControlsCard } from "@/components/dither/SourceControlsCard";
import { DitherControls } from "@/components/dither/DitherControls";
import { ReductionControls } from "@/components/dither/ReductionControls";
import { PreviewSection } from "@/components/dither/PreviewSection";
import { Tooltip } from "@/components/Tooltip";
import { ColorSpaceScatterPlot, type ScatterPoint } from "@/components/dither/ColorSpaceScatterPlot";
import { type AxisTriple } from "@/utils/colorAxes";
import {
    buildScatterPointFromRgb,
    paletteEntriesToScatterPoints,
    sampleSourceScatterPoints,
} from "@/utils/colorScatterSampler";
import { computeAxisStats, getColorSpaceAxisLabels } from "@/utils/colorScatterStats";
import {
    clampValue,
    computeChromaAlignmentMatrix,
    computeLightnessSlope,
    computeRotationAlignmentMatrix,
} from "@/utils/colorAlignment";
import { applyGamutTransformToColor, type GamutTransform } from "@/utils/gamutTransform";
import { CANVAS_SIZE_MAX, CANVAS_SIZE_MIN, CANVAS_SIZE_STEP, type CanvasSize } from "@/utils/canvasSizing";
import {
    buildGradientField,
    resolveGradientControlPoints,
    type GradientAutoPlacementMode,
} from "@/utils/gradientField";
import {
    blendRotationMatrix,
    identityMatrix3,
    isIdentityMatrix3,
    type Matrix3,
} from "@/utils/matrix3";
import { type Matrix2 } from "@/utils/matrix2";
import {
    buildProceduralDitherTile,
    DEFAULT_ERROR_DIFFUSION_KERNEL,
    ErrorDiffusionKernelId,
    DitherThresholdTile,
    DitherType,
    isErrorDiffusionDither,
    usesSeededDither,
} from "../utils/dithering";
import { DEFAULT_PERCEPTUAL_BLUR_RADIUS_PX, type PerceptualSimilarityResult } from "@/utils/perceptualSimilarity";
import { MarkdownFile } from "@/components/MarkdownFile";
const MAX_SCATTER_SOURCE_POINTS = 4000;
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
        label: "4Corner",
        value: `#f00
#0f0
#00f
#0`,
    },
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
        label: "RGB Primary Halftone",
        value: `
#00f
#0f0
#0ff
#f00
#f0f
#ff0
#fff
-----
#008
#080
#088
#800
#808
#880
#888
-----
0
`
    },
    {
        label: "RGB 3-level",
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

type SourcePointIndicator = {
    id: string;
    x: number;
    y: number;
    color: string;
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
    const [errorDiffusionKernelId, setErrorDiffusionKernelId] = useState<ErrorDiffusionKernelId>(DEFAULT_ERROR_DIFFUSION_KERNEL);
    const [reductionMode, setReductionMode] = useState<ReductionMode>("palette");
    const [distanceColorSpace, setDistanceColorSpace] = useState<ColorInterpolationMode>("oklab");
    const [width, setWidth] = useState(160);
    const [height, setHeight] = useState(160);
    const [previewScale, setPreviewScale] = useState(2);
    const [perceptualBlurRadiusPx, setPerceptualBlurRadiusPx] = useState<number>(DEFAULT_PERCEPTUAL_BLUR_RADIUS_PX);
    const [perceptualMatch, setPerceptualMatch] = useState<PerceptualSimilarityResult | null>(null);
    const [unditheredPerceptualMatch, setUnditheredPerceptualMatch] = useState<PerceptualSimilarityResult | null>(null);
    const [ditherMaskBlurRadius, setDitherMaskBlurRadius] = useState(4);
    const [ditherMaskStrength, setDitherMaskStrength] = useState(3);
    const [sourceGamma, setSourceGamma] = useState(1);
    const [paletteMaskEnabled, setPaletteMaskEnabled] = useState(false);
    const [ditherErrorScale, setDitherErrorScale] = useState(5);
    const [ditherErrorExponent, setDitherErrorExponent] = useState(0.1);
    const [ditherAmbiguityExponent, setDitherAmbiguityExponent] = useState(0.1);
    const [ditherAmbiguityBias, setDitherAmbiguityBias] = useState(0.5);
    const [sourceAdjustmentsEnabled, setSourceAdjustmentsEnabled] = useState(true);
    const [gamutOverallStrength, setGamutOverallStrength] = useState(0.3);
    const [gamutTranslationStrength, setGamutTranslationStrength] = useState(1);
    const [gamutRotationStrength, setGamutRotationStrength] = useState(0.0);
    const [gamutScaleStrength, setGamutScaleStrength] = useState<AxisTriple>([1, 1, 1]);
    const [gamutFitEnabled, setGamutFitEnabled] = useState(false);
    const [covarianceFitEnabled, setCovarianceFitEnabled] = useState(true);
    const [covarianceFitStrength, setCovarianceFitStrength] = useState(0.5);
    const [covarianceRidgeStrength, setCovarianceRidgeStrength] = useState(0.0025);
    const [savedGamutStrengths, setSavedGamutStrengths] = useState<GamutStrengthSnapshot>(() => ({
        overall: gamutOverallStrength,
        translation: gamutTranslationStrength,
        rotation: gamutRotationStrength,
        scale: [...gamutScaleStrength] as AxisTriple,
    }));
    const [paletteNudgeEnabled, setPaletteNudgeEnabled] = useState(false);
    const [paletteGravityLightnessStrength, setPaletteGravityLightnessStrength] = useState(
        DEFAULT_PALETTE_GRAVITY_PARAMS.lightnessStrength
    );
    const [paletteGravityChromaStrength, setPaletteGravityChromaStrength] = useState(
        DEFAULT_PALETTE_GRAVITY_PARAMS.chromaStrength
    );
    const [paletteGravitySoftness, setPaletteGravitySoftness] = useState(DEFAULT_PALETTE_GRAVITY_PARAMS.softness);
    const [paletteGravityAmbiguityBoost, setPaletteGravityAmbiguityBoost] = useState(
        DEFAULT_PALETTE_GRAVITY_PARAMS.ambiguityBoost
    );
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
    const [showUnditheredPreview, setShowUnditheredPreview] = useState(false);
    const [showReducedPreview, setShowReducedPreview] = useState(true);
    const [showPaletteErrorPreview, setShowPaletteErrorPreview] = useState(false);
    const [showPaletteAmbiguityPreview, setShowPaletteAmbiguityPreview] = useState(false);
    const [showPaletteModulationPreview, setShowPaletteModulationPreview] = useState(false);
    const [showPerceptualDeltaPreview, setShowPerceptualDeltaPreview] = useState(false);
    const [showPerceptualBlurReferencePreview, setShowPerceptualBlurReferencePreview] = useState(false);
    const [showPerceptualBlurTestPreview, setShowPerceptualBlurTestPreview] = useState(false);
    const [showGradientPointIndicators, setShowGradientPointIndicators] = useState(true);
    const devicePixelRatio = useDevicePixelRatio();

    const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const gamutCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const ditherCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const unditheredCanvasRef = useRef<HTMLCanvasElement | null>(null);
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
    const paletteGravityParams = useMemo<PaletteGravityParams>(() => {
        const baseParams: PaletteGravityParams = {
            softness: paletteGravitySoftness,
            lightnessStrength: paletteGravityLightnessStrength,
            chromaStrength: paletteGravityChromaStrength,
            ambiguityBoost: paletteGravityAmbiguityBoost,
        };
        if (
            !sourceAdjustmentsEnabled ||
            !paletteNudgeEnabled ||
            !hasReductionPalette ||
            reductionMode !== "palette"
        ) {
            return {
                ...baseParams,
                lightnessStrength: 0,
                chromaStrength: 0,
                ambiguityBoost: baseParams.ambiguityBoost,
            } satisfies PaletteGravityParams;
        }
        return baseParams;
    }, [
        paletteGravitySoftness,
        paletteGravityLightnessStrength,
        paletteGravityChromaStrength,
        paletteGravityAmbiguityBoost,
        sourceAdjustmentsEnabled,
        paletteNudgeEnabled,
        hasReductionPalette,
        reductionMode,
    ]);
    const paletteNudgeActive =
        (paletteGravityParams.lightnessStrength > 0 || paletteGravityParams.chromaStrength > 0) &&
        hasReductionPalette &&
        reductionMode === "palette";
    const reductionPaletteEntries = useMemo<ReductionPaletteEntry[]>(
        () =>
            reductionSwatches.map((swatch) => {
                const rgb255 = rgbUnitTo255(hexToRgb(swatch.hex));
                const oklab = rgb255ToVector(rgb255, "oklab") as { L: number; a: number; b: number };
                const oklch = rgb255ToVector(rgb255, "oklch") as { L: number; C: number; h: number };
                return {
                    rgb: rgb255,
                    coords: rgbToCoords(rgb255, distanceColorSpace),
                    oklab,
                    oklch,
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
    const sourceOklabStats = useMemo(() => computeAxisStats(sourceScatterPoints, "oklab"), [sourceScatterPoints]);
    const paletteOklabStats = useMemo(() => computeAxisStats(paletteScatterPoints, "oklab"), [paletteScatterPoints]);
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
        const baseRotationMatrix = computeRotationAlignmentMatrix(sourceAxisStats, paletteAxisStats, covarianceRidgeStrength);
        const effectiveRotationStrength = gamutRotationStrength * gamutOverallStrength;
        const rotationMatrix = baseRotationMatrix
            ? blendRotationMatrix(baseRotationMatrix, effectiveRotationStrength)
            : identityMatrix3();
        const rotationActive = !isIdentityMatrix3(rotationMatrix);
        const isActive = translationActive || scalingActive || rotationActive;
        return {
            mode: "legacy",
            colorSpace: distanceColorSpace,
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
        distanceColorSpace,
    ]);
    const covarianceGamutTransform = useMemo(() => {
        if (!sourceOklabStats || !paletteOklabStats) {
            return null;
        }
        const lightnessSlope = computeLightnessSlope(sourceOklabStats, paletteOklabStats);
        const chromaMatrix = computeChromaAlignmentMatrix(sourceOklabStats, paletteOklabStats, covarianceRidgeStrength);
        const linearMatrix: Matrix3 = [
            [lightnessSlope, 0, 0],
            [0, chromaMatrix[0][0], chromaMatrix[0][1]],
            [0, chromaMatrix[1][0], chromaMatrix[1][1]],
        ];
        const isActive = covarianceFitStrength > 0.0001;
        return {
            mode: "affine",
            colorSpace: "oklab" as const,
            sourceMean: sourceOklabStats.mean,
            targetMean: paletteOklabStats.mean,
            linearMatrix,
            strength: covarianceFitStrength,
            isActive,
        } satisfies GamutTransform;
    }, [sourceOklabStats, paletteOklabStats, covarianceFitStrength, covarianceRidgeStrength]);
    const covarianceFitAvailable = Boolean(sourceOklabStats && paletteOklabStats);
    const covarianceFitControlsDisabled = !sourceAdjustmentsEnabled || !covarianceFitAvailable;
    const activeGamutTransform = useMemo(() => {
        if (!sourceAdjustmentsEnabled) {
            return null;
        }
        if (covarianceFitEnabled && covarianceFitAvailable && covarianceGamutTransform?.isActive) {
            return covarianceGamutTransform;
        }
        if (gamutFitEnabled && gamutTransform?.isActive) {
            return gamutTransform;
        }
        return null;
    }, [
        sourceAdjustmentsEnabled,
        covarianceFitEnabled,
        covarianceFitAvailable,
        covarianceGamutTransform,
        gamutFitEnabled,
        gamutTransform,
    ]);
    const gamutScatterPoints = useMemo(() => {
        if (!activeGamutTransform || !activeGamutTransform.isActive || sourceScatterPoints.length === 0) {
            return [] as ScatterPoint[];
        }
        return sourceScatterPoints.map((point) => {
            let adjusted = applyGamutTransformToColor(
                { r: point.color[0] ?? 0, g: point.color[1] ?? 0, b: point.color[2] ?? 0 },
                activeGamutTransform
            );
            if (paletteNudgeActive) {
                adjusted = applyPaletteGravityNudge(adjusted, reductionPaletteEntries, paletteGravityParams);
            }
            return buildScatterPointFromRgb(adjusted, distanceColorSpace);
        });
    }, [
        sourceScatterPoints,
        activeGamutTransform,
        distanceColorSpace,
        paletteNudgeActive,
        reductionPaletteEntries,
        paletteGravityParams,
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
        () => buildProceduralDitherTile(ditherType, ditherSeed),
        [ditherType, ditherSeed]
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
    const handlePaletteNudgeToggle = (nextEnabled: boolean) => {
        setPaletteNudgeEnabled(nextEnabled);
    };
    const handlePaletteLightnessStrengthChange = (nextValue: number) => {
        const clamped = Math.max(0, Math.min(1, nextValue));
        setPaletteGravityLightnessStrength(clamped);
    };
    const handlePaletteChromaStrengthChange = (nextValue: number) => {
        const clamped = Math.max(0, Math.min(1, nextValue));
        setPaletteGravityChromaStrength(clamped);
    };
    const handlePaletteSoftnessChange = (nextValue: number) => {
        const clamped = clampValue(nextValue, 0.005, 0.25);
        setPaletteGravitySoftness(clamped);
    };
    const handlePaletteAmbiguityBoostChange = (nextValue: number) => {
        const clamped = clampValue(nextValue, 0, 2);
        setPaletteGravityAmbiguityBoost(clamped);
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

    useEffect(() => {
        if (sourceType !== "gradient" && showGradientPointIndicators) {
            setShowGradientPointIndicators(false);
        }
    }, [sourceType, showGradientPointIndicators]);

    const paletteModulationParams = useMemo(() => {
        if (!paletteMaskAvailable) {
            return null;
        }
        return {
            errorScale: ditherErrorScale,
            errorExponent: ditherErrorExponent,
            ambiguityExponent: ditherAmbiguityExponent,
            ambiguityBias: ditherAmbiguityBias,
        };
    }, [
        paletteMaskAvailable,
        ditherErrorScale,
        ditherErrorExponent,
        ditherAmbiguityExponent,
        ditherAmbiguityBias,
    ]);
    const paletteModulationEnabled = sourceAdjustmentsEnabled && paletteMaskEnabled && paletteMaskAvailable;
    const sourcePointIndicators = useMemo(() => {
        if (sourceType !== "gradient") {
            return [] as SourcePointIndicator[];
        }
        return gradientField.points.map((point, index) => ({
            id: `gradient-point-${index}`,
            x: clamp01(point.position.x),
            y: clamp01(point.position.y),
            color: point.hex,
        }));
    }, [sourceType, gradientField]);
    const sourcePointIndicatorsAvailable = sourcePointIndicators.length > 0;

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
        paletteGravity: paletteGravityParams,
        gamutTransform: activeGamutTransform,
        sourceAdjustmentsActive,
        showSourcePreview,
        showGamutPreview,
        showUnditheredPreview,
        showDitherPreview,
        showReducedPreview,
        showPaletteErrorPreview: showPaletteErrorPreview && palettePreviewAvailable,
        showPaletteAmbiguityPreview: showPaletteAmbiguityPreview && palettePreviewAvailable,
        showPaletteModulationPreview: showPaletteModulationPreview && palettePreviewAvailable,
        showPerceptualDeltaPreview: showPerceptualDeltaPreview && perceptualBlurPreviewAvailable,
        showPerceptualBlurReferencePreview: showPerceptualBlurReferencePreview && perceptualBlurPreviewAvailable,
        showPerceptualBlurTestPreview: showPerceptualBlurTestPreview && perceptualBlurPreviewAvailable,
        showSourcePointIndicators: sourcePointIndicatorsAvailable && showGradientPointIndicators,
        canvasRefs: {
            source: sourceCanvasRef,
            gamut: gamutCanvasRef,
            undithered: unditheredCanvasRef,
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
            onUnditheredMatchComputed: setUnditheredPerceptualMatch,
        },
    });
    const seedEnabled = usesSeededDither(ditherType);
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
                                title="Target Palette"
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
                                    <label className="source-adjustments-toggle">
                                        <strong>Source Adjustments</strong>
                                        <input
                                            type="checkbox"
                                            checked={sourceAdjustmentsEnabled}
                                            onChange={(event) => handleSourceAdjustmentsToggle(event.target.checked)}
                                        />
                                    </label>
                                </header>
                                <div className="controls-panel__fields">
                                    <div className="gamma-correction-controls">
                                        <h4>Gamma Adjust</h4>
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

                                    <div className="gamut-fit-controls" style={{ display: "none" }}>
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
                                    <div className="gamut-fit-controls">
                                        <div className="gamut-fit-controls__covariance">
                                            <h4>
                                                Covariance Fit
                                                <input
                                                    type="checkbox"
                                                    checked={covarianceFitEnabled}
                                                    onChange={(event) => setCovarianceFitEnabled(event.target.checked)}
                                                    disabled={covarianceFitControlsDisabled}
                                                />
                                            </h4>
                                            <label>
                                                Strength ({Math.round(covarianceFitStrength * 100)}%)
                                                <input
                                                    type="range"
                                                    min={0}
                                                    max={1}
                                                    step={0.01}
                                                    value={covarianceFitStrength}
                                                    onChange={(event) => setCovarianceFitStrength(event.target.valueAsNumber)}
                                                    disabled={covarianceFitControlsDisabled || !covarianceFitEnabled}
                                                />
                                            </label>
                                            <label>
                                                Ridge Noise ({(covarianceRidgeStrength * 1000).toFixed(1)}×10⁻³)
                                                <input
                                                    type="range"
                                                    min={0}
                                                    max={0.02}
                                                    step={0.0005}
                                                    value={covarianceRidgeStrength}
                                                    onChange={(event) => setCovarianceRidgeStrength(event.target.valueAsNumber)}
                                                    disabled={covarianceFitControlsDisabled || !covarianceFitEnabled}
                                                />
                                            </label>
                                            {!covarianceFitAvailable && (
                                                <p className="gamut-fit-controls__hint">Requires source + palette samples.</p>
                                            )}
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
                                                    Lightness Strength ({Math.round(paletteGravityLightnessStrength * 100)}%)
                                                    <input
                                                        type="range"
                                                        min={0}
                                                        max={1}
                                                        step={0.01}
                                                        value={paletteGravityLightnessStrength}
                                                        onChange={(event) => handlePaletteLightnessStrengthChange(event.target.valueAsNumber)}
                                                        disabled={paletteNudgeControlsDisabled}
                                                    />
                                                </label>
                                                <label>
                                                    Chroma Strength ({Math.round(paletteGravityChromaStrength * 100)}%)
                                                    <input
                                                        type="range"
                                                        min={0}
                                                        max={1}
                                                        step={0.01}
                                                        value={paletteGravityChromaStrength}
                                                        onChange={(event) => handlePaletteChromaStrengthChange(event.target.valueAsNumber)}
                                                        disabled={paletteNudgeControlsDisabled}
                                                    />
                                                </label>
                                                <Tooltip title="τ softens the gravity field. Tiny values hug the closest palette entries; larger values allow distant colors to influence the centroid.">
                                                    <label>
                                                        Softness (τ: {paletteGravitySoftness.toFixed(3)})
                                                        <input
                                                            type="range"
                                                            min={0.005}
                                                            max={0.25}
                                                            step={0.0025}
                                                            value={paletteGravitySoftness}
                                                            onChange={(event) => handlePaletteSoftnessChange(event.target.valueAsNumber)}
                                                            disabled={paletteNudgeControlsDisabled}
                                                        />
                                                    </label>
                                                </Tooltip>
                                                <Tooltip title="Blends your strengths toward 100% as ambiguity rises. 0% keeps the base strength; crank above 100% to reach full pull even when ambiguity is subtle.">
                                                    <label>
                                                        Ambiguity Boost ({Math.round(paletteGravityAmbiguityBoost * 100)}%)
                                                        <input
                                                            type="range"
                                                            min={0}
                                                            max={2}
                                                            step={0.05}
                                                            value={paletteGravityAmbiguityBoost}
                                                            onChange={(event) => handlePaletteAmbiguityBoostChange(event.target.valueAsNumber)}
                                                            disabled={paletteNudgeControlsDisabled}
                                                        />
                                                    </label>
                                                </Tooltip>
                                                <p className="dither-gradient-note">
                                                    Raise lightness or chroma strength (γ) to pull those channels toward the OKLCh-weighted palette centroid; soften τ to keep the pull gentle. Combine a low base strength with a high ambiguity boost when you only want the nudge to fire for uncertain pixels.
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </section>


                            <section className="dither-gradient-card settings">
                                <header>
                                    <strong>Dither strength modulation</strong>
                                </header>
                                <div>
                                    <div className="dither-mask-controls">
                                        <h4>Attenuation around edges</h4>
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
                                    </div>
                                    <div className="palette-mask-section">
                                        <label className="palette-mask-toggle">
                                            <h4>Palette Error/Ambiguity Weighting</h4>
                                            <input
                                                type="checkbox"
                                                checked={paletteMaskEnabled && paletteMaskAvailable}
                                                onChange={(event) => setPaletteMaskEnabled(event.target.checked)}
                                                disabled={paletteMaskToggleDisabled}
                                            />
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
                                showSourcePointIndicators={showGradientPointIndicators}
                                onToggleSourcePointIndicators={setShowGradientPointIndicators}
                                sourcePointIndicatorAvailable={sourcePointIndicatorsAvailable}
                                sourcePointIndicators={sourcePointIndicators}
                                showGamutPreview={showGamutPreview}
                                onToggleGamutPreview={setShowGamutPreview}
                                gamutPreviewAvailable={gamutPreviewAvailable}
                                showDitherPreview={showDitherPreview}
                                onToggleDitherPreview={setShowDitherPreview}
                                showUnditheredPreview={showUnditheredPreview}
                                onToggleUnditheredPreview={setShowUnditheredPreview}
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
                                unditheredCanvasRef={unditheredCanvasRef}
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
                                unditheredPerceptualMatch={unditheredPerceptualMatch}
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

function clamp01(value: number | null | undefined) {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return 0;
    }
    return Math.min(1, Math.max(0, value));
}

