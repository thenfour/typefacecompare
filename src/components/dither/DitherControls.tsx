import type { DitherType, ErrorDiffusionKernelId } from "@/utils/dithering";
import { DITHER_LABELS, DITHER_TYPE_ORDER, ERROR_DIFFUSION_KERNELS } from "@/utils/dithering";

interface DitherControlsProps {
    ditherType: DitherType;
    onDitherTypeChange: (type: DitherType) => void;
    ditherStrength: number;
    onDitherStrengthChange: (value: number) => void;
    ditherStrengthDisabled?: boolean;
    ditherSeed: number;
    onDitherSeedChange: (value: number) => void;
    seedEnabled: boolean;
    isErrorDiffusion: boolean;
    errorDiffusionKernelId: ErrorDiffusionKernelId;
    onErrorDiffusionKernelChange: (id: ErrorDiffusionKernelId) => void;
}

export function DitherControls({
    ditherType,
    onDitherTypeChange,
    ditherStrength,
    onDitherStrengthChange,
    ditherStrengthDisabled = false,
    ditherSeed,
    onDitherSeedChange,
    seedEnabled,
    isErrorDiffusion,
    errorDiffusionKernelId,
    onErrorDiffusionKernelChange,
}: DitherControlsProps) {
    return (
        <>
            <select value={ditherType} onChange={(event) => onDitherTypeChange(event.target.value as DitherType)}>
                {DITHER_TYPE_ORDER.map((type) => (
                    <option value={type} key={type}>
                        {DITHER_LABELS[type]}
                    </option>
                ))}
            </select>
            <label>
                Dither Strength ({ditherStrength.toFixed(2)})
                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={ditherStrength}
                    onChange={(event) => onDitherStrengthChange(event.target.valueAsNumber)}
                    disabled={ditherType === "none" || ditherStrengthDisabled}
                />
            </label>
            <label>
                Pattern Seed {seedEnabled ? "" : "(not used)"}
                <input
                    type="number"
                    min={0}
                    max={99999999}
                    step={1}
                    value={ditherSeed}
                    onChange={(event) => {
                        const next = event.target.valueAsNumber;
                        onDitherSeedChange(Number.isFinite(next) ? next : 0);
                    }}
                    disabled={!seedEnabled}
                />
            </label>
            {isErrorDiffusion && (
                <label>
                    Error Diffusion Kernel
                    <select
                        value={errorDiffusionKernelId}
                        onChange={(event) => onErrorDiffusionKernelChange(event.target.value as ErrorDiffusionKernelId)}
                    >
                        {ERROR_DIFFUSION_KERNELS.map((kernel) => (
                            <option value={kernel.id} key={kernel.id}>
                                {kernel.label}
                            </option>
                        ))}
                    </select>
                </label>
            )}
        </>
    );
}
