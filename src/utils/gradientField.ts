import Delaunator from "delaunator";
import type { PaletteCoordinate, PaletteSwatchDefinition } from "@/types/paletteDefinition";
import type { ColorInterpolationMode, ColorVector, RGBColor } from "./colorSpaces";
import { convertHexToVector, mixColorVectorsWeighted, rgbUnitTo255, vectorToRgb } from "./colorSpaces";

type GradientPosition = PaletteCoordinate;

export type GradientAutoPlacementMode = "perimeter" | "radial" | "grid";

export interface GradientControlPoint {
    hex: string;
    position: GradientPosition;
}

export interface GradientFieldPoint {
    position: GradientPosition;
    vector: ColorVector;
}

interface GradientTriangle {
    indices: [number, number, number];
    bbox: BoundingBox;
}

interface BoundingBox {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

type EdgeStrategy =
    | { kind: "horizontal-1d"; points: GradientFieldPoint[] }
    | { kind: "vertical-1d"; points: GradientFieldPoint[] }
    | { kind: "horizontal-bilinear"; topPoints: GradientFieldPoint[]; bottomPoints: GradientFieldPoint[] }
    | { kind: "vertical-bilinear"; leftPoints: GradientFieldPoint[]; rightPoints: GradientFieldPoint[] };

export interface GradientField {
    mode: ColorInterpolationMode;
    points: GradientFieldPoint[];
    triangles: GradientTriangle[];
    edgeStrategy: EdgeStrategy | null;
    curveAmount: number;
}

const DEFAULT_FALLBACK_POSITION: GradientPosition = { x: 0, y: 0 };
const DEFAULT_CORNER_SEQUENCE: GradientPosition[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
];
const CLOCKWISE_CORNER_SEQUENCE: GradientPosition[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
];
const ZERO_DISTANCE_EPSILON = 1e-6;
const IDW_POWER = 2;
const BARYCENTRIC_TOLERANCE = 1e-4;
const TRIANGLE_AREA_EPSILON = 1e-9;
const EDGE_TOLERANCE = 1e-3;
const CURVE_LINEAR_TOLERANCE = 1e-4;

interface PerimeterNode {
    position: GradientPosition;
    prev: PerimeterNode;
    next: PerimeterNode;
}

interface PerimeterSegment {
    start: PerimeterNode;
    end: PerimeterNode;
}

interface BarycentricHit {
    indices: [number, number, number];
    weights: [number, number, number];
}

export function resolveGradientControlPoints(
    swatches: PaletteSwatchDefinition[],
    autoPlacementMode: GradientAutoPlacementMode = "perimeter"
): GradientControlPoint[] {
    if (swatches.length === 0) {
        return [];
    }
    const unplacedCount = swatches.filter((swatch) => !swatch.position).length;
    const autoPositions = buildAutoPlacementLayout(autoPlacementMode, unplacedCount);
    let autoIndex = 0;
    return swatches.map((swatch) => {
        const position = swatch.position ?? autoPositions[autoIndex++] ?? DEFAULT_FALLBACK_POSITION;
        return {
            hex: swatch.hex,
            position: clonePosition(position),
        };
    });
}

export function buildGradientField(
    points: GradientControlPoint[],
    mode: ColorInterpolationMode,
    curveAmount: number
): GradientField {
    const fieldPoints = points.map((point) => ({
        position: clonePosition(point.position),
        vector: convertHexToVector(point.hex, mode),
    }));
    const triangles = fieldPoints.length >= 3 ? buildTriangles(fieldPoints) : [];
    const edgeStrategy = deriveEdgeStrategy(fieldPoints);
    return {
        mode,
        points: fieldPoints,
        triangles,
        edgeStrategy,
        curveAmount: clamp01(curveAmount),
    };
}

export function sampleGradientField(field: GradientField, u: number, v: number): RGBColor {
    if (field.points.length === 0) {
        return { r: 0, g: 0, b: 0 };
    }

    if (field.edgeStrategy) {
        const edgeColor = sampleEdgeStrategy(field, field.edgeStrategy, u, v);
        if (edgeColor) {
            return edgeColor;
        }
    }

    if (field.triangles.length > 0) {
        const barycentricHit = findBarycentricHit(field, u, v);
        if (barycentricHit) {
            const vectors: ColorVector[] = barycentricHit.indices.map((index) => field.points[index].vector);
            const shapedWeights = shapeWeightArray(barycentricHit.weights, field.curveAmount);
            const blended = mixColorVectorsWeighted(vectors, shapedWeights, field.mode);
            return vectorToRgb255(blended, field.mode);
        }
    }

    if (field.points.length === 1) {
        return vectorToRgb255(field.points[0].vector, field.mode);
    }

    return sampleByInverseDistance(field, u, v);
}

function sampleByInverseDistance(field: GradientField, u: number, v: number): RGBColor {
    const vectors: ColorVector[] = [];
    const weights: number[] = [];
    for (const point of field.points) {
        const dx = u - point.position.x;
        const dy = v - point.position.y;
        const distanceSq = dx * dx + dy * dy;
        if (distanceSq <= ZERO_DISTANCE_EPSILON) {
            return vectorToRgb255(point.vector, field.mode);
        }
        const weight = 1 / Math.pow(Math.max(distanceSq, ZERO_DISTANCE_EPSILON), IDW_POWER / 2);
        vectors.push(point.vector);
        weights.push(weight);
    }
    const shapedWeights = shapeWeightArray(weights, field.curveAmount);
    const blendedVector = mixColorVectorsWeighted(vectors, shapedWeights, field.mode);
    return vectorToRgb255(blendedVector, field.mode);
}

function sampleEdgeStrategy(
    field: GradientField,
    strategy: EdgeStrategy,
    u: number,
    v: number
): RGBColor | null {
    switch (strategy.kind) {
        case "horizontal-1d": {
            const vector = sampleAxisVector(strategy.points, "x", clamp01(u), field.mode, field.curveAmount);
            return vectorToRgb255(vector, field.mode);
        }
        case "vertical-1d": {
            const vector = sampleAxisVector(strategy.points, "y", clamp01(v), field.mode, field.curveAmount);
            return vectorToRgb255(vector, field.mode);
        }
        case "horizontal-bilinear": {
            const topVector = sampleAxisVector(strategy.topPoints, "x", clamp01(u), field.mode, field.curveAmount);
            const bottomVector = sampleAxisVector(strategy.bottomPoints, "x", clamp01(u), field.mode, field.curveAmount);
            const t = applyScalarCurve(clamp01(v), field.curveAmount);
            const blended = mixColorVectorsWeighted([topVector, bottomVector], [1 - t, t], field.mode);
            return vectorToRgb255(blended, field.mode);
        }
        case "vertical-bilinear": {
            const leftVector = sampleAxisVector(strategy.leftPoints, "y", clamp01(v), field.mode, field.curveAmount);
            const rightVector = sampleAxisVector(strategy.rightPoints, "y", clamp01(v), field.mode, field.curveAmount);
            const t = applyScalarCurve(clamp01(u), field.curveAmount);
            const blended = mixColorVectorsWeighted([leftVector, rightVector], [1 - t, t], field.mode);
            return vectorToRgb255(blended, field.mode);
        }
        default:
            return null;
    }
}

function sampleAxisVector(
    points: GradientFieldPoint[],
    axis: "x" | "y",
    value: number,
    mode: ColorInterpolationMode,
    curveAmount: number
): ColorVector {
    if (points.length === 0) {
        throw new Error("Cannot sample axis vector with no points");
    }
    if (points.length === 1) {
        return points[0].vector;
    }
    const vectors: ColorVector[] = [];
    const weights: number[] = [];
    for (const point of points) {
        const coordinate = axis === "x" ? point.position.x : point.position.y;
        const distance = Math.abs(value - coordinate);
        if (distance <= ZERO_DISTANCE_EPSILON) {
            return point.vector;
        }
        const weight = 1 / Math.pow(Math.max(distance, ZERO_DISTANCE_EPSILON), IDW_POWER / 2);
        vectors.push(point.vector);
        weights.push(weight);
    }
    if (vectors.length === 0) {
        return points[0].vector;
    }
    const shapedWeights = shapeWeightArray(weights, curveAmount);
    return mixColorVectorsWeighted(vectors, shapedWeights, mode);
}

function buildTriangles(points: GradientFieldPoint[]): GradientTriangle[] {
    const delaunay = Delaunator.from(
        points,
        (point: GradientFieldPoint) => point.position.x,
        (point: GradientFieldPoint) => point.position.y
    );
    const triangles: GradientTriangle[] = [];
    for (let index = 0; index < delaunay.triangles.length; index += 3) {
        const indices: [number, number, number] = [
            delaunay.triangles[index],
            delaunay.triangles[index + 1],
            delaunay.triangles[index + 2],
        ];
        if (!isValidTriangle(indices, points)) {
            continue;
        }
        triangles.push({
            indices,
            bbox: computeBoundingBox(indices, points),
        });
    }
    return triangles;
}

function isValidTriangle(indices: [number, number, number], points: GradientFieldPoint[]): boolean {
    const [i0, i1, i2] = indices;
    const p0 = points[i0].position;
    const p1 = points[i1].position;
    const p2 = points[i2].position;
    const area = (p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y);
    return Math.abs(area) >= TRIANGLE_AREA_EPSILON;
}

function computeBoundingBox(indices: [number, number, number], points: GradientFieldPoint[]): BoundingBox {
    const [i0, i1, i2] = indices;
    const positions = [points[i0].position, points[i1].position, points[i2].position];
    const xs = positions.map((pos) => pos.x);
    const ys = positions.map((pos) => pos.y);
    return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
    };
}

function findBarycentricHit(field: GradientField, u: number, v: number): BarycentricHit | null {
    for (const triangle of field.triangles) {
        if (!isPointWithinBoundingBox(u, v, triangle.bbox)) {
            continue;
        }
        const weights = computeBarycentricWeights(triangle.indices, field.points, u, v);
        if (!weights) {
            continue;
        }
        if (weights[0] >= -BARYCENTRIC_TOLERANCE && weights[1] >= -BARYCENTRIC_TOLERANCE && weights[2] >= -BARYCENTRIC_TOLERANCE) {
            const clamped: [number, number, number] = [
                Math.max(0, weights[0]),
                Math.max(0, weights[1]),
                Math.max(0, weights[2]),
            ];
            const sum = clamped[0] + clamped[1] + clamped[2];
            if (sum > 0) {
                return {
                    indices: triangle.indices,
                    weights: [clamped[0] / sum, clamped[1] / sum, clamped[2] / sum],
                };
            }
        }
    }
    return null;
}

function isPointWithinBoundingBox(x: number, y: number, bbox: BoundingBox): boolean {
    return (
        x >= bbox.minX - BARYCENTRIC_TOLERANCE &&
        x <= bbox.maxX + BARYCENTRIC_TOLERANCE &&
        y >= bbox.minY - BARYCENTRIC_TOLERANCE &&
        y <= bbox.maxY + BARYCENTRIC_TOLERANCE
    );
}

function computeBarycentricWeights(
    indices: [number, number, number],
    points: GradientFieldPoint[],
    x: number,
    y: number
): [number, number, number] | null {
    const [i0, i1, i2] = indices;
    const p0 = points[i0].position;
    const p1 = points[i1].position;
    const p2 = points[i2].position;
    const denom = (p1.y - p2.y) * (p0.x - p2.x) + (p2.x - p1.x) * (p0.y - p2.y);
    if (Math.abs(denom) < TRIANGLE_AREA_EPSILON) {
        return null;
    }
    const w0 = ((p1.y - p2.y) * (x - p2.x) + (p2.x - p1.x) * (y - p2.y)) / denom;
    const w1 = ((p2.y - p0.y) * (x - p2.x) + (p0.x - p2.x) * (y - p2.y)) / denom;
    const w2 = 1 - w0 - w1;
    return [w0, w1, w2];
}

function vectorToRgb255(vector: ColorVector, mode: ColorInterpolationMode): RGBColor {
    const rgbUnit = vectorToRgb(vector, mode);
    return rgbUnitTo255(rgbUnit);
}

function shapeWeightArray(weights: number[], curveAmount: number): number[] {
    const normalized = normalizeWeights(weights);
    if (!normalized.length || Math.abs(curveAmount - 0.5) <= CURVE_LINEAR_TOLERANCE) {
        return normalized;
    }
    const shaped = normalized.map((value) => applyScalarCurve(value, curveAmount));
    return normalizeWeights(shaped);
}

function applyScalarCurve(value: number, curveAmount: number): number {
    const clamped = clamp01(value);
    if (Math.abs(curveAmount - 0.5) <= CURVE_LINEAR_TOLERANCE) {
        return clamped;
    }
    if (curveAmount < 0.5) {
        const t = (0.5 - curveAmount) * 2; // 0 at midpoint, 1 at far left
        const exponent = lerp(1, 0.15, t);
        return Math.pow(clamped, exponent);
    }
    const t = (curveAmount - 0.5) * 2; // 0 at midpoint, 1 at far right
    const exponent = lerp(1, 10, t);
    return Math.pow(clamped, exponent);
}

function normalizeWeights(weights: number[]): number[] {
    if (!weights.length) {
        return [];
    }
    const clamped = weights.map((value) => (Number.isFinite(value) ? Math.max(0, value) : 0));
    const sum = clamped.reduce((acc, value) => acc + value, 0);
    if (sum <= 1e-6) {
        const fallback = clamped.length > 0 ? 1 / clamped.length : 0;
        return clamped.map(() => fallback);
    }
    return clamped.map((value) => value / sum);
}

const lerp = (start: number, end: number, t: number) => start + (end - start) * clamp01(t);

function deriveEdgeStrategy(points: GradientFieldPoint[]): EdgeStrategy | null {
    if (!points.length) {
        return null;
    }
    const buckets = classifyEdgeBuckets(points);
    const { top, bottom, left, right } = buckets;
    if (top.length === points.length) {
        return { kind: "horizontal-1d", points: top };
    }
    if (bottom.length === points.length) {
        return { kind: "horizontal-1d", points: bottom };
    }
    if (left.length === points.length) {
        return { kind: "vertical-1d", points: left };
    }
    if (right.length === points.length) {
        return { kind: "vertical-1d", points: right };
    }
    if (top.length > 0 && bottom.length > 0 && top.length + bottom.length === points.length) {
        return { kind: "horizontal-bilinear", topPoints: top, bottomPoints: bottom };
    }
    if (left.length > 0 && right.length > 0 && left.length + right.length === points.length) {
        return { kind: "vertical-bilinear", leftPoints: left, rightPoints: right };
    }
    return null;
}

function classifyEdgeBuckets(points: GradientFieldPoint[]) {
    const top: GradientFieldPoint[] = [];
    const bottom: GradientFieldPoint[] = [];
    const left: GradientFieldPoint[] = [];
    const right: GradientFieldPoint[] = [];
    for (const point of points) {
        const { x, y } = point.position;
        if (y <= EDGE_TOLERANCE) {
            top.push(point);
        }
        if (y >= 1 - EDGE_TOLERANCE) {
            bottom.push(point);
        }
        if (x <= EDGE_TOLERANCE) {
            left.push(point);
        }
        if (x >= 1 - EDGE_TOLERANCE) {
            right.push(point);
        }
    }
    return { top, bottom, left, right };
}

function buildAutoPlacementLayout(mode: GradientAutoPlacementMode, count: number): GradientPosition[] {
    if (count <= 0) {
        return [];
    }
    switch (mode) {
        case "radial":
            return buildRadialLayout(count);
        case "grid":
            return buildGridLayout(count);
        case "perimeter":
        default:
            return buildPerimeterLayout(count);
    }
}

function buildPerimeterLayout(count: number): GradientPosition[] {
    if (count <= 0) {
        return [];
    }
    if (count <= DEFAULT_CORNER_SEQUENCE.length) {
        return DEFAULT_CORNER_SEQUENCE.slice(0, count).map(clonePosition);
    }
    const layout: GradientPosition[] = DEFAULT_CORNER_SEQUENCE.map(clonePosition);
    const nodes = createPerimeterCycle();
    const segments = createInitialSegments(nodes);
    let remaining = count - DEFAULT_CORNER_SEQUENCE.length;
    while (remaining > 0 && segments.length > 0) {
        const segment = segments.shift();
        if (!segment) {
            break;
        }
        const newNode = splitSegment(segment);
        layout.push(clonePosition(newNode.position));
        segments.push({ start: segment.start, end: newNode });
        segments.push({ start: newNode, end: segment.end });
        remaining -= 1;
    }
    while (layout.length < count) {
        layout.push(clonePosition(DEFAULT_FALLBACK_POSITION));
    }
    return layout.slice(0, count);
}

function buildRadialLayout(count: number): GradientPosition[] {
    const positions: GradientPosition[] = [];
    const centerX = 0.5;
    const centerY = 0.5;
    for (let index = 0; index < count; index++) {
        const angle = (index / count) * Math.PI * 2;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        const tValues: number[] = [];
        if (dx > ZERO_DISTANCE_EPSILON) {
            tValues.push((1 - centerX) / dx);
        } else if (dx < -ZERO_DISTANCE_EPSILON) {
            tValues.push((0 - centerX) / dx);
        }
        if (dy > ZERO_DISTANCE_EPSILON) {
            tValues.push((1 - centerY) / dy);
        } else if (dy < -ZERO_DISTANCE_EPSILON) {
            tValues.push((0 - centerY) / dy);
        }
        const positiveT = tValues.filter((value) => value > 0);
        const t = positiveT.length ? Math.min(...positiveT) : 0.5;
        const x = clamp01(centerX + dx * t);
        const y = clamp01(centerY + dy * t);
        positions.push({ x, y });
    }
    return positions;
}

function buildGridLayout(count: number): GradientPosition[] {
    if (count <= 0) {
        return [];
    }
    const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
    const rows = Math.max(1, Math.ceil(count / columns));
    const rowStep = rows > 1 ? 1 / (rows - 1) : 0;
    const positions: GradientPosition[] = [];
    for (let row = 0; row < rows && positions.length < count; row++) {
        const remaining = count - positions.length;
        const cellsInRow = row === rows - 1 ? remaining : Math.min(columns, remaining);
        if (cellsInRow <= 0) {
            break;
        }
        const columnStep = cellsInRow > 1 ? 1 / (cellsInRow - 1) : 0;
        for (let col = 0; col < cellsInRow && positions.length < count; col++) {
            const x = cellsInRow > 1 ? col * columnStep : 0.5;
            const y = rows > 1 ? row * rowStep : 0.5;
            positions.push({ x: clamp01(x), y: clamp01(y) });
        }
    }
    return positions;
}

function createPerimeterCycle(): PerimeterNode[] {
    const nodes = CLOCKWISE_CORNER_SEQUENCE.map((position) => {
        const node: Partial<PerimeterNode> = {
            position: clonePosition(position),
        };
        return node as PerimeterNode;
    });
    for (let index = 0; index < nodes.length; index++) {
        const node = nodes[index];
        node.next = nodes[(index + 1) % nodes.length];
        node.prev = nodes[(index - 1 + nodes.length) % nodes.length];
    }
    return nodes;
}

function createInitialSegments(nodes: PerimeterNode[]): PerimeterSegment[] {
    const segments: PerimeterSegment[] = [];
    for (let index = 0; index < nodes.length; index++) {
        const start = nodes[index];
        const end = nodes[(index + 1) % nodes.length];
        segments.push({ start, end });
    }
    return segments;
}

function splitSegment(segment: PerimeterSegment): PerimeterNode {
    const midpoint: GradientPosition = {
        x: (segment.start.position.x + segment.end.position.x) / 2,
        y: (segment.start.position.y + segment.end.position.y) / 2,
    };
    const node: PerimeterNode = {
        position: midpoint,
        prev: segment.start,
        next: segment.end,
    };
    segment.start.next = node;
    segment.end.prev = node;
    return node;
}

function clonePosition(position: GradientPosition): GradientPosition {
    return { x: position.x, y: position.y };
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
