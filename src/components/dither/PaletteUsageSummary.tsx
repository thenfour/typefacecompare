import type { PaletteUsageStats } from "@/hooks/useDitherRenderer";
import type { ReductionPaletteEntry } from "@/utils/paletteDistance";

interface PaletteUsageSummaryProps {
    stats: PaletteUsageStats | null;
    paletteEntries: ReductionPaletteEntry[];
}

const NO_DATA_MESSAGE = "Define a palette to inspect how the reduced image actually uses each entry.";

export function PaletteUsageSummary({ stats, paletteEntries }: PaletteUsageSummaryProps) {
    const hasPalette = paletteEntries.length > 0;
    const hasData = Boolean(stats && hasPalette);
    const entries = hasData && stats ? stats.entries : [];
    const uniformityPercent = stats ? Math.round(stats.uniformityScore * 100) : 0;
    const coveragePercent = stats ? Math.round(stats.coverageRatio * 100) : 0;
    const dominantPercent = stats ? Math.round(stats.dominantShare * 100) : 0;

    return (
        <section className="dither-gradient-card stats-card palette-usage-card">
            <header>
                <strong>Palette Utilization</strong>
                <span>How evenly the reduced result leans on each swatch</span>
            </header>
            {!hasData && (
                <p className="palette-usage-card__empty">{NO_DATA_MESSAGE}</p>
            )}
            {hasData && stats && (
                <>
                    <div className="palette-usage-summary__metrics">
                        <div className="palette-usage-summary__metric" title="Normalized entropy of result usage (100% means the palette is used perfectly evenly).">
                            <span>Uniformity Score</span>
                            <strong>{uniformityPercent}%</strong>
                        </div>
                        <div className="palette-usage-summary__metric" title="Fraction of palette entries that appear in the reduced image.">
                            <span>Palette Coverage</span>
                            <strong>
                                {coveragePercent}% ({stats.usedCount}/{paletteEntries.length})
                            </strong>
                        </div>
                        <div className="palette-usage-summary__metric" title="Share consumed by the most dominant palette entry.">
                            <span>Dominant Share</span>
                            <strong>{dominantPercent}%</strong>
                        </div>
                    </div>
                    <div className="palette-usage-breakdown">
                        {entries.map((entry) => {
                            const palette = paletteEntries[entry.paletteIndex];
                            if (!palette) {
                                return null;
                            }
                            const resultPercent = entry.resultShare * 100;
                            const rgb = palette.rgb;
                            const swatchStyle = { backgroundColor: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` };
                            const usageLabel = `${resultPercent.toFixed(1)}% of pixels`;
                            const unusedLabel = resultPercent === 0 ? "Unused" : usageLabel;
                            return (
                                <div className="palette-usage-row" key={`palette-usage-${entry.paletteIndex}`}>
                                    <div className="palette-usage-row__swatch" style={swatchStyle} aria-hidden="true" />
                                    <div className="palette-usage-row__label">#{entry.paletteIndex + 1}</div>
                                    <div className="palette-usage-row__bars" aria-label={`Palette entry ${entry.paletteIndex + 1} usage`}>
                                        <div className="palette-usage-bar">
                                            <div
                                                className="palette-usage-bar__result"
                                                style={{ width: `${resultPercent}%` }}
                                                aria-hidden="true"
                                            />
                                        </div>
                                        <div className="palette-usage-row__numbers">
                                            <span>{unusedLabel}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </section>
    );
}
