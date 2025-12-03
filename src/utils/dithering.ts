export type DitherType =
    | "none"
    | "bayer2"
    | "bayer4"
    | "bayer8"
    | "bw-noise"
    | "grayscale-noise"
    | "rgb-noise"
    | "color-noise"
    | "blue-noise"
    | "voronoi-cluster"
    | "error-diffusion-kernel";
export type BayerDitherType = "bayer2" | "bayer4" | "bayer8";
export type RandomNoiseDitherType = "bw-noise" | "grayscale-noise" | "rgb-noise" | "color-noise";
export type ProceduralTileDitherType = "blue-noise" | "voronoi-cluster";
export type ErrorDiffusionKernelId =
    | "floyd-steinberg"
    | "jarvis-judice-ninke"
    | "stucki"
    | "atkinson"
    | "burkes"
    | "sierra"
    | "sierra-lite";

export interface ErrorDiffusionKernel {
    id: ErrorDiffusionKernelId;
    label: string;
    offsets: Array<{ dx: number; dy: number; weight: number }>;
    divisor: number;
    maxDy: number;
}

export interface DitherThresholdTile {
    size: number;
    data: Float32Array;
}

export const DITHER_LABELS: Record<DitherType, string> = {
    none: "None",
    bayer2: "2×2 Bayer",
    bayer4: "4×4 Bayer",
    bayer8: "8×8 Bayer",
    "bw-noise": "Random B/W noise",
    "grayscale-noise": "Random grayscale noise",
    "rgb-noise": "Random RGB primary noise",
    "color-noise": "Random color noise",
    "blue-noise": "Blue-noise tile",
    "voronoi-cluster": "Voronoi cluster",
    "error-diffusion-kernel": "Error diffusion (kernel)",
};

export const DITHER_DESCRIPTIONS: Record<DitherType, string> = {
    none: "No jitter",
    bayer2: "2×2 ordered thresholds",
    bayer4: "4×4 ordered thresholds",
    bayer8: "8×8 ordered thresholds",
    "bw-noise": "Binary noise per pixel",
    "grayscale-noise": "Monochrome random jitter",
    "rgb-noise": "Channel-wise binary noise",
    "color-noise": "Channel-wise random jitter",
    "blue-noise": "Tiled blue-noise thresholds",
    "voronoi-cluster": "Clustered Voronoi thresholds",
    "error-diffusion-kernel": "Kernel-based error diffusion",
};

export const DITHER_TYPE_ORDER: DitherType[] = [
    "none",
    "bayer2",
    "bayer4",
    "bayer8",
    "bw-noise",
    "grayscale-noise",
    "rgb-noise",
    "color-noise",
    "blue-noise",
    "voronoi-cluster",
    "error-diffusion-kernel",
];

export interface ProceduralDitherOptions {
    voronoi?: {
        cellsPerAxis?: number;
        jitter?: number;
    };
}

const BAYER_DITHER_TYPES: BayerDitherType[] = ["bayer2", "bayer4", "bayer8"];
const RANDOM_NOISE_TYPES: RandomNoiseDitherType[] = ["bw-noise", "grayscale-noise", "rgb-noise", "color-noise"];
const PROCEDURAL_TILE_TYPES: ProceduralTileDitherType[] = ["blue-noise", "voronoi-cluster"];
const SEEDED_DITHER_TYPES: DitherType[] = [...RANDOM_NOISE_TYPES, ...PROCEDURAL_TILE_TYPES];

const ERROR_DIFFUSION_KERNEL_DATA: Array<Omit<ErrorDiffusionKernel, "maxDy">> = [
    {
        id: "floyd-steinberg",
        label: "Floyd–Steinberg",
        divisor: 16,
        offsets: [
            { dx: 1, dy: 0, weight: 7 },
            { dx: -1, dy: 1, weight: 3 },
            { dx: 0, dy: 1, weight: 5 },
            { dx: 1, dy: 1, weight: 1 },
        ],
    },
    {
        id: "jarvis-judice-ninke",
        label: "Jarvis–Judice–Ninke",
        divisor: 48,
        offsets: [
            { dx: 1, dy: 0, weight: 7 },
            { dx: 2, dy: 0, weight: 5 },
            { dx: -2, dy: 1, weight: 3 },
            { dx: -1, dy: 1, weight: 5 },
            { dx: 0, dy: 1, weight: 7 },
            { dx: 1, dy: 1, weight: 5 },
            { dx: 2, dy: 1, weight: 3 },
            { dx: -2, dy: 2, weight: 1 },
            { dx: -1, dy: 2, weight: 3 },
            { dx: 0, dy: 2, weight: 5 },
            { dx: 1, dy: 2, weight: 3 },
            { dx: 2, dy: 2, weight: 1 },
        ],
    },
    {
        id: "stucki",
        label: "Stucki",
        divisor: 42,
        offsets: [
            { dx: 1, dy: 0, weight: 8 },
            { dx: 2, dy: 0, weight: 4 },
            { dx: -2, dy: 1, weight: 2 },
            { dx: -1, dy: 1, weight: 4 },
            { dx: 0, dy: 1, weight: 8 },
            { dx: 1, dy: 1, weight: 4 },
            { dx: 2, dy: 1, weight: 2 },
            { dx: -2, dy: 2, weight: 1 },
            { dx: -1, dy: 2, weight: 2 },
            { dx: 0, dy: 2, weight: 4 },
            { dx: 1, dy: 2, weight: 2 },
            { dx: 2, dy: 2, weight: 1 },
        ],
    },
    {
        id: "atkinson",
        label: "Atkinson",
        divisor: 8,
        offsets: [
            { dx: 1, dy: 0, weight: 1 },
            { dx: 2, dy: 0, weight: 1 },
            { dx: -1, dy: 1, weight: 1 },
            { dx: 0, dy: 1, weight: 1 },
            { dx: 1, dy: 1, weight: 1 },
            { dx: 0, dy: 2, weight: 1 },
        ],
    },
    {
        id: "burkes",
        label: "Burkes",
        divisor: 32,
        offsets: [
            { dx: 1, dy: 0, weight: 8 },
            { dx: 2, dy: 0, weight: 4 },
            { dx: -2, dy: 1, weight: 2 },
            { dx: -1, dy: 1, weight: 4 },
            { dx: 0, dy: 1, weight: 8 },
            { dx: 1, dy: 1, weight: 4 },
            { dx: 2, dy: 1, weight: 2 },
        ],
    },
    {
        id: "sierra",
        label: "Sierra",
        divisor: 32,
        offsets: [
            { dx: 1, dy: 0, weight: 5 },
            { dx: 2, dy: 0, weight: 3 },
            { dx: -2, dy: 1, weight: 2 },
            { dx: -1, dy: 1, weight: 4 },
            { dx: 0, dy: 1, weight: 5 },
            { dx: 1, dy: 1, weight: 4 },
            { dx: 2, dy: 1, weight: 2 },
            { dx: -1, dy: 2, weight: 2 },
            { dx: 0, dy: 2, weight: 3 },
            { dx: 1, dy: 2, weight: 2 },
        ],
    },
    {
        id: "sierra-lite",
        label: "Sierra Lite",
        divisor: 4,
        offsets: [
            { dx: 1, dy: 0, weight: 2 },
            { dx: -1, dy: 1, weight: 1 },
            { dx: 0, dy: 1, weight: 1 },
            { dx: 1, dy: 1, weight: 1 },
        ],
    },
];

export const ERROR_DIFFUSION_KERNELS: ErrorDiffusionKernel[] = ERROR_DIFFUSION_KERNEL_DATA.map((kernel) => ({
    ...kernel,
    maxDy: Math.max(0, ...kernel.offsets.map((offset) => offset.dy)),
}));

export const DEFAULT_ERROR_DIFFUSION_KERNEL: ErrorDiffusionKernelId = "floyd-steinberg";

const ERROR_DIFFUSION_KERNEL_MAP = new Map<ErrorDiffusionKernelId, ErrorDiffusionKernel>(
    ERROR_DIFFUSION_KERNELS.map((kernel) => [kernel.id, kernel])
);

const RANDOM_VARIANT_OFFSETS: Record<RandomNoiseDitherType, number> = {
    "bw-noise": 101,
    "grayscale-noise": 211,
    "rgb-noise": 307,
    "color-noise": 401,
};

const BLUE_NOISE_TILE_SIZE = 64;
export const VORONOI_TILE_SIZE = 64;
export const DEFAULT_VORONOI_CELLS = 8;
export const DEFAULT_VORONOI_JITTER = 0.85;

const BAYER_MATRICES: Record<BayerDitherType, number[][]> = {
    bayer2: [
        [0, 2],
        [3, 1],
    ],
    bayer4: [
        [0, 12, 3, 15],
        [8, 4, 11, 7],
        [2, 14, 1, 13],
        [10, 6, 9, 5],
    ],
    bayer8: [
        [0, 32, 8, 40, 2, 34, 10, 42],
        [48, 16, 56, 24, 50, 18, 58, 26],
        [12, 44, 4, 36, 14, 46, 6, 38],
        [60, 28, 52, 20, 62, 30, 54, 22],
        [3, 35, 11, 43, 1, 33, 9, 41],
        [51, 19, 59, 27, 49, 17, 57, 25],
        [15, 47, 7, 39, 13, 45, 5, 37],
        [63, 31, 55, 23, 61, 29, 53, 21],
    ],
};

export function applyDitherJitter(
    rgb255: { r: number; g: number; b: number },
    x: number,
    y: number,
    type: DitherType,
    strength: number,
    seed: number,
    proceduralTile: DitherThresholdTile | null
) {
    if (type === "none" || strength <= 0) {
        return rgb255;
    }
    if (isBayerDitherType(type)) {
        const matrix = BAYER_MATRICES[type];
        const size = matrix.length;
        const denominator = size * size;
        const matrixSrcValue = matrix[y % size][x % size];
        const threshold = (matrixSrcValue + 0.5) / denominator - 0.5;
        const jitter = threshold * strength * 255;
        return addRgb(rgb255, jitter);
    }
    if (isProceduralTileType(type) && proceduralTile) {
        const threshold = sampleDitherTile(proceduralTile, x, y);
        const jitter = threshold * strength * 255;
        return addRgb(rgb255, jitter);
    }
    return applyRandomNoiseDither(rgb255, x, y, type, strength, seed);
}

export function buildProceduralDitherTile(
    type: DitherType,
    seed: number,
    options?: ProceduralDitherOptions
): DitherThresholdTile | null {
    if (type === "blue-noise") {
        return generateBlueNoiseTile(BLUE_NOISE_TILE_SIZE, seed);
    }
    if (type === "voronoi-cluster") {
        const cellsPerAxis = resolveVoronoiCells(options?.voronoi?.cellsPerAxis);
        const jitter = clamp01(options?.voronoi?.jitter ?? DEFAULT_VORONOI_JITTER);
        return generateVoronoiClusterTile(VORONOI_TILE_SIZE, cellsPerAxis, jitter, seed);
    }
    return null;
}

export function getErrorDiffusionKernel(id: ErrorDiffusionKernelId): ErrorDiffusionKernel {
    return ERROR_DIFFUSION_KERNEL_MAP.get(id) ?? ERROR_DIFFUSION_KERNEL_MAP.get(DEFAULT_ERROR_DIFFUSION_KERNEL)!;
}

export function usesSeededDither(type: DitherType) {
    return SEEDED_DITHER_TYPES.includes(type);
}

export function isProceduralTileType(type: DitherType): type is ProceduralTileDitherType {
    return PROCEDURAL_TILE_TYPES.includes(type as ProceduralTileDitherType);
}

export function isErrorDiffusionDither(type: DitherType) {
    return type === "error-diffusion-kernel";
}

function applyRandomNoiseDither(
    rgb255: { r: number; g: number; b: number },
    x: number,
    y: number,
    type: DitherType,
    strength: number,
    seed: number
) {
    if (!isRandomNoiseType(type)) {
        return rgb255;
    }
    const magnitude = strength * 255;
    const baseVariant = RANDOM_VARIANT_OFFSETS[type];
    if (type === "bw-noise") {
        const rand = pseudoRandomUnit(seed, x, y, baseVariant);
        const threshold = rand > 0.5 ? 0.5 : -0.5;
        return addRgb(rgb255, threshold * magnitude);
    }
    if (type === "grayscale-noise") {
        const rand = pseudoRandomUnit(seed, x, y, baseVariant);
        const threshold = rand - 0.5;
        return addRgb(rgb255, threshold * magnitude);
    }
    const jittered = {
        r: rgb255.r + channelNoise(seed, x, y, baseVariant, 0, type) * magnitude,
        g: rgb255.g + channelNoise(seed, x, y, baseVariant, 1, type) * magnitude,
        b: rgb255.b + channelNoise(seed, x, y, baseVariant, 2, type) * magnitude,
    };
    return jittered;
}

function channelNoise(
    seed: number,
    x: number,
    y: number,
    baseVariant: number,
    channelIndex: number,
    type: RandomNoiseDitherType
) {
    const rand = pseudoRandomUnit(seed, x, y, baseVariant + channelIndex);
    if (type === "rgb-noise") {
        return rand > 0.5 ? 0.5 : -0.5;
    }
    return rand - 0.5;
}

function generateBlueNoiseTile(size: number, seed: number): DitherThresholdTile {
    const total = size * size;
    const base = new Float32Array(total);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const index = y * size + x;
            base[index] = pseudoRandomUnit(seed, x, y, 523);
        }
    }
    const scores = new Float32Array(total);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const index = y * size + x;
            let neighborSum = 0;
            let neighborCount = 0;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) {
                        continue;
                    }
                    const neighborIndex = wrapTileIndex(size, x + dx, y + dy);
                    neighborSum += base[neighborIndex];
                    neighborCount++;
                }
            }
            const neighborAvg = neighborCount > 0 ? neighborSum / neighborCount : 0.5;
            const laplacian = base[index] - neighborAvg;
            const highFreqScore = laplacian + (base[index] - 0.5) * 0.25;
            scores[index] = highFreqScore;
        }
    }
    return {
        size,
        data: rankThresholds(scores),
    };
}

function generateVoronoiClusterTile(size: number, cellsPerAxis: number, jitter: number, seed: number): DitherThresholdTile {
    if (size % cellsPerAxis !== 0) {
        throw new Error(`Voronoi tile size ${size} must be divisible by ${cellsPerAxis}`);
    }
    const cellSize = size / cellsPerAxis;
    const centroids = buildVoronoiCentroids(cellsPerAxis, cellSize, size, jitter, seed);
    const total = size * size;
    const scores = new Float32Array(total);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const px = x + 0.5;
            const py = y + 0.5;
            const baseCellX = Math.floor(x / cellSize);
            const baseCellY = Math.floor(y / cellSize);
            let minDist = Infinity;
            for (let offsetY = -1; offsetY <= 1; offsetY++) {
                for (let offsetX = -1; offsetX <= 1; offsetX++) {
                    const neighborCellX = baseCellX + offsetX;
                    const neighborCellY = baseCellY + offsetY;
                    const wrappedCellX = wrapModulo(neighborCellX, cellsPerAxis);
                    const wrappedCellY = wrapModulo(neighborCellY, cellsPerAxis);
                    const centroid = centroids[wrappedCellY * cellsPerAxis + wrappedCellX];
                    const tileOffsetX = ((neighborCellX - wrappedCellX) / cellsPerAxis) * size;
                    const tileOffsetY = ((neighborCellY - wrappedCellY) / cellsPerAxis) * size;
                    const centroidX = centroid.x + tileOffsetX;
                    const centroidY = centroid.y + tileOffsetY;
                    const dx = px - centroidX;
                    const dy = py - centroidY;
                    const distSq = dx * dx + dy * dy;
                    if (distSq < minDist) {
                        minDist = distSq;
                    }
                }
            }
            scores[y * size + x] = minDist;
        }
    }
    return {
        size,
        data: rankThresholds(scores),
    };
}

function buildVoronoiCentroids(
    cellsPerAxis: number,
    cellSize: number,
    tileSize: number,
    jitter: number,
    seed: number
) {
    const centroids: { x: number; y: number }[] = new Array(cellsPerAxis * cellsPerAxis);
    for (let cy = 0; cy < cellsPerAxis; cy++) {
        for (let cx = 0; cx < cellsPerAxis; cx++) {
            const baseX = cx * cellSize + cellSize / 2;
            const baseY = cy * cellSize + cellSize / 2;
            const jitterX = (pseudoRandomUnit(seed, cx, cy, 811) - 0.5) * cellSize * jitter;
            const jitterY = (pseudoRandomUnit(seed, cx, cy, 923) - 0.5) * cellSize * jitter;
            const xPos = normalizeTileCoord(baseX + jitterX, tileSize);
            const yPos = normalizeTileCoord(baseY + jitterY, tileSize);
            centroids[cy * cellsPerAxis + cx] = { x: xPos, y: yPos };
        }
    }
    return centroids;
}

function sampleDitherTile(tile: DitherThresholdTile, x: number, y: number) {
    const size = tile.size;
    if (size <= 0 || tile.data.length === 0) {
        return 0;
    }
    const wrappedX = wrapModulo(x, size);
    const wrappedY = wrapModulo(y, size);
    const index = wrappedY * size + wrappedX;
    return tile.data[index] ?? 0;
}

function addRgb(rgb: { r: number; g: number; b: number }, offset: number) {
    return {
        r: rgb.r + offset,
        g: rgb.g + offset,
        b: rgb.b + offset,
    };
}

function resolveVoronoiCells(requested?: number) {
    const size = VORONOI_TILE_SIZE;
    const min = 1;
    const max = size;
    const candidate = Math.max(min, Math.min(max, Math.floor(requested ?? DEFAULT_VORONOI_CELLS)));
    if (size % candidate === 0) {
        return candidate;
    }
    for (let delta = 1; delta < size; delta++) {
        const lower = candidate - delta;
        if (lower >= min && size % lower === 0) {
            return lower;
        }
        const upper = candidate + delta;
        if (upper <= max && size % upper === 0) {
            return upper;
        }
    }
    return DEFAULT_VORONOI_CELLS;
}

function wrapTileIndex(size: number, x: number, y: number) {
    const wrappedX = wrapModulo(x, size);
    const wrappedY = wrapModulo(y, size);
    return wrappedY * size + wrappedX;
}

function wrapModulo(value: number, modulus: number) {
    const mod = value % modulus;
    return mod < 0 ? mod + modulus : mod;
}

function normalizeTileCoord(value: number, size: number) {
    const mod = value % size;
    return mod < 0 ? mod + size : mod;
}

function clamp01(value: number) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    if (value <= 0) {
        return 0;
    }
    if (value >= 1) {
        return 1;
    }
    return value;
}

function rankThresholds(scores: Float32Array) {
    const total = scores.length;
    if (total === 0) {
        return new Float32Array(0);
    }
    const indices = Array.from({ length: total }, (_, index) => index);
    indices.sort((a, b) => scores[a] - scores[b]);
    const thresholds = new Float32Array(total);
    if (total === 1) {
        thresholds[indices[0]] = 0;
        return thresholds;
    }
    const denom = total - 1;
    for (let rank = 0; rank < total; rank++) {
        const normalized = rank / denom - 0.5;
        thresholds[indices[rank]] = normalized;
    }
    return thresholds;
}

function isBayerDitherType(type: DitherType): type is BayerDitherType {
    return BAYER_DITHER_TYPES.includes(type as BayerDitherType);
}

function isRandomNoiseType(type: DitherType): type is RandomNoiseDitherType {
    return RANDOM_NOISE_TYPES.includes(type as RandomNoiseDitherType);
}

function pseudoRandomUnit(seed: number, x: number, y: number, variant: number) {
    let hash = normalizeSeed(seed) ^ Math.imul(variant + 0x7f4a7c15, 0x45d9f3b);
    hash ^= Math.imul(x + 0x27d4eb2f, 0x9e3779b9);
    hash = Math.imul(hash ^ (hash >>> 15), 0x85ebca6b);
    hash ^= Math.imul(y + 0x165667b1, 0xc2b2ae35);
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 1274126177);
    hash ^= hash >>> 16;
    return (hash >>> 0) / 0xffffffff;
}

function normalizeSeed(seed: number) {
    if (!Number.isFinite(seed)) {
        return 0;
    }
    const normalized = Math.abs(Math.floor(seed)) >>> 0;
    return normalized;
}
