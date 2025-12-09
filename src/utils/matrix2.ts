export type PlaneVector = [number, number];
export type Matrix2 = [PlaneVector, PlaneVector];

export function identityMatrix2(): Matrix2 {
    return [
        [1, 0],
        [0, 1],
    ];
}

export function transposeMatrix2(matrix: Matrix2): Matrix2 {
    return [
        [matrix[0][0], matrix[1][0]],
        [matrix[0][1], matrix[1][1]],
    ];
}

export function multiplyMatrix2(a: Matrix2, b: Matrix2): Matrix2 {
    const bt = transposeMatrix2(b);
    return [
        [dot2(a[0], bt[0]), dot2(a[0], bt[1])],
        [dot2(a[1], bt[0]), dot2(a[1], bt[1])],
    ];
}

export function regularizeMatrix2(matrix: Matrix2, epsilon: number): Matrix2 {
    return [
        [matrix[0][0] + epsilon, matrix[0][1]],
        [matrix[1][0], matrix[1][1] + epsilon],
    ];
}

export function eigenDecomposition2x2(matrix: Matrix2): { eigenvalues: PlaneVector; eigenvectors: Matrix2 } {
    const a = matrix[0][0];
    const b = matrix[0][1];
    const c = matrix[1][1];
    const trace = a + c;
    const diff = a - c;
    const discriminant = Math.sqrt(Math.max(0, diff * diff + 4 * b * b));
    const lambda1 = (trace + discriminant) / 2;
    const lambda2 = (trace - discriminant) / 2;
    const vectors = buildEigenvectors2x2(a, b, c, lambda1, lambda2);
    return {
        eigenvalues: [lambda1, lambda2],
        eigenvectors: vectors,
    };
}

export function ensureRightHandedBasis2(matrix: Matrix2): Matrix2 {
    const determinant = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
    if (determinant >= 0) {
        return matrix;
    }
    return [
        [matrix[0][0], -matrix[0][1]],
        [matrix[1][0], -matrix[1][1]],
    ];
}

function buildEigenvectors2x2(a: number, b: number, c: number, lambda1: number, lambda2: number): Matrix2 {
    const hasOffDiagonal = Math.abs(b) > 1e-8;
    let v1: PlaneVector;
    let v2: PlaneVector;
    if (hasOffDiagonal) {
        v1 = normalizePlaneVector([b, lambda1 - a]);
        v2 = normalizePlaneVector([b, lambda2 - a]);
    } else if (a >= c) {
        v1 = [1, 0];
        v2 = [0, 1];
    } else {
        v1 = [0, 1];
        v2 = [1, 0];
    }
    if (Math.abs(dot2(v1, v2)) > 0.999) {
        v2 = [-v1[1], v1[0]];
    }
    return [
        [v1[0], v2[0]],
        [v1[1], v2[1]],
    ];
}

function dot2(a: PlaneVector, b: PlaneVector): number {
    return a[0] * b[0] + a[1] * b[1];
}

function normalizePlaneVector(vector: PlaneVector): PlaneVector {
    const length = Math.hypot(vector[0], vector[1]);
    if (length < 1e-9) {
        return [1, 0];
    }
    return [vector[0] / length, vector[1] / length];
}
