import type { ColorInterpolationMode, RGBColor } from "@/utils/colorSpaces";
import { applyAxisTripleToRgb, extractAxisTriple, type AxisTriple } from "@/utils/colorAxes";
import { blendRotationMatrix, multiplyMatrix3Vector, type Matrix3 } from "@/utils/matrix3";

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
    rotationMatrix: Matrix3;
    scale: AxisTriple;
    translation: AxisTriple;
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
        const blendedRotation = blendRotationMatrix(transform.rotationMatrix, clampedStrength);
        const rotated = multiplyMatrix3Vector(blendedRotation, axes);
        const scaled: AxisTriple = [
            rotated[0] * (1 + clampedStrength * (transform.scale[0] - 1)),
            rotated[1] * (1 + clampedStrength * (transform.scale[1] - 1)),
            rotated[2] * (1 + clampedStrength * (transform.scale[2] - 1)),
        ];
        const translated: AxisTriple = [
            scaled[0] + clampedStrength * transform.translation[0],
            scaled[1] + clampedStrength * transform.translation[1],
            scaled[2] + clampedStrength * transform.translation[2],
        ];
        return applyAxisTripleToRgb(color, translated, transform.colorSpace);
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
