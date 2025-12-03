import type { ReactNode } from "react";

interface OptionButton<T extends string | number> {
    value: T;
    label: ReactNode;
    disabled?: boolean;
    hint?: ReactNode;
}

interface OptionButtonGroupProps<T extends string | number> {
    value: T;
    options: OptionButton<T>[];
    onChange: (value: T) => void;
    ariaLabel?: string;
}

export function OptionButtonGroup<T extends string | number>({ value, options, onChange, ariaLabel }: OptionButtonGroupProps<T>) {
    return (
        <div className="option-button-group" role="group" aria-label={ariaLabel}>
            {options.map((option) => {
                const isActive = option.value === value;
                const className = ["option-button", isActive ? "is-active" : ""].filter(Boolean).join(" ");
                return (
                    <button
                        key={option.value}
                        type="button"
                        className={className}
                        onClick={() => onChange(option.value)}
                        aria-pressed={isActive}
                        disabled={option.disabled}
                    >
                        <span>{option.label}</span>
                        {option.hint && <small>{option.hint}</small>}
                    </button>
                );
            })}
        </div>
    );
}
