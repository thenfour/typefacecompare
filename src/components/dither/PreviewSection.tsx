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
    showGamutPreview: boolean;
    onToggleGamutPreview: (value: boolean) => void;
    gamutPreviewAvailable: boolean;
    showDitherPreview: boolean;
    onToggleDitherPreview: (value: boolean) => void;
    showReducedPreview: boolean;
    onToggleReducedPreview: (value: boolean) => void;
    showPaletteErrorPreview: boolean;
    onTogglePaletteErrorPreview: (value: boolean) => void;
    paletteErrorPreviewAvailable: boolean;
    showPaletteAmbiguityPreview: boolean;
    onTogglePaletteAmbiguityPreview: (value: boolean) => void;
    paletteAmbiguityPreviewAvailable: boolean;
    showPaletteModulationPreview: boolean;
    onTogglePaletteModulationPreview: (value: boolean) => void;
    paletteModulationPreviewAvailable: boolean;
    sourceCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
    gamutCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
    ditherCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
    reducedCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
    paletteErrorCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
    paletteAmbiguityCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
    paletteModulationCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
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
    showGamutPreview,
    onToggleGamutPreview,
    gamutPreviewAvailable,
    showDitherPreview,
    onToggleDitherPreview,
    showReducedPreview,
    onToggleReducedPreview,
    showPaletteErrorPreview,
    onTogglePaletteErrorPreview,
    paletteErrorPreviewAvailable,
    showPaletteAmbiguityPreview,
    onTogglePaletteAmbiguityPreview,
    paletteAmbiguityPreviewAvailable,
    showPaletteModulationPreview,
    onTogglePaletteModulationPreview,
    paletteModulationPreviewAvailable,
    sourceCanvasRef,
    gamutCanvasRef,
    ditherCanvasRef,
    reducedCanvasRef,
    paletteErrorCanvasRef,
    paletteAmbiguityCanvasRef,
    paletteModulationCanvasRef,
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
                {showGamutPreview && gamutPreviewAvailable && (
                    <GradientPreviewCanvas
                        ref={gamutCanvasRef}
                        title="Gamut Fit"
                        description="Translation + scaling applied"
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
                {showPaletteErrorPreview && paletteErrorPreviewAvailable && (
                    <GradientPreviewCanvas
                        ref={paletteErrorCanvasRef}
                        title="Palette Error"
                        description="Normalized palette distance"
                        width={width}
                        height={height}
                        previewScale={previewScale}
                        devicePixelRatio={devicePixelRatio}
                    />
                )}
                {showPaletteAmbiguityPreview && paletteAmbiguityPreviewAvailable && (
                    <GradientPreviewCanvas
                        ref={paletteAmbiguityCanvasRef}
                        title="Palette Ambiguity"
                        description="Similarity between nearest colors"
                        width={width}
                        height={height}
                        previewScale={previewScale}
                        devicePixelRatio={devicePixelRatio}
                    />
                )}
                {showPaletteModulationPreview && paletteModulationPreviewAvailable && (
                    <GradientPreviewCanvas
                        ref={paletteModulationCanvasRef}
                        title="Palette Modulation"
                        description="Effective dither multiplier"
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
                    <input
                        type="checkbox"
                        checked={showGamutPreview && gamutPreviewAvailable}
                        disabled={!gamutPreviewAvailable}
                        onChange={(event) => onToggleGamutPreview(event.target.checked)}
                    />
                    Gamut Fit
                </label>
                <label>
                    <input type="checkbox" checked={showDitherPreview} onChange={(event) => onToggleDitherPreview(event.target.checked)} /> Dithered
                </label>
                <label>
                    <input type="checkbox" checked={showReducedPreview} onChange={(event) => onToggleReducedPreview(event.target.checked)} /> Palette Reduced
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={showPaletteErrorPreview && paletteErrorPreviewAvailable}
                        disabled={!paletteErrorPreviewAvailable}
                        onChange={(event) => onTogglePaletteErrorPreview(event.target.checked)}
                    />
                    Palette Error
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={showPaletteAmbiguityPreview && paletteAmbiguityPreviewAvailable}
                        disabled={!paletteAmbiguityPreviewAvailable}
                        onChange={(event) => onTogglePaletteAmbiguityPreview(event.target.checked)}
                    />
                    Palette Ambiguity
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={showPaletteModulationPreview && paletteModulationPreviewAvailable}
                        disabled={!paletteModulationPreviewAvailable}
                        onChange={(event) => onTogglePaletteModulationPreview(event.target.checked)}
                    />
                    Palette Modulation
                </label>
            </div>
        </section>
    );
}
