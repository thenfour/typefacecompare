import type { MutableRefObject } from "react";
import { GradientPreviewCanvas } from "@/components/GradientPreviewCanvas";
import type { DitherType } from "@/utils/dithering";
import { DITHER_DESCRIPTIONS, DITHER_LABELS } from "@/utils/dithering";
import type { ReductionMode } from "@/types/dither";

interface PreviewSectionProps {
    sourceSummaryLabel: string;
    ditherType: DitherType;
    showSourcePreview: boolean;
    onToggleSourcePreview: (value: boolean) => void;
    showDitherPreview: boolean;
    onToggleDitherPreview: (value: boolean) => void;
    showReducedPreview: boolean;
    onToggleReducedPreview: (value: boolean) => void;
    sourceCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
    ditherCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
    reducedCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
    width: number;
    height: number;
    previewScale: number;
    devicePixelRatio: number;
    sourceCanvasTitle: string;
    sourceCanvasDescription: string;
    reductionMode: ReductionMode;
    reductionSwatchCount: number;
}

export function PreviewSection({
    sourceSummaryLabel,
    ditherType,
    showSourcePreview,
    onToggleSourcePreview,
    showDitherPreview,
    onToggleDitherPreview,
    showReducedPreview,
    onToggleReducedPreview,
    sourceCanvasRef,
    ditherCanvasRef,
    reducedCanvasRef,
    width,
    height,
    previewScale,
    devicePixelRatio,
    sourceCanvasTitle,
    sourceCanvasDescription,
    reductionMode,
    reductionSwatchCount,
}: PreviewSectionProps) {
    return (
        <section className="dither-gradient-card preview">
            <header>
                <strong>Gradient Preview</strong>
                <span>
                    {sourceSummaryLabel} • {ditherType === "none" ? "No dithering" : DITHER_LABELS[ditherType]}
                </span>
            </header>
            <div className="preview-canvas-grid">
                {showSourcePreview && (
                    <GradientPreviewCanvas
                        ref={sourceCanvasRef}
                        title={sourceCanvasTitle}
                        description={sourceCanvasDescription}
                        width={width}
                        height={height}
                        previewScale={previewScale}
                        devicePixelRatio={devicePixelRatio}
                    />
                )}
                {showDitherPreview && (
                    <GradientPreviewCanvas
                        ref={ditherCanvasRef}
                        title="Dither Applied"
                        description={DITHER_DESCRIPTIONS[ditherType]}
                        width={width}
                        height={height}
                        previewScale={previewScale}
                        devicePixelRatio={devicePixelRatio}
                    />
                )}
                {showReducedPreview && (
                    <GradientPreviewCanvas
                        ref={reducedCanvasRef}
                        title="Palette Reduced"
                        description={
                            reductionMode === "palette"
                                ? `Palette (${reductionSwatchCount})`
                                : "Disabled"
                        }
                        width={width}
                        height={height}
                        previewScale={previewScale}
                        devicePixelRatio={devicePixelRatio}
                    />
                )}
            </div>
            <div className="preview-toggle-list">
                <label>
                    <input type="checkbox" checked={showSourcePreview} onChange={(event) => onToggleSourcePreview(event.target.checked)} /> Source
                </label>
                <label>
                    <input type="checkbox" checked={showDitherPreview} onChange={(event) => onToggleDitherPreview(event.target.checked)} /> Dithered
                </label>
                <label>
                    <input type="checkbox" checked={showReducedPreview} onChange={(event) => onToggleReducedPreview(event.target.checked)} /> Palette Reduced
                </label>
            </div>
        </section>
    );
}
