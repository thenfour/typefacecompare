import type { ColorInterpolationMode, RGBColor } from "@/utils/colorSpaces";
import { applyAxisTripleToRgb, extractAxisTriple, type AxisTriple } from "@/utils/colorAxes";

export type GamutTransform = {
    sourceMean: AxisTriple;
    desiredMean: AxisTriple;
    scale: AxisTriple;
    isActive: boolean;
};

export function applyGamutTransformToColor(color: RGBColor, transform: GamutTransform, mode: ColorInterpolationMode): RGBColor {
    const axes = extractAxisTriple(color, mode);
    const adjusted: AxisTriple = [
        transform.desiredMean[0] + (axes[0] - transform.sourceMean[0]) * transform.scale[0],
        transform.desiredMean[1] + (axes[1] - transform.sourceMean[1]) * transform.scale[1],
        transform.desiredMean[2] + (axes[2] - transform.sourceMean[2]) * transform.scale[2],
    ];
    return applyAxisTripleToRgb(color, adjusted, mode);
}
