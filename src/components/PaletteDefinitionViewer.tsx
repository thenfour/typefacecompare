import { PaletteRow, PaletteSwatchDefinition } from "../types/paletteDefinition";
import { PaletteDefinitionSwatch } from "./PaletteDefinitionSwatch";

type PaletteDefinitionViewerProps = {
    rows: PaletteRow[];
    swatches: PaletteSwatchDefinition[];
    onSwatchClick?: (swatch: PaletteSwatchDefinition) => void;
};

export function PaletteDefinitionViewer({ rows, swatches, onSwatchClick }: PaletteDefinitionViewerProps) {
    return (
        <div className="palette-definition-viewer">
            <div className="palette-definition-viewer-header">
                <strong>Palette Viewer</strong>
                <div className="palette-definition-meta">
                    <span>{swatches.length} swatch{subscript(swatches.length)}</span>
                    <span>{rows.length} row{subscript(rows.length)}</span>
                </div>
            </div>

            {swatches.length === 0 ? (
                <div className="palette-definition-empty-state">
                    Paste or type RGB lines on the left to preview the palette here.
                </div>
            ) : (
                <div className="palette-definition-grid">
                    {rows.map((row, rowIndex) => (
                        <div key={`row-${rowIndex}`} className="palette-definition-row">
                            {row.map((swatch) => (
                                <PaletteDefinitionSwatch
                                    key={swatch.tokenId}
                                    swatch={swatch}
                                    onClick={onSwatchClick}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

const subscript = (value: number) => (value === 1 ? "" : "s");
