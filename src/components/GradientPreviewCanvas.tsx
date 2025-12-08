import { ForwardedRef, forwardRef, type ReactNode } from "react";

interface GradientPreviewCanvasProps {
    title: string;
    description?: string;
    width: number;
    height: number;
    previewScale: number;
    devicePixelRatio?: number | null;
    overlay?: ReactNode;
}

export const GradientPreviewCanvas = forwardRef(function GradientPreviewCanvas(
    { title, description, width, height, previewScale, devicePixelRatio, overlay }: GradientPreviewCanvasProps,
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
                <div className="preview-stage__canvas-wrapper" style={{ width: scaledWidth, height: scaledHeight }}>
                    <canvas
                        ref={ref}
                        style={{ width: "100%", height: "100%", imageRendering: "pixelated" }}
                    />
                    {overlay && <div className="preview-stage__overlay">{overlay}</div>}
                </div>
            </div>
        </div>
    );
});
