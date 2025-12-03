import { ForwardedRef, forwardRef } from "react";

interface GradientPreviewCanvasProps {
    title: string;
    description?: string;
    width: number;
    height: number;
    previewScale: number;
    devicePixelRatio?: number | null;
}

export const GradientPreviewCanvas = forwardRef(function GradientPreviewCanvas(
    { title, description, width, height, previewScale, devicePixelRatio }: GradientPreviewCanvasProps,
    ref: ForwardedRef<HTMLCanvasElement>
) {
    const pixelRatio = devicePixelRatio || 1;
    const scaledWidth = (width * previewScale) / pixelRatio;
    const scaledHeight = (height * previewScale) / pixelRatio;

    return (
        <div className="gradient-preview-panel">
            <header>
                <strong>{title}</strong>
                {description && <span>{description}</span>}
            </header>
            <div className="preview-stage">
                <canvas
                    ref={ref}
                    style={{ width: scaledWidth, height: scaledHeight, imageRendering: "pixelated" }}
                />
            </div>
        </div>
    );
});
