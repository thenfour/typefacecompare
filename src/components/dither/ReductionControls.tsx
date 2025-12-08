import type { ColorInterpolationMode } from "@/utils/colorSpaces";
import type { ReductionMode } from "@/types/dither";
import { OptionButtonGroup } from "@/components/dither/OptionButtonGroup";

interface ReductionControlsProps {
    reductionMode: ReductionMode;
    onReductionModeChange: (mode: ReductionMode) => void;
    hasReductionPalette: boolean;
    reductionSwatchCount: number;
    distanceColorSpace: ColorInterpolationMode;
    onDistanceColorSpaceChange: (mode: ColorInterpolationMode) => void;
}

export function ReductionControls({
    reductionMode,
    onReductionModeChange,
    hasReductionPalette,
    reductionSwatchCount,
    distanceColorSpace,
    onDistanceColorSpaceChange,
}: ReductionControlsProps) {
    return (
        <>
            <div>
                <OptionButtonGroup
                    value={reductionMode}
                    onChange={onReductionModeChange}
                    ariaLabel="Palette reduction mode"
                    options={[
                        { value: "none", label: "Disabled" },
                        { value: "palette", label: `Palette (${reductionSwatchCount})`, disabled: !hasReductionPalette },
                    ]}
                />
            </div>
            {reductionMode === "palette" && (
                <>
                    <div>
                        <span style={{ fontSize: 12, color: "#555" }}>Color Distance Space</span>
                        <OptionButtonGroup
                            value={distanceColorSpace}
                            onChange={onDistanceColorSpaceChange}
                            ariaLabel="Palette distance space"
                            options={[
                                { value: "rgb", label: "RGB", hint: "Fast euclidean RGB—ignores perception." },
                                { value: "hsl", label: "HSL", hint: "Hue/lightness weighting; unstable near grays." },
                                { value: "hsv", label: "HSV", hint: "Value-heavy metric that favors vivid primaries." },
                                { value: "hwb", label: "HWB", hint: "White/black emphasis to protect highlights." },
                                { value: "cmy", label: "CMY", hint: "Subtracts CMY inks; mirrors print coverage." },
                                { value: "cmyk", label: "CMYK", hint: "Adds black channel; suits print-focused palettes." },
                                { value: "luma-rgb", label: "Luma (RGB)", hint: "Compares grayscale brightness only." },
                                { value: "luma-lab", label: "Luma (Lab)", hint: "Lab lightness delta only—hue ignored." },
                                { value: "luma-oklab", label: "Luma (OKLab)", hint: "OKLab lightness delta to isolate value errors." },
                                { value: "lab", label: "LAB", hint: "CIELAB ΔE—classic perceptual metric." },
                                { value: "oklab", label: "OKLab", hint: "Modern perceptual metric—balanced default." },
                                { value: "ycbcr", label: "YCbCr", hint: "Video-style chroma distance; soft on hue shifts." },
                                { value: "oklch", label: "OKLCH", hint: "Perceptual polar metric separating hue/chroma." },
                            ]}
                        />
                    </div>
                </>
            )}
        </>
    );
}
