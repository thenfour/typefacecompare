export type ImageScaleMode = "cover" | "contain" | "stretch" | "none";

export const IMAGE_SCALE_MODE_LABELS: Record<ImageScaleMode, string> = {
    cover: "Cover",
    contain: "Contain",
    stretch: "Stretch",
    none: "No scaling",
};

export function drawImageWithScaleMode(
    ctx: CanvasRenderingContext2D,
    image: CanvasImageSource & { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number },
    mode: ImageScaleMode,
    targetWidth: number,
    targetHeight: number
) {
    const sourceWidth = Number(image instanceof HTMLImageElement ? image.naturalWidth || image.width : (image as HTMLCanvasElement).width);
    const sourceHeight = Number(image instanceof HTMLImageElement ? image.naturalHeight || image.height : (image as HTMLCanvasElement).height);
    if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0) {
        ctx.clearRect(0, 0, targetWidth, targetHeight);
        return;
    }

    ctx.clearRect(0, 0, targetWidth, targetHeight);
    let drawWidth = targetWidth;
    let drawHeight = targetHeight;
    let dx = 0;
    let dy = 0;

    if (mode === "stretch") {
        drawWidth = targetWidth;
        drawHeight = targetHeight;
    } else if (mode === "none") {
        drawWidth = sourceWidth;
        drawHeight = sourceHeight;
    } else {
        const scale = mode === "cover"
            ? Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight)
            : Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
        drawWidth = sourceWidth * scale;
        drawHeight = sourceHeight * scale;
    }

    dx = (targetWidth - drawWidth) / 2;
    dy = (targetHeight - drawHeight) / 2;
    if (mode === "none") {
        dx = 0;
        dy = 0;
    }

    ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
}
