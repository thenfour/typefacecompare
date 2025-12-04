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
                            ]}
                        />
                    </div>
                </>
            )}
        </>
    );
}
