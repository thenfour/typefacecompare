import type { ColorInterpolationMode, RGBColor } from "@/utils/colorSpaces";
import { applyAxisTripleToRgb, extractAxisTriple, type AxisTriple } from "@/utils/colorAxes";
import { multiplyMatrix3Vector, type Matrix3 } from "@/utils/matrix3";

export type LegacyGamutTransform = {
    mode: "legacy";
    colorSpace: ColorInterpolationMode;
    sourceMean: AxisTriple;
    desiredMean: AxisTriple;
    scale: AxisTriple;
    rotationMatrix: Matrix3;
    isActive: boolean;
};

export type AffineGamutTransform = {
    mode: "affine";
    colorSpace: ColorInterpolationMode;
    sourceMean: AxisTriple;
    targetMean: AxisTriple;
    linearMatrix: Matrix3;
    strength: number;
    isActive: boolean;
};

export type GamutTransform = LegacyGamutTransform | AffineGamutTransform;

export function applyGamutTransformToColor(color: RGBColor, transform: GamutTransform): RGBColor {
    if (!transform.isActive) {
        return color;
    }
    if (transform.mode === "affine") {
        const axes = extractAxisTriple(color, transform.colorSpace);
        const clampedStrength = Math.max(0, Math.min(1, transform.strength));
        const centered: AxisTriple = [
            axes[0] - transform.sourceMean[0],
            axes[1] - transform.sourceMean[1],
            axes[2] - transform.sourceMean[2],
        ];
        const linearResult = multiplyMatrix3Vector(transform.linearMatrix, centered);
        const transformed: AxisTriple = [
            transform.targetMean[0] + linearResult[0],
            transform.targetMean[1] + linearResult[1],
            transform.targetMean[2] + linearResult[2],
        ];
        const blended: AxisTriple = [
            axes[0] + clampedStrength * (transformed[0] - axes[0]),
            axes[1] + clampedStrength * (transformed[1] - axes[1]),
            axes[2] + clampedStrength * (transformed[2] - axes[2]),
        ];
        return applyAxisTripleToRgb(color, blended, transform.colorSpace);
    }
    const axes = extractAxisTriple(color, transform.colorSpace);
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
    return applyAxisTripleToRgb(color, adjusted, transform.colorSpace);
}
