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
}: PaletteEditorCardProps) {
    return (
        <section className="dither-gradient-card palette">
            <header>
                <strong>
                    {title}
                    {subtitle ? ` ${subtitle}` : ""}
                </strong>
                <span>{swatchCountLabel}</span>
            </header>
            <PalettePresetButtons presets={presets} onSelect={onSelectPreset} />
            <LospecPaletteImporter targetLabel={lospecTargetLabel} onApplyPalette={onChangeValue} />
            <div style={{ display: "flex" }}>
                <textarea
                    value={value}
                    onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChangeValue(event.target.value)}
                    spellCheck={false}
                    placeholder={placeholder}
                />
                <PaletteDefinitionViewer swatches={swatches} rows={rows} />
            </div>
            {footer}
        </section>
    );
}
