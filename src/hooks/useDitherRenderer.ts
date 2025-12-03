import { useEffect, type MutableRefObject } from "react";
import type { ColorInterpolationMode } from "@/utils/colorSpaces";
import { interpolateGradientColor } from "@/utils/colorSpaces";
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
import { applyReduction, clampRgb255, quantizeToPalette, type ReductionPaletteEntry } from "@/utils/paletteDistance";
import type { ReductionMode, SourceType } from "@/types/dither";

export type PreviewStageKey = "source" | "gamut" | "dither" | "reduced";

export interface PreviewCanvasRefs {
    source: MutableRefObject<HTMLCanvasElement | null>;
    gamut: MutableRefObject<HTMLCanvasElement | null>;
    dither: MutableRefObject<HTMLCanvasElement | null>;
    reduced: MutableRefObject<HTMLCanvasElement | null>;
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

export interface UseDitherRendererOptions {
    width: number;
    height: number;
    sourceType: SourceType;
    derivedCornerHexes: string[];
    interpolationMode: ColorInterpolationMode;
    sourceImageData: ImageData | null;
    ditherType: DitherType;
    ditherStrength: number;
    ditherSeed: number;
    proceduralDitherTile: DitherThresholdTile | null;
    reductionMode: ReductionMode;
    reductionPaletteEntries: ReductionPaletteEntry[];
    distanceColorSpace: ColorInterpolationMode;
    errorDiffusionKernelId: ErrorDiffusionKernelId;
    ditherMask?: {
        blurRadius: number;
        strength: number;
    };
    paletteNudgeStrength: number;
    gamutTransform: GamutTransform | null;
    showSourcePreview: boolean;
    showGamutPreview: boolean;
    showDitherPreview: boolean;
    showReducedPreview: boolean;
    canvasRefs: PreviewCanvasRefs;
}

export function useDitherRenderer(options: UseDitherRendererOptions) {
    const {
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
        ditherMask,
        paletteNudgeStrength,
        gamutTransform,
        showSourcePreview,
        showGamutPreview,
        showDitherPreview,
        showReducedPreview,
        canvasRefs,
    } = options;

    useEffect(() => {
        const previewStages: PreviewStageConfig[] = [
            { key: "source", enabled: showSourcePreview, ref: canvasRefs.source },
            { key: "gamut", enabled: showGamutPreview && Boolean(gamutTransform), ref: canvasRefs.gamut },
            { key: "dither", enabled: showDitherPreview, ref: canvasRefs.dither },
            { key: "reduced", enabled: showReducedPreview, ref: canvasRefs.reduced },
        ];

        const isErrorDiffusion = isErrorDiffusionDither(ditherType);
        const selectedKernel = isErrorDiffusion ? getErrorDiffusionKernel(errorDiffusionKernelId) : null;
        const errorDiffusionContext = selectedKernel ? createErrorDiffusionContext(width, height, selectedKernel) : null;

        const requiresGradientData = sourceType === "gradient";
        const requiresImageData = sourceType === "image";
        if ((requiresGradientData && derivedCornerHexes.length < 4) || (requiresImageData && !sourceImageData)) {
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

        const pixelCount = width * height;
        const baseColorBuffer = new Float32Array(pixelCount * 3);
        for (let y = 0; y < height; y++) {
            const v = height === 1 ? 0 : y / (height - 1);
            for (let x = 0; x < width; x++) {
                const u = width === 1 ? 0 : x / (width - 1);
                const base = sampleSourceColor(
                    sourceType,
                    derivedCornerHexes,
                    interpolationMode,
                    u,
                    v,
                    x,
                    y,
                    sourceImageData
                );
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

        const shouldApplyGamut = Boolean(gamutTransform && gamutTransform.isActive);
        const shouldApplyPaletteNudge =
            paletteNudgeStrength > 0 && reductionMode === "palette" && reductionPaletteEntries.length > 0;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pixelIndex = y * width + x;
                const baseOffset = pixelIndex * 3;
                const base = {
                    r: baseColorBuffer[baseOffset],
                    g: baseColorBuffer[baseOffset + 1],
                    b: baseColorBuffer[baseOffset + 2],
                };
                const gamutAdjustedColor = shouldApplyGamut && gamutTransform
                    ? applyGamutTransformToColor(base, gamutTransform, distanceColorSpace)
                    : base;
                const pipelineSourceBase = shouldApplyGamut ? gamutAdjustedColor : base;
                const pipelineSource = shouldApplyPaletteNudge
                    ? applyPaletteNudge(pipelineSourceBase, reductionPaletteEntries, distanceColorSpace, paletteNudgeStrength)
                    : pipelineSourceBase;
                const sourceColor = clampRgb255(base);
                const gamutPreviewColor = clampRgb255(gamutTransform ? gamutAdjustedColor : base);
                const maskFactor = maskBuffer ? maskBuffer[pixelIndex] : 1;
                const effectiveDitherStrength = ditherStrength * maskFactor;
                let ditheredColor: { r: number; g: number; b: number };
                let reducedColor: { r: number; g: number; b: number };

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
                    const jittered = applyDitherJitter(pipelineSource, x, y, ditherType, effectiveDitherStrength, ditherSeed, proceduralDitherTile);
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
                if (stageMap.dither) {
                    writePixel(stageMap.dither.imageData.data, offset, ditheredColor);
                }
                if (stageMap.reduced) {
                    writePixel(stageMap.reduced.imageData.data, offset, reducedColor);
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
        ditherMask?.blurRadius,
        ditherMask?.strength,
        paletteNudgeStrength,
        showSourcePreview,
        showGamutPreview,
        showDitherPreview,
        showReducedPreview,
        gamutTransform,
        canvasRefs.source,
        canvasRefs.gamut,
        canvasRefs.dither,
        canvasRefs.reduced,
    ]);
}

function applyPaletteNudge(
    color: { r: number; g: number; b: number },
    palette: ReductionPaletteEntry[],
    distanceMode: ColorInterpolationMode,
    strength: number
) {
    if (strength <= 0 || palette.length === 0) {
        return color;
    }
    const target = quantizeToPalette(color, palette, distanceMode);
    const clampedStrength = Math.max(0, Math.min(1, strength));
    return {
        r: color.r + (target.r - color.r) * clampedStrength,
        g: color.g + (target.g - color.g) * clampedStrength,
        b: color.b + (target.b - color.b) * clampedStrength,
    };
}

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

function buildDitherMaskBuffer(
    baseColorBuffer: Float32Array,
    width: number,
    height: number,
    blurRadius: number,
    strength: number
): Float32Array | null {
    // don't clamp yet; we clamp later anyway and this lets us exaggerate the effect.
    const normalizedStrength = strength;//Math.max(0, Math.min(1, strength));
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
