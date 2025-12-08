import type { CSSProperties, MutableRefObject } from "react";
import { GradientPreviewCanvas } from "@/components/GradientPreviewCanvas";
import type { DitherType } from "@/utils/dithering";
import { DITHER_DESCRIPTIONS, DITHER_LABELS } from "@/utils/dithering";
import type { ReductionMode } from "@/types/dither";
import type { PerceptualSimilarityResult } from "@/utils/perceptualSimilarity";

interface SourcePointIndicator {
    id: string;
    x: number;
    y: number;
    color: string;
}

interface PreviewSectionProps {
    sourceSummaryLabel: string;
    ditherType: DitherType;
    showSourcePreview: boolean;
    onToggleSourcePreview: (value: boolean) => void;
    showSourcePointIndicators: boolean;
    onToggleSourcePointIndicators: (value: boolean) => void;
    sourcePointIndicatorAvailable: boolean;
    sourcePointIndicators: SourcePointIndicator[];
    showGamutPreview: boolean;
    onToggleGamutPreview: (value: boolean) => void;
    gamutPreviewAvailable: boolean;
    showDitherPreview: boolean;
    onToggleDitherPreview: (value: boolean) => void;
    showUnditheredPreview: boolean;
    onToggleUnditheredPreview: (value: boolean) => void;
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
    showPerceptualDeltaPreview: boolean;
    onTogglePerceptualDeltaPreview: (value: boolean) => void;
    showPerceptualBlurReferencePreview: boolean;
    onTogglePerceptualBlurReferencePreview: (value: boolean) => void;
    showPerceptualBlurTestPreview: boolean;
    onTogglePerceptualBlurTestPreview: (value: boolean) => void;
    perceptualBlurPreviewAvailable: boolean;
    sourceCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
    gamutCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
    ditherCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
    unditheredCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
    reducedCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
    paletteErrorCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
    paletteAmbiguityCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
    paletteModulationCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
    perceptualDeltaCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
    perceptualBlurReferenceCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
    perceptualBlurTestCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
    width: number;
    height: number;
    previewScale: number;
    devicePixelRatio: number;
    sourceCanvasTitle: string;
    sourceCanvasDescription: string;
    reductionMode: ReductionMode;
    reductionSwatchCount: number;
    perceptualMatch: PerceptualSimilarityResult | null;
    unditheredPerceptualMatch: PerceptualSimilarityResult | null;
}

export function PreviewSection({
    sourceSummaryLabel,
    ditherType,
    showSourcePreview,
    onToggleSourcePreview,
    showSourcePointIndicators,
    onToggleSourcePointIndicators,
    sourcePointIndicatorAvailable,
    sourcePointIndicators,
    showGamutPreview,
    onToggleGamutPreview,
    gamutPreviewAvailable,
    showDitherPreview,
    onToggleDitherPreview,
    showUnditheredPreview,
    onToggleUnditheredPreview,
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
    showPerceptualDeltaPreview,
    onTogglePerceptualDeltaPreview,
    showPerceptualBlurReferencePreview,
    onTogglePerceptualBlurReferencePreview,
    showPerceptualBlurTestPreview,
    onTogglePerceptualBlurTestPreview,
    perceptualBlurPreviewAvailable,
    sourceCanvasRef,
    gamutCanvasRef,
    ditherCanvasRef,
    unditheredCanvasRef,
    reducedCanvasRef,
    paletteErrorCanvasRef,
    paletteAmbiguityCanvasRef,
    paletteModulationCanvasRef,
    perceptualDeltaCanvasRef,
    perceptualBlurReferenceCanvasRef,
    perceptualBlurTestCanvasRef,
    width,
    height,
    previewScale,
    devicePixelRatio,
    sourceCanvasTitle,
    sourceCanvasDescription,
    reductionMode,
    reductionSwatchCount,
    perceptualMatch,
    unditheredPerceptualMatch,
}: PreviewSectionProps) {
    const pixelRatio = devicePixelRatio || 1;
    const scaledWidth = (width * previewScale) / pixelRatio;
    const scaledHeight = (height * previewScale) / pixelRatio;
    const minPanelWidth = Math.max(240, Math.ceil(scaledWidth + 48));
    const minPanelHeight = Math.max(220, Math.ceil(scaledHeight + 96));
    const previewGridStyle: CSSProperties = {
        "--preview-panel-min-width": `${minPanelWidth}px`,
        "--preview-panel-min-height": `${minPanelHeight}px`,
    } as CSSProperties;
    const reducedDescription = buildReducedDescription(reductionMode, reductionSwatchCount, perceptualMatch);
    const unditheredDescription = buildUnditheredDescription(
        reductionMode,
        reductionSwatchCount,
        unditheredPerceptualMatch
    );
    const unditheredPreviewAvailable = reductionMode === "palette" && reductionSwatchCount > 0;

    return (
        <section className="dither-gradient-card preview">
            <header>
                <strong>Gradient Preview</strong>
                <span>
                    {sourceSummaryLabel} • {ditherType === "none" ? "No dithering" : DITHER_LABELS[ditherType]}
                </span>
            </header>
            <div className="preview-canvas-grid-wrapper">
                <div className="preview-canvas-grid" style={previewGridStyle}>
                    {showSourcePreview && (
                        <GradientPreviewCanvas
                            ref={sourceCanvasRef}
                            title={sourceCanvasTitle}
                            description={sourceCanvasDescription}
                            width={width}
                            height={height}
                            previewScale={previewScale}
                            devicePixelRatio={devicePixelRatio}
                            overlay={
                                showSourcePointIndicators &&
                                    sourcePointIndicatorAvailable &&
                                    sourcePointIndicators.length > 0 ? (
                                    <ControlPointOverlay points={sourcePointIndicators} />
                                ) : undefined
                            }
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
                    {showUnditheredPreview && unditheredPreviewAvailable && (
                        <GradientPreviewCanvas
                            ref={unditheredCanvasRef}
                            title="Palette Reduced (No Dither)"
                            description={unditheredDescription}
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
                            description={reducedDescription}
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
                    {showPerceptualDeltaPreview && perceptualBlurPreviewAvailable && (
                        <GradientPreviewCanvas
                            ref={perceptualDeltaCanvasRef}
                            title="Similarity Blur Δ"
                            description="Per-channel delta of blurred buffers"
                            width={width}
                            height={height}
                            previewScale={previewScale}
                            devicePixelRatio={devicePixelRatio}
                        />
                    )}
                    {showPerceptualBlurReferencePreview && perceptualBlurPreviewAvailable && (
                        <GradientPreviewCanvas
                            ref={perceptualBlurReferenceCanvasRef}
                            title="Similarity Blur A"
                            description="Source-adjusted buffer after blur"
                            width={width}
                            height={height}
                            previewScale={previewScale}
                            devicePixelRatio={devicePixelRatio}
                        />
                    )}
                    {showPerceptualBlurTestPreview && perceptualBlurPreviewAvailable && (
                        <GradientPreviewCanvas
                            ref={perceptualBlurTestCanvasRef}
                            title="Similarity Blur B"
                            description="Reduced buffer after blur"
                            width={width}
                            height={height}
                            previewScale={previewScale}
                            devicePixelRatio={devicePixelRatio}
                        />
                    )}
                </div>
            </div>
            <PerceptualMatchSummary
                ditheredMatch={perceptualMatch}
                unditheredMatch={unditheredPerceptualMatch}
            />
            <div className="preview-toggle-list">
                <label>
                    <input type="checkbox" checked={showSourcePreview} onChange={(event) => onToggleSourcePreview(event.target.checked)} /> Source
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={showSourcePointIndicators}
                        disabled={!sourcePointIndicatorAvailable}
                        onChange={(event) => onToggleSourcePointIndicators(event.target.checked)}
                    />
                    Control Points
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
                    <input
                        type="checkbox"
                        checked={showUnditheredPreview && unditheredPreviewAvailable}
                        disabled={!unditheredPreviewAvailable}
                        onChange={(event) => onToggleUnditheredPreview(event.target.checked)}
                    />
                    Palette Reduced (No Dither)
                </label>
                <label>
                    <input type="checkbox" checked={showReducedPreview} onChange={(event) => onToggleReducedPreview(event.target.checked)} /> Palette Reduced (Dithered)
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
                <label>
                    <input
                        type="checkbox"
                        checked={showPerceptualDeltaPreview && perceptualBlurPreviewAvailable}
                        disabled={!perceptualBlurPreviewAvailable}
                        onChange={(event) => onTogglePerceptualDeltaPreview(event.target.checked)}
                    />
                    Similarity Blur Δ
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={showPerceptualBlurReferencePreview && perceptualBlurPreviewAvailable}
                        disabled={!perceptualBlurPreviewAvailable}
                        onChange={(event) => onTogglePerceptualBlurReferencePreview(event.target.checked)}
                    />
                    Similarity Blur A
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={showPerceptualBlurTestPreview && perceptualBlurPreviewAvailable}
                        disabled={!perceptualBlurPreviewAvailable}
                        onChange={(event) => onTogglePerceptualBlurTestPreview(event.target.checked)}
                    />
                    Similarity Blur B
                </label>
            </div>
        </section>
    );
}

function buildReducedDescription(
    reductionMode: ReductionMode,
    reductionSwatchCount: number,
    perceptualMatch: PerceptualSimilarityResult | null
) {
    if (reductionMode !== "palette") {
        return "Disabled";
    }
    const baseLabel = `Palette (${reductionSwatchCount})`;
    if (!perceptualMatch) {
        return baseLabel;
    }
    return `${baseLabel} • Match ${perceptualMatch.score.toFixed(1)}/100`;
}

function buildUnditheredDescription(
    reductionMode: ReductionMode,
    reductionSwatchCount: number,
    perceptualMatch: PerceptualSimilarityResult | null
) {
    if (reductionMode !== "palette") {
        return "Disabled";
    }
    const baseLabel = `Palette (${reductionSwatchCount}) • No Dither`;
    if (!perceptualMatch) {
        return baseLabel;
    }
    return `${baseLabel} • Match ${perceptualMatch.score.toFixed(1)}/100`;
}

interface ControlPointOverlayProps {
    points: SourcePointIndicator[];
}

function ControlPointOverlay({ points }: ControlPointOverlayProps) {
    return (
        <div className="preview-stage__overlay" aria-hidden="true">
            {points.map((point) => (
                <div
                    key={point.id}
                    className="preview-stage__control-point"
                    style={{
                        left: `${point.x * 100}%`,
                        top: `${point.y * 100}%`,
                        backgroundColor: point.color,
                    }}
                />
            ))}
        </div>
    );
}

function ProgressBar({ progress, caption }: { progress: number, caption?: string }) {
    const clampedProgress = Math.min(100, Math.max(0, progress));
    const barStyle: CSSProperties = {
        width: `${clampedProgress}%`,
    };
    return (
        <div className="progress-bar">
            <div className="progress-bar__fill" style={barStyle} />
            {caption && <div className="progress-bar__caption">{caption}</div>}
        </div>
    );
}

function PerceptualMatchSummary({
    ditheredMatch,
    unditheredMatch,
}: {
    ditheredMatch: PerceptualSimilarityResult | null;
    unditheredMatch: PerceptualSimilarityResult | null;
}) {
    const entries = [
        { key: "dithered", label: "With Dither", match: ditheredMatch },
        { key: "undithered", label: "No Dither", match: unditheredMatch },
    ].filter((entry) => entry.match) as { key: string; label: string; match: PerceptualSimilarityResult }[];
    const hasScores = entries.length > 0;
    const scoreDelta = ditheredMatch && unditheredMatch ? ditheredMatch.score - unditheredMatch.score : null;
    return (
        <div className="perceptual-match-banner">
            <div className="perceptual-match-banner__primary">
                <strong>Perceptual Match</strong>
                {hasScores && scoreDelta !== null && (
                    <span className="perceptual-match-banner__delta">
                        {scoreDelta >= 0 ? "+" : ""}
                        {scoreDelta.toFixed(2)} pts vs no dither
                    </span>
                )}
            </div>
            {hasScores ? (
                <div className="perceptual-match-banner__rows">
                    {entries.map((entry) => (
                        <div key={entry.key} className="perceptual-match-banner__row">
                            <div className="perceptual-match-banner__row-label">{entry.label}</div>
                            <ProgressBar
                                progress={entry.match.score}
                                caption={`${entry.match.score.toFixed(2)} / 100`}
                            />
                            <div className="perceptual-match-banner__row-meta">
                                <span>Blur sigma {entry.match.blurRadiusPx.toFixed(2)} px</span>
                                <span>Mean delta {entry.match.meanDelta.toFixed(4)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="perceptual-match-banner__empty">
                    Provide a palette reduction to compute similarity against the source.
                </p>
            )}
        </div>
    );
}
