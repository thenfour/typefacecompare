import { ChangeEvent, type ReactNode } from "react";
import { PaletteDefinitionViewer } from "@/components/PaletteDefinitionViewer";
import { PalettePresetButtons } from "@/components/PalettePresetButtons";
import { LospecPaletteImporter } from "@/components/LospecPaletteImporter";
import type { PaletteRow, PaletteSwatchDefinition } from "@/types/paletteDefinition";

interface PaletteEditorCardProps {
    title: string;
    subtitle?: string;
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
    renderStandalone?: boolean;
}

export function PaletteEditorCard({
    title,
    subtitle,
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
    renderStandalone = true,
}: PaletteEditorCardProps) {
    const content = (
        <div className="palette-editor">
            <PalettePresetButtons presets={presets} onSelect={onSelectPreset} />
            <LospecPaletteImporter targetLabel={lospecTargetLabel} onApplyPalette={onChangeValue} />
            <div className="palette-editor__inputs">
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

    if (!renderStandalone) {
        return content;
    }

    return (
        <section className="dither-gradient-card palette">
            <header>
                <strong>
                    {title}
                    {subtitle ? ` ${subtitle}` : ""}
                </strong>
                <span>{swatchCountLabel}</span>
            </header>
            {content}
        </section>
    );
}
