import React from "react";
import { PaletteSwatch } from "../types/palette";

type PaletteSwatchCardProps = {
    swatch: PaletteSwatch;
    index: number;
    labelHex: string;
    showSimilarColors: boolean;
    enableVariations: boolean;
    closestColor: PaletteSwatch | null;
};

export function PaletteSwatchCard({
    swatch,
    index,
    labelHex,
    showSimilarColors,
    enableVariations,
    closestColor
}: PaletteSwatchCardProps) {

    closestColor = showSimilarColors ? closestColor : null;


    return (<>
        <div className={`palette-lab-card ${swatch.isTooSimilar ? 'similar' : ''}`}>
            <div className="palette-lab-swatch-comparison">
                <div className="palette-lab-swatch-main" style={{ background: swatch.hex }}>
                    <div>
                        <span style={{ color: labelHex, fontWeight: 600 }}>{`Band ${index + 1}`}</span>
                        <span className="palette-lab-pill" style={{ color: "#111" }}>{swatch.hex}</span>
                        <div>
                            <div>contrast: {swatch.ratio.toFixed(1)}:1</div>
                            <div>h≈{Math.round(swatch.h)}° · L={swatch.L.toFixed(3)} · C={swatch.C.toFixed(3)}</div>
                        </div>
                        {enableVariations && swatch.variations.length > 0 && (
                            <div className="palette-lab-swatch-variations" style={{ paddingBottom: 20 }}>
                                {swatch.variations.map((variation, vi) => (
                                    <div key={vi} className="palette-lab-variation-swatch" style={{ background: variation.hex }}>
                                        {variation.hex}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                {closestColor && (
                    <div className="palette-lab-swatch-closest" style={{ background: closestColor.hex }}>
                        <span className="palette-lab-closest-label">#{swatch.closestIndex + 1}</span>
                        {showSimilarColors && (
                            <div className="palette-lab-similarity-info">
                                closest: Band #{swatch.closestIndex + 1}
                                <div>ΔE={swatch.closestDistance.toFixed(1)}</div>
                                {swatch.isTooSimilar && <span className="palette-lab-too-similar"> (too similar!)</span>}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
        {enableVariations && swatch.variations.length > 0 && (
            <div className="palette-lab-swatch-variations" style={{ paddingBottom: 20 }}>
                {swatch.variations.map((variation, vi) => (
                    <div key={vi} className="palette-lab-variation-swatch" style={{ background: variation.hex }}>
                        {variation.hex}
                    </div>
                ))}
            </div>
        )}
    </>
    );
}
