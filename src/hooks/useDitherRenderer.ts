import { useEffect, type MutableRefObject } from "react";
import type { ColorInterpolationMode } from "@/utils/colorSpaces";
import { interpolateGradientColor } from "@/utils/colorSpaces";
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
import { applyReduction, clampRgb255, type ReductionPaletteEntry } from "@/utils/paletteDistance";
import type { ReductionMode, SourceType } from "@/types/dither";

export type PreviewStageKey = "source" | "dither" | "reduced";

export interface PreviewCanvasRefs {
    source: MutableRefObject<HTMLCanvasElement | null>;
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
    showSourcePreview: boolean;
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
        showSourcePreview,
        showDitherPreview,
        showReducedPreview,
        canvasRefs,
    } = options;

    useEffect(() => {
        const previewStages: PreviewStageConfig[] = [
            { key: "source", enabled: showSourcePreview, ref: canvasRefs.source },
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
                        reductionPaletteEntries,
                        distanceColorSpace,
                    );
                    ditheredColor = result.ditheredColor;
                    reducedColor = result.quantizedColor;
                } else {
                    const jittered = applyDitherJitter(base, x, y, ditherType, ditherStrength, ditherSeed, proceduralDitherTile);
                    ditheredColor = clampRgb255(jittered);
                    reducedColor = clampRgb255(
                        applyReduction(jittered, reductionMode, reductionPaletteEntries, distanceColorSpace)
                    );
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
        showSourcePreview,
        showDitherPreview,
        showReducedPreview,
        canvasRefs.source,
        canvasRefs.dither,
        canvasRefs.reduced,
    ]);
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
