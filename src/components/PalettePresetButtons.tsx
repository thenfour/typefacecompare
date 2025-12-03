interface PalettePreset {
    label: string;
    value: string;
}

interface PalettePresetButtonsProps {
    presets: ReadonlyArray<PalettePreset>;
    onSelect(value: string): void;
    className?: string;
}

export function PalettePresetButtons({ presets, onSelect, className }: PalettePresetButtonsProps) {
    if (presets.length === 0) {
        return null;
    }

    const classNames = ["palette-presets", className].filter(Boolean).join(" ");

    return (
        <div className={classNames}>
            {presets.map((preset) => (
                <button type="button" key={preset.label} onClick={() => onSelect(preset.value)}>
                    {preset.label}
                </button>
            ))}
        </div>
    );
}
