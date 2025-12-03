import type { ChangeEvent } from "react";
import type { ColorInterpolationMode } from "@/utils/colorSpaces";
import type { DistanceFeature, ReductionMode } from "@/types/dither";
import { DISTANCE_FEATURE_LABELS } from "@/utils/paletteDistance";

interface ReductionControlsProps {
    reductionMode: ReductionMode;
    onReductionModeChange: (mode: ReductionMode) => void;
    hasReductionPalette: boolean;
    reductionSwatchCount: number;
    binaryThreshold: number;
    onBinaryThresholdChange: (value: number) => void;
    distanceColorSpace: ColorInterpolationMode;
    onDistanceColorSpaceChange: (event: ChangeEvent<HTMLSelectElement>) => void;
    distanceFeature: DistanceFeature;
    onDistanceFeatureChange: (feature: DistanceFeature) => void;
    supportedDistanceFeatures: DistanceFeature[];
}

export function ReductionControls({
    reductionMode,
    onReductionModeChange,
    hasReductionPalette,
    reductionSwatchCount,
    binaryThreshold,
    onBinaryThresholdChange,
    distanceColorSpace,
    onDistanceColorSpaceChange,
    distanceFeature,
    onDistanceFeatureChange,
    supportedDistanceFeatures,
}: ReductionControlsProps) {
    return (
        <>
            <label>
                Palette Reduction
                <select value={reductionMode} onChange={(event) => onReductionModeChange(event.target.value as ReductionMode)}>
                    <option value="none">Disabled</option>
                    <option value="binary">Binary (per channel)</option>
                    <option value="palette" disabled={!hasReductionPalette}>
                        Use palette ({reductionSwatchCount} colors)
                    </option>
                </select>
            </label>
            {reductionMode === "binary" && (
                <label>
                    Binary Threshold ({binaryThreshold})
                    <input
                        type="range"
                        min={16}
                        max={240}
                        step={1}
                        value={binaryThreshold}
                        onChange={(event) => onBinaryThresholdChange(event.target.valueAsNumber)}
                    />
                </label>
            )}
            {reductionMode === "palette" && (
                <>
                    <label>
                        Palette Distance Space
                        <select value={distanceColorSpace} onChange={onDistanceColorSpaceChange}>
                            <option value="rgb">RGB</option>
                            <option value="hsl">HSL</option>
                            <option value="cmyk">CMYK</option>
                            <option value="lab">LAB</option>
                            <option value="ycbcr">YCbCr</option>
                            <option value="oklch">OKLCH</option>
                        </select>
                    </label>
                    <label>
                        Distance Feature
                        <select
                            value={distanceFeature}
                            onChange={(event) => onDistanceFeatureChange(event.target.value as DistanceFeature)}
                        >
                            {supportedDistanceFeatures.map((feature) => (
                                <option value={feature} key={feature}>
                                    {DISTANCE_FEATURE_LABELS[feature]}
                                </option>
                            ))}
                        </select>
                    </label>
                </>
            )}
        </>
    );
}
