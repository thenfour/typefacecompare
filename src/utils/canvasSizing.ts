export const CANVAS_SIZE_MIN = 64;
export const CANVAS_SIZE_MAX = 512;
export const CANVAS_SIZE_STEP = 8;

export interface CanvasSize {
    width: number;
    height: number;
}

export function snapCanvasDimension(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
        return CANVAS_SIZE_MIN;
    }
    const clamped = clamp(value, CANVAS_SIZE_MIN, CANVAS_SIZE_MAX);
    const snapped = Math.round(clamped / CANVAS_SIZE_STEP) * CANVAS_SIZE_STEP;
    return clamp(snapped, CANVAS_SIZE_MIN, CANVAS_SIZE_MAX);
}

export function deriveCanvasSizeFromImage(image: Pick<HTMLImageElement, "naturalWidth" | "naturalHeight" | "width" | "height">): CanvasSize {
    const rawWidth = image.naturalWidth || image.width || CANVAS_SIZE_MIN;
    const rawHeight = image.naturalHeight || image.height || CANVAS_SIZE_MIN;
    return {
        width: snapCanvasDimension(rawWidth),
        height: snapCanvasDimension(rawHeight),
    };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
