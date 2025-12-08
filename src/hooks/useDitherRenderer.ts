import { useEffect, type MutableRefObject } from "react";
import { vectorToRgb, type ColorInterpolationMode } from "@/utils/colorSpaces";
import { sampleGradientField, type GradientField, type GradientFieldPoint } from "@/utils/gradientField";
import { applyGamutTransformToColor, type GamutTransform } from "@/utils/gamutTransform";
import {
    applyDitherJitter,
    applyErrorDiffusionToPixel,
    advanceErrorDiffusionRow,
    createErrorDiffusionContext,
    getErrorDiffusionKernel,
    isErrorDiffusionDither,
    type DitherThresholdTile,
    type DitherType,
    type ErrorDiffusionKernelId,
} from "@/utils/dithering";
import {
    applyPaletteGravityNudge,
    applyReduction,
    clampRgb255,
    rgbToCoords,
    summarizePaletteDistances,
    type PaletteGravityParams,
    type ReductionPaletteEntry,
} from "@/utils/paletteDistance";
import {
    DEFAULT_PERCEPTUAL_BLUR_RADIUS_PX,
    computePerceptualSimilarityArtifacts,
    type PerceptualSimilarityArtifacts,
    type PerceptualSimilarityResult,
} from "@/utils/perceptualSimilarity";
import type { ReductionMode, SourceType } from "@/types/dither";

const RENDER_DEBOUNCE_MS = 24; // Keep renders responsive while preventing tight update loops.

export type PreviewStageKey =
    | "source"
    | "gamut"
    | "undithered"
    | "dither"
    | "reduced"
    | "paletteError"
    | "paletteAmbiguity"
    | "paletteModulation"
    | "perceptualDelta"
    | "perceptualBlurReference"
    | "perceptualBlurTest";

export interface PreviewCanvasRefs {
    source: MutableRefObject<HTMLCanvasElement | null>;
    gamut: MutableRefObject<HTMLCanvasElement | null>;
    undithered: MutableRefObject<HTMLCanvasElement | null>;
    dither: MutableRefObject<HTMLCanvasElement | null>;
    reduced: MutableRefObject<HTMLCanvasElement | null>;
    paletteError: MutableRefObject<HTMLCanvasElement | null>;
    paletteAmbiguity: MutableRefObject<HTMLCanvasElement | null>;
    paletteModulation: MutableRefObject<HTMLCanvasElement | null>;
    perceptualDelta: MutableRefObject<HTMLCanvasElement | null>;
    perceptualBlurReference: MutableRefObject<HTMLCanvasElement | null>;
    perceptualBlurTest: MutableRefObject<HTMLCanvasElement | null>;
}

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

interface PaletteModulationParams {
    errorScale: number;
    errorExponent: number;
    ambiguityExponent: number;
    ambiguityBias: number;
}

interface DitherMaskOptions {
    blurRadius: number;
    strength: number;
    paletteModulation: PaletteModulationParams | null;
}

interface PaletteMetricsSample {
    errorDistance: number;
    ambiguityRatio: number;
    modulationFactor: number;
}

export interface PerceptualMatchOptions {
    blurRadiusPx: number;
    onMatchComputed?: (result: PerceptualSimilarityResult | null) => void;
    onUnditheredMatchComputed?: (result: PerceptualSimilarityResult | null) => void;
}

export interface RenderMetrics {
    durationMs: number;
}

export interface UseDitherRendererOptions {
    width: number;
    height: number;
    sourceType: SourceType;
    gradientField: GradientField;
    sourceImageData: ImageData | null;
    sourceGamma: number;
    ditherType: DitherType;
    ditherStrength: number;
    ditherSeed: number;
    proceduralDitherTile: DitherThresholdTile | null;
    reductionMode: ReductionMode;
    reductionPaletteEntries: ReductionPaletteEntry[];
    distanceColorSpace: ColorInterpolationMode;
    errorDiffusionKernelId: ErrorDiffusionKernelId;
    ditherMask?: DitherMaskOptions;
    paletteModulationParams: PaletteModulationParams | null;
    paletteModulationEnabled: boolean;
    paletteGravity: PaletteGravityParams;
    gamutTransform: GamutTransform | null;
    sourceAdjustmentsActive: boolean;
    showSourcePreview: boolean;
    showGamutPreview: boolean;
    showUnditheredPreview: boolean;
    showDitherPreview: boolean;
    showReducedPreview: boolean;
    showPaletteErrorPreview: boolean;
    showPaletteAmbiguityPreview: boolean;
    showPaletteModulationPreview: boolean;
    showPerceptualDeltaPreview: boolean;
    showPerceptualBlurReferencePreview: boolean;
    showPerceptualBlurTestPreview: boolean;
    showSourcePointIndicators: boolean;
    canvasRefs: PreviewCanvasRefs;
    perceptualMatchOptions?: PerceptualMatchOptions;
    onRenderMetrics?: (metrics: RenderMetrics) => void;
}

export function useDitherRenderer(options: UseDitherRendererOptions) {
    const {
        width,
        height,
        sourceType,
        gradientField,
        sourceImageData,
        sourceGamma,
        ditherType,
        ditherStrength,
        ditherSeed,
        proceduralDitherTile,
        reductionMode,
        reductionPaletteEntries,
        distanceColorSpace,
        errorDiffusionKernelId,
        ditherMask,
        paletteModulationParams,
        paletteModulationEnabled,
        paletteGravity,
        gamutTransform,
        sourceAdjustmentsActive,
        showSourcePreview,
        showGamutPreview,
        showUnditheredPreview,
        showDitherPreview,
        showReducedPreview,
        showPaletteErrorPreview,
        showPaletteAmbiguityPreview,
        showPaletteModulationPreview,
        showPerceptualDeltaPreview,
        showPerceptualBlurReferencePreview,
        showPerceptualBlurTestPreview,
        showSourcePointIndicators,
        canvasRefs,
        perceptualMatchOptions,
        onRenderMetrics,
    } = options;

    useEffect(() => {
        const cancelRef = { cancelled: false };
        let debounceHandle: ReturnType<typeof setTimeout> | null = null;

        const notifyPerceptualMatch = (result: PerceptualSimilarityResult | null) => {
            if (cancelRef.cancelled) return;
            perceptualMatchOptions?.onMatchComputed?.(result);
        };

        const notifyUnditheredMatch = (result: PerceptualSimilarityResult | null) => {
            if (cancelRef.cancelled) return;
            perceptualMatchOptions?.onUnditheredMatchComputed?.(result);
        };

        const clearAllCanvases = () => {
            const stageConfigs: PreviewStageConfig[] = [
                { key: "source", enabled: true, ref: canvasRefs.source },
                { key: "gamut", enabled: true, ref: canvasRefs.gamut },
                { key: "undithered", enabled: true, ref: canvasRefs.undithered },
                { key: "dither", enabled: true, ref: canvasRefs.dither },
                { key: "reduced", enabled: true, ref: canvasRefs.reduced },
                { key: "paletteError", enabled: true, ref: canvasRefs.paletteError },
                { key: "paletteAmbiguity", enabled: true, ref: canvasRefs.paletteAmbiguity },
                { key: "paletteModulation", enabled: true, ref: canvasRefs.paletteModulation },
                { key: "perceptualDelta", enabled: true, ref: canvasRefs.perceptualDelta },
                { key: "perceptualBlurReference", enabled: true, ref: canvasRefs.perceptualBlurReference },
                { key: "perceptualBlurTest", enabled: true, ref: canvasRefs.perceptualBlurTest },
            ];
            stageConfigs.forEach((stage) => {
                const canvas = stage.ref.current;
                if (!canvas) return;
                const ctx = canvas.getContext("2d");
                ctx?.clearRect(0, 0, canvas.width, canvas.height);
            });
        };

        const runRender = async () => {
            const startTime = performance.now();

            const hasPaletteReduction = reductionMode === "palette" && reductionPaletteEntries.length > 0;
            const perceptualMatchEnabled = Boolean(perceptualMatchOptions && hasPaletteReduction);
            const unditheredMatchEnabled = Boolean(
                perceptualMatchOptions?.onUnditheredMatchComputed && hasPaletteReduction
            );

            const previewStages: PreviewStageConfig[] = [
                { key: "source", enabled: showSourcePreview, ref: canvasRefs.source },
                { key: "gamut", enabled: showGamutPreview && sourceAdjustmentsActive, ref: canvasRefs.gamut },
                { key: "undithered", enabled: showUnditheredPreview && hasPaletteReduction, ref: canvasRefs.undithered },
                { key: "dither", enabled: showDitherPreview, ref: canvasRefs.dither },
                { key: "reduced", enabled: showReducedPreview, ref: canvasRefs.reduced },
                { key: "paletteError", enabled: showPaletteErrorPreview, ref: canvasRefs.paletteError },
                { key: "paletteAmbiguity", enabled: showPaletteAmbiguityPreview, ref: canvasRefs.paletteAmbiguity },
                { key: "paletteModulation", enabled: showPaletteModulationPreview, ref: canvasRefs.paletteModulation },
                { key: "perceptualDelta", enabled: showPerceptualDeltaPreview && perceptualMatchEnabled, ref: canvasRefs.perceptualDelta },
                {
                    key: "perceptualBlurReference",
                    enabled: showPerceptualBlurReferencePreview && perceptualMatchEnabled,
                    ref: canvasRefs.perceptualBlurReference,
                },
                {
                    key: "perceptualBlurTest",
                    enabled: showPerceptualBlurTestPreview && perceptualMatchEnabled,
                    ref: canvasRefs.perceptualBlurTest,
                },
            ];

            const isErrorDiffusion = isErrorDiffusionDither(ditherType);
            const selectedKernel = isErrorDiffusion ? getErrorDiffusionKernel(errorDiffusionKernelId) : null;
            const errorDiffusionContext = selectedKernel ? createErrorDiffusionContext(width, height, selectedKernel) : null;

            const requiresGradientData = sourceType === "gradient";
            const requiresImageData = sourceType === "image";
            if ((requiresGradientData && gradientField.points.length === 0) || (requiresImageData && !sourceImageData)) {
                clearAllCanvases();
                notifyPerceptualMatch(null);
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
                notifyPerceptualMatch(null);
                return;
            }

            const stageMap = activeStages.reduce((acc, stage) => {
                acc[stage.key] = stage;
                return acc;
            }, {} as Partial<Record<PreviewStageKey, ActivePreviewStage>>);
            const shouldOverlaySourcePoints =
                sourceType === "gradient" &&
                showSourcePointIndicators &&
                Boolean(stageMap.source) &&
                gradientField.points.length > 0;

            const pixelCount = width * height;
            const capturePaletteErrorPreview = Boolean(stageMap.paletteError);
            const capturePaletteAmbiguityPreview = Boolean(stageMap.paletteAmbiguity);
            const capturePaletteModulationPreview = Boolean(stageMap.paletteModulation);
            const paletteErrorValues = capturePaletteErrorPreview ? new Float32Array(pixelCount) : null;
            const paletteAmbiguityValues = capturePaletteAmbiguityPreview ? new Float32Array(pixelCount) : null;
            const paletteModulationValues = capturePaletteModulationPreview ? new Float32Array(pixelCount) : null;
            let paletteErrorMin = Infinity;
            let paletteErrorMax = -Infinity;
            let paletteAmbiguityMin = Infinity;
            let paletteAmbiguityMax = -Infinity;
            let paletteModulationMin = Infinity;
            let paletteModulationMax = -Infinity;
            const baseColorBuffer = new Float32Array(pixelCount * 3);
            const needsReferenceBuffer = perceptualMatchEnabled || unditheredMatchEnabled;
            let perceptualReferenceBuffer: Float32Array | null = null;
            let perceptualTestBuffer: Float32Array | null = null;
            let perceptualUnditheredBuffer: Float32Array | null = null;
            for (let y = 0; y < height; y++) {
                const v = height === 1 ? 0 : y / (height - 1);
                for (let x = 0; x < width; x++) {
                    const u = width === 1 ? 0 : x / (width - 1);
                    const base = sampleSourceColor(sourceType, gradientField, u, v, x, y, sourceImageData);
                    const pixelIndex = y * width + x;
                    const baseOffset = pixelIndex * 3;
                    baseColorBuffer[baseOffset] = base.r;
                    baseColorBuffer[baseOffset + 1] = base.g;
                    baseColorBuffer[baseOffset + 2] = base.b;
                }
            }

            const maskBuffer = buildDitherMaskBuffer(
                baseColorBuffer,
                width,
                height,
                ditherMask?.blurRadius ?? 0,
                ditherMask?.strength ?? 0
            );
            if (needsReferenceBuffer) {
                perceptualReferenceBuffer = new Float32Array(pixelCount * 3);
            }
            if (perceptualMatchEnabled) {
                perceptualTestBuffer = new Float32Array(pixelCount * 3);
            }
            if (unditheredMatchEnabled) {
                perceptualUnditheredBuffer = new Float32Array(pixelCount * 3);
            }

            const paletteMetricsParams = hasPaletteReduction ? paletteModulationParams : null;
            const paletteModulationConfig =
                paletteMetricsParams && paletteModulationEnabled && ditherMask?.paletteModulation
                    ? paletteMetricsParams
                    : null;
            const shouldCollectPaletteMetrics = Boolean(
                paletteMetricsParams &&
                (paletteModulationConfig || showPaletteErrorPreview || showPaletteAmbiguityPreview || showPaletteModulationPreview)
            );

            const shouldApplyGamut = Boolean(gamutTransform && gamutTransform.isActive);
            const shouldApplyGamma = Math.abs(sourceGamma - 1) > 0.001 && sourceAdjustmentsActive;
            const paletteGravityActive =
                hasPaletteReduction &&
                (paletteGravity.lightnessStrength > 0 || paletteGravity.chromaStrength > 0);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const pixelIndex = y * width + x;
                    const baseOffset = pixelIndex * 3;
                    const base = {
                        r: baseColorBuffer[baseOffset],
                        g: baseColorBuffer[baseOffset + 1],
                        b: baseColorBuffer[baseOffset + 2],
                    };
                    const gammaAdjustedColor = shouldApplyGamma ? applyGammaCorrection(base, sourceGamma) : base;
                    const gamutAdjustedColor = shouldApplyGamut && gamutTransform
                        ? applyGamutTransformToColor(gammaAdjustedColor, gamutTransform)
                        : gammaAdjustedColor;
                    const pipelineSourceBase = shouldApplyGamut ? gamutAdjustedColor : gammaAdjustedColor;
                    const pipelineSource = paletteGravityActive
                        ? applyPaletteGravityNudge(
                            pipelineSourceBase,
                            reductionPaletteEntries,
                            paletteGravity
                        )
                        : pipelineSourceBase;
                    const sourceColor = clampRgb255(base);
                    const sourceAdjustedColor = clampRgb255(pipelineSource);
                    const gamutPreviewColor = sourceAdjustmentsActive ? sourceAdjustedColor : sourceColor;
                    const maskFactor = maskBuffer ? maskBuffer[pixelIndex] : 1;
                    let paletteMetrics: PaletteMetricsSample | null = null;
                    if (shouldCollectPaletteMetrics && paletteMetricsParams) {
                        paletteMetrics = evaluatePaletteMetrics(
                            pipelineSource,
                            reductionPaletteEntries,
                            distanceColorSpace,
                            paletteMetricsParams
                        );
                    }
                    const paletteFactor = paletteModulationConfig && paletteMetrics
                        ? paletteMetrics.modulationFactor
                        : 1;
                    const effectiveDitherStrength = ditherStrength * maskFactor * paletteFactor;
                    let ditheredColor: { r: number; g: number; b: number };
                    let reducedColor: { r: number; g: number; b: number };
                    const shouldCaptureUndithered = hasPaletteReduction &&
                        (Boolean(stageMap.undithered) || Boolean(perceptualUnditheredBuffer));
                    const unditheredColor = shouldCaptureUndithered
                        ? clampRgb255(
                            applyReduction(pipelineSource, reductionMode, reductionPaletteEntries, distanceColorSpace)
                        )
                        : null;

                    if (errorDiffusionContext) {
                        const result = applyErrorDiffusionToPixel(
                            pipelineSource,
                            x,
                            y,
                            errorDiffusionContext,
                            effectiveDitherStrength,
                            reductionMode,
                            reductionPaletteEntries,
                            distanceColorSpace,
                        );
                        ditheredColor = result.ditheredColor;
                        reducedColor = result.quantizedColor;
                    } else {
                        const jittered = applyDitherJitter(
                            pipelineSource,
                            x,
                            y,
                            ditherType,
                            effectiveDitherStrength,
                            ditherSeed,
                            proceduralDitherTile
                        );
                        ditheredColor = clampRgb255(jittered);
                        reducedColor = clampRgb255(
                            applyReduction(jittered, reductionMode, reductionPaletteEntries, distanceColorSpace)
                        );
                    }

                    const offset = pixelIndex * 4;
                    if (stageMap.source) {
                        writePixel(stageMap.source.imageData.data, offset, sourceColor);
                    }
                    if (stageMap.gamut) {
                        writePixel(stageMap.gamut.imageData.data, offset, gamutPreviewColor);
                    }
                    if (stageMap.undithered && unditheredColor) {
                        writePixel(stageMap.undithered.imageData.data, offset, unditheredColor);
                    }
                    if (stageMap.dither) {
                        writePixel(stageMap.dither.imageData.data, offset, ditheredColor);
                    }
                    if (stageMap.reduced) {
                        writePixel(stageMap.reduced.imageData.data, offset, reducedColor);
                    }
                    if (perceptualReferenceBuffer) {
                        writeColorToFloatBuffer(perceptualReferenceBuffer, pixelIndex, sourceAdjustedColor);
                    }
                    if (perceptualTestBuffer) {
                        writeColorToFloatBuffer(perceptualTestBuffer, pixelIndex, reducedColor);
                    }
                    if (perceptualUnditheredBuffer && unditheredColor) {
                        writeColorToFloatBuffer(perceptualUnditheredBuffer, pixelIndex, unditheredColor);
                    }
                    if (paletteMetrics) {
                        if (paletteErrorValues) {
                            const value = paletteMetrics.errorDistance;
                            paletteErrorValues[pixelIndex] = value;
                            if (value < paletteErrorMin) {
                                paletteErrorMin = value;
                            }
                            if (value > paletteErrorMax) {
                                paletteErrorMax = value;
                            }
                        }
                        if (paletteAmbiguityValues) {
                            const value = paletteMetrics.ambiguityRatio;
                            paletteAmbiguityValues[pixelIndex] = value;
                            if (value < paletteAmbiguityMin) {
                                paletteAmbiguityMin = value;
                            }
                            if (value > paletteAmbiguityMax) {
                                paletteAmbiguityMax = value;
                            }
                        }
                        if (paletteModulationValues) {
                            const value = paletteMetrics.modulationFactor;
                            paletteModulationValues[pixelIndex] = value;
                            if (value < paletteModulationMin) {
                                paletteModulationMin = value;
                            }
                            if (value > paletteModulationMax) {
                                paletteModulationMax = value;
                            }
                        }
                    }
                }
                if (errorDiffusionContext) {
                    advanceErrorDiffusionRow(errorDiffusionContext);
                }
            }

            if (paletteErrorValues && stageMap.paletteError) {
                writeMetricToImageData(
                    paletteErrorValues,
                    paletteErrorMin,
                    paletteErrorMax,
                    stageMap.paletteError.imageData.data,
                    true
                );
            }
            if (paletteAmbiguityValues && stageMap.paletteAmbiguity) {
                writeMetricToImageData(
                    paletteAmbiguityValues,
                    paletteAmbiguityMin,
                    paletteAmbiguityMax,
                    stageMap.paletteAmbiguity.imageData.data,
                    true
                );
            }
            if (paletteModulationValues && stageMap.paletteModulation) {
                writeMetricToImageData(
                    paletteModulationValues,
                    paletteModulationMin,
                    paletteModulationMax,
                    stageMap.paletteModulation.imageData.data,
                    true
                );
            }

            if (perceptualMatchEnabled && perceptualReferenceBuffer && perceptualTestBuffer) {
                const blurRadiusPx = perceptualMatchOptions?.blurRadiusPx ?? DEFAULT_PERCEPTUAL_BLUR_RADIUS_PX;
                const artifacts: PerceptualSimilarityArtifacts = computePerceptualSimilarityArtifacts({
                    referenceRgbBuffer: perceptualReferenceBuffer,
                    testRgbBuffer: perceptualTestBuffer,
                    width,
                    height,
                    blurRadiusPx,
                    distanceSpace: "oklab",
                });
                notifyPerceptualMatch(artifacts.result);
                if (stageMap.perceptualBlurReference && artifacts.blurredReferenceBuffer) {
                    writeFloatRgbBufferToImageData(
                        artifacts.blurredReferenceBuffer,
                        stageMap.perceptualBlurReference.imageData.data
                    );
                }
                if (stageMap.perceptualBlurTest && artifacts.blurredTestBuffer) {
                    writeFloatRgbBufferToImageData(artifacts.blurredTestBuffer, stageMap.perceptualBlurTest.imageData.data);
                }
                if (
                    stageMap.perceptualDelta &&
                    artifacts.blurredReferenceBuffer &&
                    artifacts.blurredTestBuffer
                ) {
                    writeFloatRgbDeltaToImageData(
                        artifacts.blurredReferenceBuffer,
                        artifacts.blurredTestBuffer,
                        stageMap.perceptualDelta.imageData.data
                    );
                }
            } else {
                notifyPerceptualMatch(null);
            }

            if (unditheredMatchEnabled && perceptualReferenceBuffer && perceptualUnditheredBuffer) {
                const blurRadiusPx = perceptualMatchOptions?.blurRadiusPx ?? DEFAULT_PERCEPTUAL_BLUR_RADIUS_PX;
                const unditheredArtifacts: PerceptualSimilarityArtifacts = computePerceptualSimilarityArtifacts({
                    referenceRgbBuffer: perceptualReferenceBuffer,
                    testRgbBuffer: perceptualUnditheredBuffer,
                    width,
                    height,
                    blurRadiusPx,
                    distanceSpace: "oklab",
                });
                notifyUnditheredMatch(unditheredArtifacts.result);
            } else {
                notifyUnditheredMatch(null);
            }

            activeStages.forEach((stage) => {
                stage.ctx.putImageData(stage.imageData, 0, 0);
                if (shouldOverlaySourcePoints && stage.key === "source") {
                    drawGradientPointIndicators(stage.ctx, gradientField, width, height);
                }
            });

            if (!cancelRef.cancelled) {
                onRenderMetrics?.({ durationMs: performance.now() - startTime });
            }
        };

        const scheduleRender = () => {
            if (debounceHandle) {
                clearTimeout(debounceHandle);
            }
            debounceHandle = setTimeout(() => {
                debounceHandle = null;
                void runRender();
            }, RENDER_DEBOUNCE_MS);
        };

        scheduleRender();

        return () => {
            cancelRef.cancelled = true;
            if (debounceHandle) {
                clearTimeout(debounceHandle);
            }
        };
    }, [
        width,
        height,
        sourceType,
        gradientField,
        sourceImageData,
        sourceGamma,
        ditherType,
        ditherStrength,
        ditherSeed,
        proceduralDitherTile,
        reductionMode,
        reductionPaletteEntries,
        distanceColorSpace,
        errorDiffusionKernelId,
        ditherMask?.blurRadius,
        ditherMask?.strength,
        ditherMask?.paletteModulation,
        paletteModulationParams?.errorScale,
        paletteModulationParams?.errorExponent,
        paletteModulationParams?.ambiguityExponent,
        paletteModulationParams?.ambiguityBias,
        paletteModulationParams,
        paletteModulationEnabled,
        paletteGravity.softness,
        paletteGravity.lightnessStrength,
        paletteGravity.chromaStrength,
        paletteGravity.ambiguityBoost,
        sourceAdjustmentsActive,
        showSourcePreview,
        showGamutPreview,
        showUnditheredPreview,
        showDitherPreview,
        showReducedPreview,
        showPaletteErrorPreview,
        showPaletteAmbiguityPreview,
        showPaletteModulationPreview,
        showPerceptualDeltaPreview,
        showPerceptualBlurReferencePreview,
        showPerceptualBlurTestPreview,
        showSourcePointIndicators,
        gamutTransform,
        canvasRefs.source,
        canvasRefs.gamut,
        canvasRefs.undithered,
        canvasRefs.dither,
        canvasRefs.reduced,
        canvasRefs.paletteError,
        canvasRefs.paletteAmbiguity,
        canvasRefs.paletteModulation,
        canvasRefs.perceptualDelta,
        canvasRefs.perceptualBlurReference,
        canvasRefs.perceptualBlurTest,
        perceptualMatchOptions?.blurRadiusPx,
        perceptualMatchOptions?.onMatchComputed,
        perceptualMatchOptions?.onUnditheredMatchComputed,
        onRenderMetrics,
    ]);
}

function drawGradientPointIndicators(
    ctx: CanvasRenderingContext2D,
    field: GradientField,
    width: number,
    height: number
) {
    // if (!field.points.length) {
    //     return;
    // }
    // const indicatorRadius = Math.max(2, Math.min(width, height) * 0.02);
    // const strokeWidth = 1;// Math.max(1, Math.min(indicatorRadius * 0.8, 3));
    // ctx.save();
    // ctx.lineWidth = strokeWidth;
    // ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
    // for (const point of field.points) {
    //     const clampedX = clamp01(point.position.x);
    //     const clampedY = clamp01(point.position.y);
    //     const x = clampedX * (width - 1) + 0.5;
    //     const y = clampedY * (height - 1) + 0.5;
    //     ctx.fillStyle = resolvePointFillColor(point, field.mode);
    //     ctx.beginPath();
    //     ctx.arc(x, y, indicatorRadius, 0, Math.PI * 2);
    //     ctx.fill();
    //     ctx.stroke();
    // }
    // ctx.restore();
}

function resolvePointFillColor(point: GradientFieldPoint, mode: ColorInterpolationMode): string {
    const hex = point.hex?.trim();
    // if (hex && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) {
    //     return hex;
    // }
    const rgbUnit = vectorToRgb(point.vector, mode);
    const rgb255 = clampRgb255({
        r: rgbUnit.r * 255,
        g: rgbUnit.g * 255,
        b: rgbUnit.b * 255,
    });
    return `rgb(${rgb255.r}, ${rgb255.g}, ${rgb255.b})`;
}

function sampleSourceColor(
    sourceType: SourceType,
    gradientField: GradientField,
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
    return sampleGradientField(gradientField, u, v);
}

function writePixel(buffer: Uint8ClampedArray, offset: number, color: { r: number; g: number; b: number }) {
    buffer[offset] = color.r;
    buffer[offset + 1] = color.g;
    buffer[offset + 2] = color.b;
    buffer[offset + 3] = 255;
}

function writeColorToFloatBuffer(buffer: Float32Array, pixelIndex: number, color: { r: number; g: number; b: number }) {
    const baseIndex = pixelIndex * 3;
    buffer[baseIndex] = color.r;
    buffer[baseIndex + 1] = color.g;
    buffer[baseIndex + 2] = color.b;
}

function writeFloatRgbBufferToImageData(buffer: Float32Array, imageData: Uint8ClampedArray) {
    const pixelCount = Math.min(buffer.length / 3, imageData.length / 4);
    for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
        const baseIndex = pixelIndex * 3;
        const color = {
            r: buffer[baseIndex] ?? 0,
            g: buffer[baseIndex + 1] ?? 0,
            b: buffer[baseIndex + 2] ?? 0,
        };
        writePixel(imageData, pixelIndex * 4, clampRgb255(color));
    }
}

function writeFloatRgbDeltaToImageData(
    referenceBuffer: Float32Array,
    testBuffer: Float32Array,
    imageData: Uint8ClampedArray
) {
    const pixelCount = Math.min(
        referenceBuffer.length / 3,
        testBuffer.length / 3,
        imageData.length / 4
    );
    for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
        const baseIndex = pixelIndex * 3;
        const deltaColor = {
            r: Math.abs((referenceBuffer[baseIndex] ?? 0) - (testBuffer[baseIndex] ?? 0)),
            g: Math.abs((referenceBuffer[baseIndex + 1] ?? 0) - (testBuffer[baseIndex + 1] ?? 0)),
            b: Math.abs((referenceBuffer[baseIndex + 2] ?? 0) - (testBuffer[baseIndex + 2] ?? 0)),
        };
        writePixel(imageData, pixelIndex * 4, clampRgb255(deltaColor));
    }
}

function buildDitherMaskBuffer(
    baseColorBuffer: Float32Array,
    width: number,
    height: number,
    blurRadius: number,
    strength: number
): Float32Array | null {
    const normalizedStrength = strength;
    const radius = Math.max(0, Math.round(blurRadius));
    if (normalizedStrength === 0 || radius === 0) {
        return null;
    }
    const pixelCount = width * height;
    const luminance = new Float32Array(pixelCount);
    for (let index = 0; index < pixelCount; index++) {
        const offset = index * 3;
        const r = baseColorBuffer[offset];
        const g = baseColorBuffer[offset + 1];
        const b = baseColorBuffer[offset + 2];
        luminance[index] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    const blurred = blurFloatArray(luminance, width, height, radius);
    const mask = new Float32Array(pixelCount);
    for (let index = 0; index < pixelCount; index++) {
        const sharpness = Math.abs(luminance[index] - blurred[index]);
        const normalizedSharpness = Math.min(1, sharpness / 255);
        const attenuation = 1 - normalizedStrength * normalizedSharpness;
        mask[index] = Math.max(0, Math.min(1, attenuation));
    }
    return mask;
}

function evaluatePaletteMetrics(
    rgb: { r: number; g: number; b: number },
    palette: ReductionPaletteEntry[],
    distanceMode: ColorInterpolationMode,
    params: PaletteModulationParams
): PaletteMetricsSample {
    const coords = rgbToCoords(rgb, distanceMode);
    const summary = summarizePaletteDistances(coords, palette);
    const errorDistance = summary?.nearestDistance ?? 0;
    const errorScale = Math.max(params.errorScale, 1e-6);
    const scaledError = clamp01(errorDistance / errorScale);
    const errorExponent = Math.max(params.errorExponent, 0);
    const errorFactor = errorExponent === 0 ? 1 : Math.pow(scaledError, errorExponent);

    let ambiguityRatio = 0;
    const secondNearest = summary?.secondNearestDistance ?? Infinity;
    if (Number.isFinite(secondNearest) && secondNearest > 1e-6) {
        const diff = Math.abs(secondNearest - errorDistance);
        ambiguityRatio = secondNearest > 0 ? clamp01(1 - diff / secondNearest) : 0;
    }
    const ambExponent = Math.max(params.ambiguityExponent, 0);
    const shapedAmbiguity = ambExponent === 0 ? 1 : Math.pow(ambiguityRatio, ambExponent);
    const bias = clamp01(params.ambiguityBias ?? 0.5);
    const ambiguityFactor = bias + (1 - bias) * shapedAmbiguity;
    const modulationFactor = clamp01(errorFactor * ambiguityFactor);
    return {
        errorDistance,
        ambiguityRatio,
        modulationFactor,
    } satisfies PaletteMetricsSample;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function applyGammaCorrection(color: { r: number; g: number; b: number }, gamma: number) {
    if (!Number.isFinite(gamma) || Math.abs(gamma - 1) < 0.001) {
        return color;
    }
    const exponent = Math.max(0.05, Math.min(5, gamma));
    const remapChannel = (channel: number) => {
        const normalized = clamp01(channel / 255);
        return Math.round(Math.pow(normalized, exponent) * 255);
    };
    return clampRgb255({
        r: remapChannel(color.r),
        g: remapChannel(color.g),
        b: remapChannel(color.b),
    });
}

function writeMetricToImageData(
    values: Float32Array,
    minValue: number,
    maxValue: number,
    imageData: Uint8ClampedArray,
    normalizeRange: boolean
) {
    const length = values.length;
    const range = maxValue - minValue;
    const hasRange = Number.isFinite(range) && range > 1e-9;
    for (let index = 0; index < length; index++) {
        const normalized = normalizeRange && hasRange
            ? clamp01((values[index] - minValue) / range)
            : clamp01(values[index]);
        const channel = Math.round(normalized * 255);
        const offset = index * 4;
        imageData[offset] = channel;
        imageData[offset + 1] = channel;
        imageData[offset + 2] = channel;
        imageData[offset + 3] = 255;
    }
}

function blurFloatArray(values: Float32Array, width: number, height: number, radius: number) {
    if (radius <= 0) {
        return values.slice();
    }
    const kernelSize = radius * 2 + 1;
    const temp = new Float32Array(values.length);
    const output = new Float32Array(values.length);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sum = 0;
            for (let offset = -radius; offset <= radius; offset++) {
                const sampleX = Math.min(width - 1, Math.max(0, x + offset));
                sum += values[y * width + sampleX];
            }
            temp[y * width + x] = sum / kernelSize;
        }
    }

    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            let sum = 0;
            for (let offset = -radius; offset <= radius; offset++) {
                const sampleY = Math.min(height - 1, Math.max(0, y + offset));
                sum += temp[sampleY * width + x];
            }
            output[y * width + x] = sum / kernelSize;
        }
    }

    return output;
}
