import { rgb255ToVector, type ColorInterpolationMode } from "./colorSpaces";

export interface PerceptualSimilarityInput {
    referenceRgbBuffer: Float32Array;
    testRgbBuffer: Float32Array;
    width: number;
    height: number;
    blurRadiusPx: number;
    distanceSpace?: ColorInterpolationMode;
}

export interface PerceptualSimilarityResult {
    score: number;
    meanDelta: number;
    maxDelta: number;
    blurRadiusPx: number;
}

export interface PerceptualSimilarityArtifacts {
    result: PerceptualSimilarityResult | null;
    blurredReferenceBuffer: Float32Array | null;
    blurredTestBuffer: Float32Array | null;
}

const CHANNELS_PER_PIXEL = 3;
const MIN_GAUSSIAN_SIGMA = 0.25;
const DEFAULT_DISTANCE_SPACE: ColorInterpolationMode = "oklab";
const OKLAB_DISTANCE_REFERENCE = 0.05; // Roughly a just-noticeable difference for smooth content.
export const DEFAULT_PERCEPTUAL_BLUR_RADIUS_PX = 1.25;

interface GaussianKernel {
    radius: number;
    weights: Float32Array;
}

export function computePerceptualSimilarityArtifacts(options: PerceptualSimilarityInput): PerceptualSimilarityArtifacts {
    const { referenceRgbBuffer, testRgbBuffer, width, height, distanceSpace = DEFAULT_DISTANCE_SPACE } = options;
    const blurRadiusPx = Math.max(0, options.blurRadiusPx);
    const expectedLength = width * height * CHANNELS_PER_PIXEL;
    if (referenceRgbBuffer.length !== expectedLength || testRgbBuffer.length !== expectedLength) {
        return buildEmptyArtifacts();
    }
    if (width <= 0 || height <= 0) {
        return buildEmptyArtifacts();
    }

    const kernel = buildGaussianKernel(blurRadiusPx);
    const blurredReference = applyGaussianBlurRgbBuffer(referenceRgbBuffer, width, height, kernel);
    const blurredTest = applyGaussianBlurRgbBuffer(testRgbBuffer, width, height, kernel);
    const { meanDelta, maxDelta } = measurePerceptualDelta(blurredReference, blurredTest, distanceSpace);
    return {
        result: {
            score: convertDeltaToScore(meanDelta),
            meanDelta,
            maxDelta,
            blurRadiusPx,
        },
        blurredReferenceBuffer: blurredReference,
        blurredTestBuffer: blurredTest,
    } satisfies PerceptualSimilarityArtifacts;
}

export function computePerceptualSimilarityScore(options: PerceptualSimilarityInput): PerceptualSimilarityResult | null {
    return computePerceptualSimilarityArtifacts(options).result;
}

function buildEmptyArtifacts(): PerceptualSimilarityArtifacts {
    return {
        result: null,
        blurredReferenceBuffer: null,
        blurredTestBuffer: null,
    } satisfies PerceptualSimilarityArtifacts;
}

function buildGaussianKernel(sigmaPx: number): GaussianKernel {
    const sigma = Math.max(MIN_GAUSSIAN_SIGMA, sigmaPx);
    const radius = Math.max(1, Math.ceil(sigma * 3));
    const size = radius * 2 + 1;
    const weights = new Float32Array(size);
    let sum = 0;
    for (let index = -radius; index <= radius; index++) {
        const weight = Math.exp(-(index * index) / (2 * sigma * sigma));
        weights[index + radius] = weight;
        sum += weight;
    }
    for (let index = 0; index < size; index++) {
        weights[index] /= sum;
    }
    return { radius, weights };
}

function applyGaussianBlurRgbBuffer(buffer: Float32Array, width: number, height: number, kernel: GaussianKernel) {
    if (kernel.radius <= 0) {
        return buffer.slice();
    }
    const horizontal = new Float32Array(buffer.length);
    const output = new Float32Array(buffer.length);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            blurPixelAxis(buffer, horizontal, width, height, x, y, kernel, true);
        }
    }
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            blurPixelAxis(horizontal, output, width, height, x, y, kernel, false);
        }
    }
    return output;
}

function blurPixelAxis(
    input: Float32Array,
    output: Float32Array,
    width: number,
    height: number,
    x: number,
    y: number,
    kernel: GaussianKernel,
    isHorizontal: boolean
) {
    for (let channel = 0; channel < CHANNELS_PER_PIXEL; channel++) {
        const { weightedSum, weightTotal } = accumulateBlurredValue(input, width, height, x, y, channel, kernel, isHorizontal);
        const destinationIndex = ((y * width + x) * CHANNELS_PER_PIXEL) + channel;
        output[destinationIndex] = weightTotal > 0 ? weightedSum / weightTotal : input[destinationIndex];
    }
}

function accumulateBlurredValue(
    input: Float32Array,
    width: number,
    height: number,
    x: number,
    y: number,
    channel: number,
    kernel: GaussianKernel,
    isHorizontal: boolean
) {
    let weightedSum = 0;
    let weightTotal = 0;
    for (let tapIndex = -kernel.radius; tapIndex <= kernel.radius; tapIndex++) {
        const sampleX = isHorizontal ? clampIndex(x + tapIndex, width) : x;
        const sampleY = isHorizontal ? y : clampIndex(y + tapIndex, height);
        const tapWeight = kernel.weights[tapIndex + kernel.radius];
        const sample = sampleChannel(input, width, sampleX, sampleY, channel);
        weightedSum += sample * tapWeight;
        weightTotal += tapWeight;
    }
    return { weightedSum, weightTotal };
}

function clampIndex(index: number, limit: number) {
    if (index < 0) {
        return 0;
    }
    if (index >= limit) {
        return limit - 1;
    }
    return index;
}

function sampleChannel(buffer: Float32Array, width: number, x: number, y: number, channel: number) {
    const baseIndex = ((y * width + x) * CHANNELS_PER_PIXEL) + channel;
    return buffer[baseIndex] ?? 0;
}

function measurePerceptualDelta(
    referenceRgbBuffer: Float32Array,
    testRgbBuffer: Float32Array,
    distanceSpace: ColorInterpolationMode
) {
    const length = referenceRgbBuffer.length;
    let sum = 0;
    let maxDelta = 0;
    for (let baseIndex = 0; baseIndex < length; baseIndex += CHANNELS_PER_PIXEL) {
        const reference = readRgbAt(referenceRgbBuffer, baseIndex);
        const test = readRgbAt(testRgbBuffer, baseIndex);
        const delta = measureColorDistance(reference, test, distanceSpace);
        sum += delta;
        if (delta > maxDelta) {
            maxDelta = delta;
        }
    }
    const pixelCount = length / CHANNELS_PER_PIXEL;
    const meanDelta = pixelCount > 0 ? sum / pixelCount : 0;
    return { meanDelta, maxDelta };
}

function readRgbAt(buffer: Float32Array, baseIndex: number) {
    return {
        r: buffer[baseIndex] ?? 0,
        g: buffer[baseIndex + 1] ?? 0,
        b: buffer[baseIndex + 2] ?? 0,
    };
}

function measureColorDistance(
    referenceRgb: { r: number; g: number; b: number },
    testRgb: { r: number; g: number; b: number },
    distanceSpace: ColorInterpolationMode
) {
    const referenceVector = rgb255ToVector(referenceRgb, distanceSpace);
    const testVector = rgb255ToVector(testRgb, distanceSpace);
    const referenceTuple = normalizeVectorToTuple(referenceVector, distanceSpace);
    const testTuple = normalizeVectorToTuple(testVector, distanceSpace);
    return euclideanDistance(referenceTuple, testTuple);
}

function normalizeVectorToTuple(vector: ReturnType<typeof rgb255ToVector>, mode: ColorInterpolationMode): number[] {
    switch (mode) {
        case "oklab":
            return [(vector as { L: number }).L, (vector as { a: number }).a, (vector as { b: number }).b];
        case "lab":
            return [(vector as { l: number }).l / 100, (vector as { a: number }).a / 128, (vector as { b: number }).b / 128];
        default: {
            const rgb = vector as { r: number; g: number; b: number };
            return [rgb.r, rgb.g, rgb.b];
        }
    }
}

function euclideanDistance(a: number[], b: number[]) {
    const length = Math.min(a.length, b.length);
    let total = 0;
    for (let index = 0; index < length; index++) {
        const delta = (a[index] ?? 0) - (b[index] ?? 0);
        total += delta * delta;
    }
    return Math.sqrt(total);
}

function convertDeltaToScore(meanDelta: number) {
    const normalized = meanDelta / OKLAB_DISTANCE_REFERENCE;
    return 100 / (1 + normalized);
}
