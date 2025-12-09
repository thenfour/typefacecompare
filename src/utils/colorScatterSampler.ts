import type { ColorInterpolationMode } from "@/utils/colorSpaces";
import type { SourceType } from "@/types/dither";
import { sampleGradientField, type GradientField } from "@/utils/gradientField";
import type { ScatterPoint } from "@/components/dither/ColorSpaceScatterPlot";
import { rgbToCoords } from "@/utils/paletteDistance";

export type SourceScatterSampleOptions = {
    sourceType: SourceType;
    sourceImageData: ImageData | null;
    gradientField: GradientField;
    width: number;
    height: number;
    maxPoints: number;
    colorSpace: ColorInterpolationMode;
};

export function sampleSourceScatterPoints(options: SourceScatterSampleOptions): ScatterPoint[] {
    const { sourceType, sourceImageData, gradientField, width, height, maxPoints, colorSpace } = options;
    if (sourceType === "image") {
        return sampleImageScatterPoints(sourceImageData, maxPoints, colorSpace);
    }
    if (sourceType === "gradient") {
        return sampleGradientScatterPoints(gradientField, width, height, maxPoints, colorSpace);
    }
    return [];
}

export function paletteEntriesToScatterPoints(
    entries: { rgb: { r: number; g: number; b: number } }[],
    colorSpace: ColorInterpolationMode
): ScatterPoint[] {
    return entries.map((entry) => buildScatterPointFromRgb(entry.rgb, colorSpace));
}

export function buildScatterPointFromRgb(rgb: { r: number; g: number; b: number }, mode: ColorInterpolationMode): ScatterPoint {
    return {
        coords: projectRgbToColorSpace(rgb, mode),
        color: [rgb.r, rgb.g, rgb.b],
    };
}

function sampleImageScatterPoints(
    imageData: ImageData | null,
    maxPoints: number,
    colorSpace: ColorInterpolationMode
): ScatterPoint[] {
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

function projectRgbToColorSpace(rgb: { r: number; g: number; b: number }, mode: ColorInterpolationMode): [number, number, number] {
    const coords = rgbToCoords(rgb, mode);
    return [coords[0] ?? 0, coords[1] ?? 0, coords[2] ?? 0];
}
