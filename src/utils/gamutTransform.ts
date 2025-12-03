import type { ColorInterpolationMode, RGBColor } from "@/utils/colorSpaces";
import { applyAxisTripleToRgb, extractAxisTriple, type AxisTriple } from "@/utils/colorAxes";
import { multiplyMatrix3Vector, type Matrix3 } from "@/utils/matrix3";

export type GamutTransform = {
    sourceMean: AxisTriple;
    desiredMean: AxisTriple;
    scale: AxisTriple;
    rotationMatrix: Matrix3;
    isActive: boolean;
};

export function applyGamutTransformToColor(color: RGBColor, transform: GamutTransform, mode: ColorInterpolationMode): RGBColor {
    const axes = extractAxisTriple(color, mode);
    const centered: AxisTriple = [
        axes[0] - transform.sourceMean[0],
        axes[1] - transform.sourceMean[1],
        axes[2] - transform.sourceMean[2],
    ];
    const rotated = multiplyMatrix3Vector(transform.rotationMatrix, centered);
    const adjusted: AxisTriple = [
        transform.desiredMean[0] + rotated[0] * transform.scale[0],
        transform.desiredMean[1] + rotated[1] * transform.scale[1],
        transform.desiredMean[2] + rotated[2] * transform.scale[2],
    ];
    return applyAxisTripleToRgb(color, adjusted, mode);
}
