import type { PaletteCoordinate, PaletteSwatchDefinition } from "@/types/paletteDefinition";
import type { ColorInterpolationMode, ColorVector, RGBColor } from "./colorSpaces";
import { rgbUnitTo255, vectorToRgb, convertHexToVector, mixColorVectorsWeighted } from "./colorSpaces";

type GradientPosition = PaletteCoordinate;

export interface GradientControlPoint {
    hex: string;
    position: GradientPosition;
}

export interface GradientFieldPoint {
    position: GradientPosition;
    vector: ColorVector;
}

export interface GradientField {
    mode: ColorInterpolationMode;
    points: GradientFieldPoint[];
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

interface PerimeterNode {
    position: GradientPosition;
    prev: PerimeterNode;
    next: PerimeterNode;
}

interface PerimeterSegment {
    start: PerimeterNode;
    end: PerimeterNode;
}

export function resolveGradientControlPoints(swatches: PaletteSwatchDefinition[]): GradientControlPoint[] {
    if (swatches.length === 0) {
        return [];
    }
    const defaultLayout = buildDefaultPerimeterLayout(swatches.length);
    return swatches.map((swatch, index) => ({
        hex: swatch.hex,
        position: clonePosition(swatch.position ?? defaultLayout[index] ?? DEFAULT_FALLBACK_POSITION),
    }));
}

export function buildGradientField(points: GradientControlPoint[], mode: ColorInterpolationMode): GradientField {
    return {
        mode,
        points: points.map((point) => ({
            position: clonePosition(point.position),
            vector: convertHexToVector(point.hex, mode),
        })),
    };
}

export function sampleGradientField(field: GradientField, u: number, v: number): RGBColor {
    if (field.points.length === 0) {
        return { r: 0, g: 0, b: 0 };
    }
    if (field.points.length === 1) {
        return vectorToRgb255(field.points[0].vector, field.mode);
    }
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
    const blendedVector = mixColorVectorsWeighted(vectors, weights, field.mode);
    return vectorToRgb255(blendedVector, field.mode);
}

function vectorToRgb255(vector: ColorVector, mode: ColorInterpolationMode): RGBColor {
    const rgbUnit = vectorToRgb(vector, mode);
    return rgbUnitTo255(rgbUnit);
}

function buildDefaultPerimeterLayout(count: number): GradientPosition[] {
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
    if (layout.length < count) {
        while (layout.length < count) {
            layout.push(clonePosition(DEFAULT_FALLBACK_POSITION));
        }
    }
    return layout;
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
