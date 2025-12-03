import { DragEventHandler, ReactNode } from "react";
import { PaletteSwatchDefinition } from "../types/paletteDefinition";
import { Tooltip } from "./Tooltip";
import { hexToRgb, relativeLuminance } from "../utils/color";

type PaletteDefinitionSwatchProps = {
    swatch: PaletteSwatchDefinition;
    onClick?: (swatch: PaletteSwatchDefinition) => void;
    draggable?: boolean;
    onDragStart?: DragEventHandler<HTMLDivElement>;
};

const rgb255 = (hex: string) => {
    const rgb = hexToRgb(hex);
    return {
        r: Math.round(rgb.r * 255),
        g: Math.round(rgb.g * 255),
        b: Math.round(rgb.b * 255),
        luminance: relativeLuminance(rgb),
    };
};

const buildTooltip = (swatch: PaletteSwatchDefinition, colorInfo: { r: number; g: number; b: number; luminance: number }): ReactNode => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontWeight: 600 }}>{swatch.hex}</div>
        {swatch.comment && <div style={{ fontStyle: "italic" }}>{swatch.comment}</div>}
        <div>RGB: {colorInfo.r}, {colorInfo.g}, {colorInfo.b}</div>
        <div>Ordinal #{swatch.ordinal + 1}</div>
        <div>Row {swatch.rowIndex + 1} · Column {swatch.columnIndex + 1}</div>
        <div>Line {swatch.lineIndex + 1}</div>
    </div>
);

export function PaletteDefinitionSwatch({ swatch, onClick, draggable = true, onDragStart }: PaletteDefinitionSwatchProps) {
    const colorInfo = rgb255(swatch.hex);
    const fg = colorInfo.luminance > 0.55 ? "rgba(0, 0, 0, 0.64)" : "rgba(255, 255, 255, 0.82)";

    return (
        <Tooltip title={buildTooltip(swatch, colorInfo)}>
            <div
                className="palette-definition-swatch"
                style={{ backgroundColor: swatch.hex, color: fg }}
                onClick={() => onClick?.(swatch)}
                draggable={draggable}
                onDragStart={onDragStart}
                data-ordinal={swatch.ordinal}
            >
                {swatch.hex.replace("#", "")}
            </div>
        </Tooltip>
    );
}
