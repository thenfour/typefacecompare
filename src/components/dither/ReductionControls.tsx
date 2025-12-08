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
                                //{ value: "hsl", label: "HSL", hint: "Not suitable - hue is less defined as S->0, and not perceptual luma" },
                                //{ value: "hsv", label: "HSV", hint: "Not suitable (see hsl), V is even worse than L for deltaE" },
                                { value: "luma-rgb", label: "Luma (RGB)", hint: "Viable: fast, only captures luma" },
                                { value: "luma-lab", label: "Luma (Lab)", hint: "Good" },
                                { value: "luma-oklab", label: "Luma (OKLab)", hint: "✅Best for luma-only: perceptually balanced." },
                                { value: "rgb", label: "RGB", hint: "Fast but imperfect luma (tuned for devices not eyes)." },
                                { value: "ycbcr", label: "YCbCr", hint: "meh, works but not tuned for eye" },
                                { value: "lab", label: "LAB", hint: "Good nearly-orthogonal" },
                                { value: "oklab", label: "OKLab", hint: "✅Purpose-fit orthogonal space for chroma & luma" },
                                //{ value: "oklch", label: "OKLCH", hint: "Not suitable due to space geometry." },
                            ]}
                        />
                    </div>
                    <div>
                        <small style={{ color: "#555" }}>* Color spaces with non-orthogonal axes are not viable for deltaE (HSL, HSV, OKLCH...).</small>
                    </div>
                </>
            )}
        </>
    );
}
