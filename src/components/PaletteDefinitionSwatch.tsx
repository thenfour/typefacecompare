import { DragEventHandler, ReactNode } from "react";
import { PaletteSwatchDefinition } from "../types/paletteDefinition";
import { Tooltip } from "./Tooltip";
import { hexToRgb, relativeLuminance } from "../utils/color";
import { rgbUnitToVector } from "../utils/colorSpaces";

type PaletteDefinitionSwatchProps = {
    swatch: PaletteSwatchDefinition;
    onClick?: (swatch: PaletteSwatchDefinition) => void;
    draggable?: boolean;
    onDragStart?: DragEventHandler<HTMLDivElement>;
};

type ColorTooltipInfo = ReturnType<typeof collectColorInfo>;

const collectColorInfo = (hex: string) => {
    const rgbUnit = hexToRgb(hex);
    const luminance = relativeLuminance(rgbUnit);
    const hsl = rgbUnitToVector(rgbUnit, "hsl") as { h: number; s: number; l: number };
    const lab = rgbUnitToVector(rgbUnit, "lab") as { l: number; a: number; b: number };
    const oklch = rgbUnitToVector(rgbUnit, "oklch") as { L: number; C: number; h: number };
    const ycbcr = rgbUnitToVector(rgbUnit, "ycbcr") as { y: number; cb: number; cr: number };

    return {
        rgb: {
            r: Math.round(rgbUnit.r * 255),
            g: Math.round(rgbUnit.g * 255),
            b: Math.round(rgbUnit.b * 255),
        },
        luminance,
        hsl,
        lab,
        oklch,
        ycbcr,
    };
};

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;
const formatNumber = (value: number, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : "—";
const formatAngle = (value: number) => `${Math.round(((value % 360) + 360) % 360)}°`;

const buildTooltip = (swatch: PaletteSwatchDefinition, colorInfo: ColorTooltipInfo): ReactNode => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontWeight: 600 }}>{swatch.hex}</div>
        {swatch.comment && <div style={{ fontStyle: "italic" }}>{swatch.comment}</div>}
        <div>RGB: {colorInfo.rgb.r}, {colorInfo.rgb.g}, {colorInfo.rgb.b}</div>
        <div>HSL: {formatAngle(colorInfo.hsl.h)}, {formatPercent(colorInfo.hsl.s)}, {formatPercent(colorInfo.hsl.l)}</div>
        <div>LAB: L {formatNumber(colorInfo.lab.l, 1)}, a {formatNumber(colorInfo.lab.a, 1)}, b {formatNumber(colorInfo.lab.b, 1)}</div>
        <div>OKLCH: L {formatNumber(colorInfo.oklch.L, 3)}, C {formatNumber(colorInfo.oklch.C, 3)}, h {formatAngle(colorInfo.oklch.h)}</div>
        <div>YCbCr: Y {formatNumber(colorInfo.ycbcr.y, 3)}, Cb {formatNumber(colorInfo.ycbcr.cb, 3)}, Cr {formatNumber(colorInfo.ycbcr.cr, 3)}</div>
        <div>Luminance: {formatPercent(colorInfo.luminance)}</div>
        <div>Ordinal #{swatch.ordinal + 1}</div>
        <div>Row {swatch.rowIndex + 1} · Column {swatch.columnIndex + 1}</div>
        <div>Line {swatch.lineIndex + 1}</div>
    </div>
);

export function PaletteDefinitionSwatch({ swatch, onClick, draggable = true, onDragStart }: PaletteDefinitionSwatchProps) {
    const colorInfo = collectColorInfo(swatch.hex);
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
