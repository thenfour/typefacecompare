import type { AxisTriple } from "@/utils/colorAxes";

export type Matrix3 = [AxisTriple, AxisTriple, AxisTriple];

const EPSILON = 1e-10;

export function identityMatrix3(): Matrix3 {
    return [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
    ];
}

export function cloneMatrix3(matrix: Matrix3): Matrix3 {
    return matrix.map((row) => [...row]) as Matrix3;
}

export function transposeMatrix3(matrix: Matrix3): Matrix3 {
    return [
        [matrix[0][0], matrix[1][0], matrix[2][0]],
        [matrix[0][1], matrix[1][1], matrix[2][1]],
        [matrix[0][2], matrix[1][2], matrix[2][2]],
    ];
}

export function multiplyMatrix3(a: Matrix3, b: Matrix3): Matrix3 {
    const bt = transposeMatrix3(b);
    return [
        [dot3(a[0], bt[0]), dot3(a[0], bt[1]), dot3(a[0], bt[2])],
        [dot3(a[1], bt[0]), dot3(a[1], bt[1]), dot3(a[1], bt[2])],
        [dot3(a[2], bt[0]), dot3(a[2], bt[1]), dot3(a[2], bt[2])],
    ];
}

export function multiplyMatrix3Vector(matrix: Matrix3, vector: AxisTriple): AxisTriple {
    return [dot3(matrix[0], vector), dot3(matrix[1], vector), dot3(matrix[2], vector)];
}

export function determinantMatrix3(matrix: Matrix3): number {
    return (
        matrix[0][0] * (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1]) -
        matrix[0][1] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0]) +
        matrix[0][2] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0])
    );
}

export function isIdentityMatrix3(matrix: Matrix3, tolerance = 1e-5): boolean {
    return (
        Math.abs(matrix[0][0] - 1) < tolerance &&
        Math.abs(matrix[1][1] - 1) < tolerance &&
        Math.abs(matrix[2][2] - 1) < tolerance &&
        Math.abs(matrix[0][1]) < tolerance &&
        Math.abs(matrix[0][2]) < tolerance &&
        Math.abs(matrix[1][0]) < tolerance &&
        Math.abs(matrix[1][2]) < tolerance &&
        Math.abs(matrix[2][0]) < tolerance &&
        Math.abs(matrix[2][1]) < tolerance
    );
}

export function normalizeVector(vector: AxisTriple): AxisTriple {
    const length = Math.hypot(vector[0], vector[1], vector[2]);
    if (length < EPSILON) {
        return [0, 0, 0];
    }
    return [vector[0] / length, vector[1] / length, vector[2] / length];
}

export function buildAxisAngleRotation(axis: AxisTriple, angle: number): Matrix3 {
    const normalizedAxis = normalizeVector(axis);
    const [x, y, z] = normalizedAxis;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const t = 1 - c;
    if (Math.abs(angle) < EPSILON || (x === 0 && y === 0 && z === 0)) {
        return identityMatrix3();
    }
    return [
        [t * x * x + c, t * x * y - s * z, t * x * z + s * y],
        [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
        [t * x * z - s * y, t * y * z + s * x, t * z * z + c],
    ];
}

export function matrixToAxisAngle(matrix: Matrix3): { axis: AxisTriple; angle: number } {
    const trace = matrix[0][0] + matrix[1][1] + matrix[2][2];
    let angle = Math.acos(Math.max(-1, Math.min(1, (trace - 1) / 2)));
    if (isNaN(angle)) {
        angle = 0;
    }
    if (angle < EPSILON) {
        return { axis: [0, 0, 1], angle: 0 };
    }
    const denom = 2 * Math.sin(angle);
    if (Math.abs(denom) < EPSILON) {
        return { axis: [1, 0, 0], angle };
    }
    const axis: AxisTriple = [
        (matrix[2][1] - matrix[1][2]) / denom,
        (matrix[0][2] - matrix[2][0]) / denom,
        (matrix[1][0] - matrix[0][1]) / denom,
    ];
    return { axis: normalizeVector(axis), angle };
}

export function blendRotationMatrix(matrix: Matrix3, strength: number): Matrix3 {
    const clamped = Math.max(0, Math.min(1, strength));
    if (clamped <= EPSILON || isIdentityMatrix3(matrix)) {
        return identityMatrix3();
    }
    const { axis, angle } = matrixToAxisAngle(matrix);
    return buildAxisAngleRotation(axis, angle * clamped);
}

export function jacobiEigenDecomposition(matrix: Matrix3, maxSweeps = 15): { eigenvalues: AxisTriple; eigenvectors: Matrix3 } {
    let a = cloneMatrix3(matrix);
    let v = identityMatrix3();
    for (let sweep = 0; sweep < maxSweeps; sweep++) {
        const { p, q, value } = maxOffDiagonal(a);
        if (Math.abs(value) < EPSILON) {
            break;
        }
        const theta = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]);
        const c = Math.cos(theta);
        const s = Math.sin(theta);
        a = applyJacobiRotation(a, p, q, c, s);
        v = applyJacobiRotation(v, p, q, c, s, true);
    }
    const eigenvalues: AxisTriple = [a[0][0], a[1][1], a[2][2]];
    return sortEigenpairs(eigenvalues, v);
}

function dot3(a: AxisTriple, b: AxisTriple) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function maxOffDiagonal(matrix: Matrix3) {
    let maxValue = 0;
    let p = 0;
    let q = 1;
    for (let i = 0; i < 3; i++) {
        for (let j = i + 1; j < 3; j++) {
            const value = Math.abs(matrix[i][j]);
            if (value > maxValue) {
                maxValue = value;
                p = i;
                q = j;
            }
        }
    }
    return { p, q, value: matrix[p][q] };
}

function applyJacobiRotation(matrix: Matrix3, p: number, q: number, c: number, s: number, operateColumns = false): Matrix3 {
    const result = cloneMatrix3(matrix);
    if (operateColumns) {
        for (let i = 0; i < 3; i++) {
            const ip = result[i][p];
            const iq = result[i][q];
            result[i][p] = c * ip - s * iq;
            result[i][q] = s * ip + c * iq;
        }
        return result;
    }
    const app = matrix[p][p];
    const aqq = matrix[q][q];
    const apq = matrix[p][q];
    result[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
    result[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
    result[p][q] = 0;
    result[q][p] = 0;
    for (let j = 0; j < 3; j++) {
        if (j !== p && j !== q) {
            const apj = matrix[p][j];
            const aqj = matrix[q][j];
            result[p][j] = c * apj - s * aqj;
            result[j][p] = result[p][j];
            result[q][j] = s * apj + c * aqj;
            result[j][q] = result[q][j];
        }
    }
    return result;
}

function sortEigenpairs(eigenvalues: AxisTriple, eigenvectors: Matrix3) {
    const pairs = eigenvalues.map((value, index) => ({ value, vector: [eigenvectors[0][index], eigenvectors[1][index], eigenvectors[2][index]] as AxisTriple }));
    pairs.sort((a, b) => b.value - a.value);
    const sortedValues: AxisTriple = [pairs[0].value, pairs[1].value, pairs[2].value];
    const sortedVectors: Matrix3 = [
        [pairs[0].vector[0], pairs[1].vector[0], pairs[2].vector[0]],
        [pairs[0].vector[1], pairs[1].vector[1], pairs[2].vector[1]],
        [pairs[0].vector[2], pairs[1].vector[2], pairs[2].vector[2]],
    ];
    return { eigenvalues: sortedValues, eigenvectors: sortedVectors };
}
