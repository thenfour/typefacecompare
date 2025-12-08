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
                                { value: "rgb", label: "RGB", hint: "Fast but imperfect luma (tuned for devices not eyes)." },
                                { value: "hsl", label: "HSL", hint: "Not suitable - hue is less defined as S->0, and not perceptual luma" },
                                { value: "hsv", label: "HSV", hint: "Not suitable (see hsl), V is even worse than L for deltaE" },
                                { value: "hwb", label: "HWB", hint: "Not suitable (see hsl), W/B are worse than L for deltaE" },
                                { value: "cmy", label: "CMY", hint: "Linear subtractive space; still not perceptual but predictable." },
                                { value: "cmyk", label: "CMYK", hint: "Euclidean CMYK overweights K; best when matching print plates." },
                                { value: "luma-rgb", label: "Luma (RGB)", hint: "Viable: fast" },
                                { value: "luma-lab", label: "Luma (Lab)", hint: "Good: Perceptual curves" },
                                { value: "luma-oklab", label: "Luma (OKLab)", hint: "✅Best: perceptually-orthogonal curves." },
                                { value: "lab", label: "LAB", hint: "CIELAB assumes ΔE; Euclidean works but clips at gamut edges." },
                                { value: "oklab", label: "OKLab", hint: "Designed for Euclidean ΔE—recommended general purpose." },
                                { value: "ycbcr", label: "YCbCr", hint: "Broadcast luma/chroma; Euclidean exaggerates blue/yellow." },
                                { value: "oklch", label: "OKLCH", hint: "Polar axes—Euclidean fails near the hue wrap, use OKLab instead." },
                            ]}
                        />
                    </div>
                </>
            )}
        </>
    );
}
