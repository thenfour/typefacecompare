import { ChangeEvent, ReactNode } from "react";
import { PaletteDefinitionViewer } from "@/components/PaletteDefinitionViewer";
import { PalettePresetButtons } from "@/components/PalettePresetButtons";
import { LospecPaletteImporter } from "@/components/LospecPaletteImporter";
import { OptionButtonGroup } from "@/components/dither/OptionButtonGroup";
import type { PaletteRow, PaletteSwatchDefinition } from "@/types/paletteDefinition";
import type { SourceType } from "@/types/dither";
import type { ColorInterpolationMode } from "@/utils/colorSpaces";
import { ImageSourceControls, type ImageSourceControlsProps } from "@/components/dither/ImageSourceControls";
import type { GradientAutoPlacementMode } from "@/utils/gradientField";

interface GradientControlsProps {
    swatchCountLabel: string;
    presets: ReadonlyArray<{ label: string; value: string }>;
    onSelectPreset: (value: string) => void;
    lospecTargetLabel: string;
    value: string;
    onChangeValue: (value: string) => void;
    placeholder?: string;
    swatches: PaletteSwatchDefinition[];
    rows: PaletteRow[];
    footer?: ReactNode;
    interpolationMode: ColorInterpolationMode;
    onInterpolationModeChange: (mode: ColorInterpolationMode) => void;
    autoPlacementMode: GradientAutoPlacementMode;
    onAutoPlacementModeChange: (mode: GradientAutoPlacementMode) => void;
    interpolationCurve: number;
    onInterpolationCurveChange: (value: number) => void;
}

interface SourceControlsCardProps {
    sourceType: SourceType;
    onSourceTypeChange: (type: SourceType) => void;
    sourceSummary: string;
    gradientControls: GradientControlsProps;
    imageControls: ImageSourceControlsProps;
}

export function SourceControlsCard({
    sourceType,
    onSourceTypeChange,
    sourceSummary,
    gradientControls,
    imageControls,
}: SourceControlsCardProps) {
    return (
        <section className="dither-gradient-card source-card">
            <header>
                <strong>Source</strong>
                <span>{sourceSummary}</span>
            </header>
            <div className="source-card__mode-toggle" role="tablist" aria-label="Source type">
                <button
                    type="button"
                    className={`source-card__mode ${sourceType === "gradient" ? "is-active" : ""}`}
                    onClick={() => onSourceTypeChange("gradient")}
                    aria-pressed={sourceType === "gradient"}
                >
                    Gradient
                </button>
                <button
                    type="button"
                    className={`source-card__mode ${sourceType === "image" ? "is-active" : ""}`}
                    onClick={() => onSourceTypeChange("image")}
                    aria-pressed={sourceType === "image"}
                >
                    Image
                </button>
            </div>
            {sourceType === "gradient" ? renderGradientControls(gradientControls) : <ImageSourceControls {...imageControls} />}
        </section>
    );
}

function renderGradientControls({
    swatchCountLabel,
    presets,
    onSelectPreset,
    lospecTargetLabel,
    value,
    onChangeValue,
    placeholder,
    swatches,
    rows,
    footer,
    interpolationMode,
    onInterpolationModeChange,
    autoPlacementMode,
    onAutoPlacementModeChange,
    interpolationCurve,
    onInterpolationCurveChange,
}: GradientControlsProps) {
    const interpolationOptions: Array<{ value: ColorInterpolationMode; label: string; hint: string }> = [
        { value: "rgb", label: "RGB", hint: "Linear mix that matches pixel strength." },
        { value: "hsl", label: "HSL", hint: "Keeps lightness separate so hue sweeps feel painterly." },
        { value: "hsv", label: "HSV", hint: "Holds value steady for bright UI-style gradients." },
        { value: "luma-rgb", label: "Luma (RGB)", hint: "Only brightness changes; hue stays locked to corners." },
        { value: "luma-lab", label: "Luma (Lab)", hint: "Lab lightness-only sweeps for perceptual fades." },
        { value: "luma-oklab", label: "Luma (OKLab)", hint: "OKLab lightness-only; smooth, modern value ramps." },
        { value: "lab", label: "LAB", hint: "Perceptual axes that preserve luminance structure." },
        { value: "oklab", label: "OKLab", hint: "Modern perceptual mix—reliable default for gradients." },
        { value: "ycbcr", label: "YCbCr", hint: "Video luma/chroma split for gentle hue drift." },
        { value: "oklch", label: "OKLCH", hint: "Perceptual polar space for even hue rotations." },
    ];

    const placementOptions: { value: GradientAutoPlacementMode; label: string }[] = [
        { value: "perimeter", label: "Perimeter" },
        { value: "radial", label: "Radial" },
        { value: "grid", label: "Grid" },
    ];

    return (
        <div className="source-card__gradient-panel">
            <div className="source-card__meta">{swatchCountLabel}</div>
            <div className="source-card__interpolation">
                <span>Interpolation Space</span>
                <OptionButtonGroup
                    value={interpolationMode}
                    onChange={onInterpolationModeChange}
                    options={interpolationOptions}
                    ariaLabel="Interpolation space"
                />
            </div>
            <div className="source-card__interpolation">
                <span>Auto Placement</span>
                <OptionButtonGroup
                    value={autoPlacementMode}
                    onChange={onAutoPlacementModeChange}
                    options={placementOptions}
                    ariaLabel="Auto placement strategy"
                />
            </div>
            <label className="source-card__slider">
                <div>
                    <span>Interpolation Curve</span>
                    <small>({(interpolationCurve * 100).toFixed(0)}%)</small>
                </div>
                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={interpolationCurve}
                    onChange={(event) => onInterpolationCurveChange(event.target.valueAsNumber)}
                />
            </label>
            <PalettePresetButtons presets={presets} onSelect={onSelectPreset} />
            <LospecPaletteImporter targetLabel={lospecTargetLabel} onApplyPalette={onChangeValue} />
            <div className="source-card__gradient-editor">
                <textarea
                    value={value}
                    onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChangeValue(event.target.value)}
                    spellCheck={false}
                    placeholder={placeholder}
                />
                <PaletteDefinitionViewer swatches={swatches} rows={rows} />
            </div>
            {footer}
        </div>
    );
}
