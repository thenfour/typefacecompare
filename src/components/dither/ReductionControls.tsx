import type { ColorInterpolationMode } from "@/utils/colorSpaces";
import type { DistanceFeature, ReductionMode } from "@/types/dither";
import { DISTANCE_FEATURE_LABELS } from "@/utils/paletteDistance";
import { OptionButtonGroup } from "@/components/dither/OptionButtonGroup";

interface ReductionControlsProps {
    reductionMode: ReductionMode;
    onReductionModeChange: (mode: ReductionMode) => void;
    hasReductionPalette: boolean;
    reductionSwatchCount: number;
    distanceColorSpace: ColorInterpolationMode;
    onDistanceColorSpaceChange: (mode: ColorInterpolationMode) => void;
    distanceFeature: DistanceFeature;
    onDistanceFeatureChange: (feature: DistanceFeature) => void;
    supportedDistanceFeatures: DistanceFeature[];
}

export function ReductionControls({
    reductionMode,
    onReductionModeChange,
    hasReductionPalette,
    reductionSwatchCount,
    distanceColorSpace,
    onDistanceColorSpaceChange,
    distanceFeature,
    onDistanceFeatureChange,
    supportedDistanceFeatures,
}: ReductionControlsProps) {
    return (
        <>
            <div>
                <span style={{ fontSize: 12, color: "#555" }}>Palette Reduction</span>
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
                        <span style={{ fontSize: 12, color: "#555" }}>Palette Distance Space</span>
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
                                { value: "lab", label: "LAB" },
                                { value: "oklab", label: "OKLab" },
                                { value: "ycbcr", label: "YCbCr" },
                                { value: "oklch", label: "OKLCH" },
                            ]}
                        />
                    </div>
                    <div>
                        <span style={{ fontSize: 12, color: "#555" }}>Distance Feature</span>
                        <OptionButtonGroup
                            value={distanceFeature}
                            onChange={onDistanceFeatureChange}
                            ariaLabel="Palette distance feature"
                            options={supportedDistanceFeatures.map((feature) => ({
                                value: feature,
                                label: DISTANCE_FEATURE_LABELS[feature],
                            }))}
                        />
                    </div>
                </>
            )}
        </>
    );
}
