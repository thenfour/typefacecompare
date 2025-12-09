import {
    determinantMatrix3,
    jacobiEigenDecomposition,
    multiplyMatrix3,
    transposeMatrix3,
    type Matrix3,
} from "@/utils/matrix3";
import {
    Matrix2,
    PlaneVector,
    ensureRightHandedBasis2,
    eigenDecomposition2x2,
    identityMatrix2,
    multiplyMatrix2,
    regularizeMatrix2,
    transposeMatrix2,
} from "@/utils/matrix2";
import type { AxisStats } from "@/utils/colorScatterStats";

const LIGHTNESS_STD_EPSILON = 1e-4;
const MIN_LIGHTNESS_SLOPE = 0.05;
const MAX_LIGHTNESS_SLOPE = 4;
const CHROMA_VARIANCE_EPSILON = 1e-6;
const MIN_CHROMA_SCALE = 0.5;
const MAX_CHROMA_SCALE = 2;

export function computeRotationAlignmentMatrix(
    sourceStats: AxisStats,
    paletteStats: AxisStats,
    ridgeEpsilon: number
): Matrix3 | null {
    const sourceCovariance = computeCovarianceMatrix(sourceStats.samples, sourceStats.mean);
    const paletteCovariance = computeCovarianceMatrix(paletteStats.samples, paletteStats.mean);
    if (!sourceCovariance || !paletteCovariance) {
        return null;
    }
    const sourceEigen = jacobiEigenDecomposition(regularizeCovarianceMatrix(sourceCovariance, ridgeEpsilon)).eigenvectors;
    const paletteEigen = jacobiEigenDecomposition(regularizeCovarianceMatrix(paletteCovariance, ridgeEpsilon)).eigenvectors;
    const sourceBasis = ensureRightHandedBasis(sourceEigen);
    const paletteBasis = ensureRightHandedBasis(paletteEigen);
    return multiplyMatrix3(paletteBasis, transposeMatrix3(sourceBasis));
}

export function computeLightnessSlope(sourceStats: AxisStats, paletteStats: AxisStats): number {
    const sourceStd = Math.max(sourceStats.stdDev[0], LIGHTNESS_STD_EPSILON);
    const targetStd = Math.max(paletteStats.stdDev[0], LIGHTNESS_STD_EPSILON);
    const ratio = targetStd / sourceStd;
    return clampValue(ratio, MIN_LIGHTNESS_SLOPE, MAX_LIGHTNESS_SLOPE);
}

export function computeChromaAlignmentMatrix(
    sourceStats: AxisStats,
    paletteStats: AxisStats,
    ridgeEpsilon: number
): Matrix2 {
    const alignment = buildChromaAlignmentMatrix(sourceStats, paletteStats, ridgeEpsilon);
    return alignment ?? identityMatrix2();
}

export function clampValue(value: number, min: number, max: number): number {
    if (min > max) {
        return value;
    }
    if (value < min) {
        return min;
    }
    if (value > max) {
        return max;
    }
    return value;
}

function computeCovarianceMatrix(samples: [number, number, number][], mean: [number, number, number]): Matrix3 | null {
    if (samples.length < 3) {
        return null;
    }
    const covariance: Matrix3 = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
    ];
    for (const sample of samples) {
        const dx = sample[0] - mean[0];
        const dy = sample[1] - mean[1];
        const dz = sample[2] - mean[2];
        covariance[0][0] += dx * dx;
        covariance[0][1] += dx * dy;
        covariance[0][2] += dx * dz;
        covariance[1][0] += dy * dx;
        covariance[1][1] += dy * dy;
        covariance[1][2] += dy * dz;
        covariance[2][0] += dz * dx;
        covariance[2][1] += dz * dy;
        covariance[2][2] += dz * dz;
    }
    const divisor = samples.length;
    if (divisor === 0) {
        return null;
    }
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            covariance[row][col] /= divisor;
        }
    }
    return covariance;
}

function regularizeCovarianceMatrix(matrix: Matrix3, epsilon: number): Matrix3 {
    const regularized: Matrix3 = [
        [...matrix[0]],
        [...matrix[1]],
        [...matrix[2]],
    ];
    regularized[0][0] += epsilon;
    regularized[1][1] += epsilon;
    regularized[2][2] += epsilon;
    return regularized;
}

function ensureRightHandedBasis(basis: Matrix3): Matrix3 {
    if (determinantMatrix3(basis) >= 0) {
        return basis;
    }
    const adjusted: Matrix3 = [
        [...basis[0]],
        [...basis[1]],
        [...basis[2]],
    ];
    for (let row = 0; row < 3; row++) {
        adjusted[row][2] *= -1;
    }
    return adjusted;
}

function buildChromaAlignmentMatrix(sourceStats: AxisStats, paletteStats: AxisStats, ridgeEpsilon: number): Matrix2 | null {
    const sourceCovariance = computeChromaCovarianceMatrix(sourceStats);
    const paletteCovariance = computeChromaCovarianceMatrix(paletteStats);
    if (!sourceCovariance || !paletteCovariance) {
        return null;
    }
    const sourceEigen = eigenDecomposition2x2(regularizeMatrix2(sourceCovariance, ridgeEpsilon));
    const paletteEigen = eigenDecomposition2x2(regularizeMatrix2(paletteCovariance, ridgeEpsilon));
    const sourceBasis = ensureRightHandedBasis2(sourceEigen.eigenvectors);
    const paletteBasis = ensureRightHandedBasis2(paletteEigen.eigenvectors);
    const scales: PlaneVector = [1, 1];
    for (let index = 0; index < 2; index++) {
        const sourceVariance = Math.max(sourceEigen.eigenvalues[index], CHROMA_VARIANCE_EPSILON);
        const paletteVariance = Math.max(paletteEigen.eigenvalues[index], CHROMA_VARIANCE_EPSILON);
        const ratio = paletteVariance <= 0 ? 1 : Math.sqrt(paletteVariance / sourceVariance);
        scales[index] = clampValue(ratio, MIN_CHROMA_SCALE, MAX_CHROMA_SCALE);
    }
    const scalingMatrix: Matrix2 = [
        [scales[0], 0],
        [0, scales[1]],
    ];
    return multiplyMatrix2(paletteBasis, multiplyMatrix2(scalingMatrix, transposeMatrix2(sourceBasis)));
}

function computeChromaCovarianceMatrix(stats: AxisStats): Matrix2 | null {
    if (!stats.samples.length) {
        return null;
    }
    let sumXX = 0;
    let sumXY = 0;
    let sumYY = 0;
    for (const sample of stats.samples) {
        const dx = sample[1] - stats.mean[1];
        const dy = sample[2] - stats.mean[2];
        sumXX += dx * dx;
        sumXY += dx * dy;
        sumYY += dy * dy;
    }
    const divisor = stats.samples.length;
    if (divisor === 0) {
        return null;
    }
    return [
        [sumXX / divisor, sumXY / divisor],
        [sumXY / divisor, sumYY / divisor],
    ];
}
