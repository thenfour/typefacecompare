import type { ScatterPoint } from "@/components/dither/ColorSpaceScatterPlot";
import { extractAxisTriple, type AxisTriple } from "@/utils/colorAxes";
import type { ColorInterpolationMode } from "@/utils/colorSpaces";

export type AxisStats = {
    mean: AxisTriple;
    stdDev: AxisTriple;
    samples: AxisTriple[];
};

const COLOR_SPACE_AXIS_LABELS: Partial<Record<ColorInterpolationMode, [string, string, string]>> = {
    rgb: ["Red", "Green", "Blue"],
    hsl: ["Hue X", "Hue Y", "Saturation"],
    hsv: ["Hue X", "Hue Y", "Value"],
    "luma-rgb": ["Luma", "Axis 2", "Axis 3"],
    "luma-lab": ["Luma", "Axis 2", "Axis 3"],
    "luma-oklab": ["Luma", "Axis 2", "Axis 3"],
    lab: ["L*", "a*", "b*"],
    oklab: ["L", "a", "b"],
    ycbcr: ["Y", "Cb", "Cr"],
    oklch: ["L", "Chroma", "Hue X"],
};

export function getColorSpaceAxisLabels(mode: ColorInterpolationMode): [string, string, string] {
    const labels = COLOR_SPACE_AXIS_LABELS[mode];
    if (labels) {
        return labels;
    }
    return ["Axis 1", "Axis 2", "Axis 3"];
}

export function computeAxisStats(points: ScatterPoint[], colorSpace: ColorInterpolationMode): AxisStats | null {
    if (!points.length) {
        return null;
    }
    const axesList = points.map((point) =>
        extractAxisTriple({ r: point.color[0] ?? 0, g: point.color[1] ?? 0, b: point.color[2] ?? 0 }, colorSpace)
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
