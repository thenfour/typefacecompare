import { ChangeEvent, ReactNode } from "react";
import { PaletteDefinitionViewer } from "@/components/PaletteDefinitionViewer";
import { PalettePresetButtons } from "@/components/PalettePresetButtons";
import { LospecPaletteImporter } from "@/components/LospecPaletteImporter";
import { OptionButtonGroup } from "@/components/dither/OptionButtonGroup";
import type { PaletteRow, PaletteSwatchDefinition } from "@/types/paletteDefinition";
import type { SourceType } from "@/types/dither";
import type { ColorInterpolationMode } from "@/utils/colorSpaces";
import { ImageSourceControls, type ImageSourceControlsProps } from "@/components/dither/ImageSourceControls";

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
}: GradientControlsProps) {
    const interpolationOptions: { value: ColorInterpolationMode; label: string }[] = [
        { value: "rgb", label: "RGB" },
        { value: "hsl", label: "HSL" },
        { value: "hsv", label: "HSV" },
        { value: "hwb", label: "HWB" },
        { value: "ryb", label: "RYB" },
        { value: "cmy", label: "CMY" },
        { value: "cmyk", label: "CMYK" },
        { value: "luma-rgb", label: "Luma (RGB)" },
        { value: "luma-lab", label: "Luma (Lab)" },
        { value: "luma-oklab", label: "Luma (OKLab)" },
        { value: "lab", label: "LAB" },
        { value: "oklab", label: "OKLab" },
        { value: "ycbcr", label: "YCbCr" },
        { value: "oklch", label: "OKLCH" },
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
