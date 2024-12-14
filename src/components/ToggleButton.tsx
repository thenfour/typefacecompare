import { CSSProperties, PropsWithChildren } from "react";

interface ToggleButtonProps
{
    value: boolean;
    onChange?: (v : boolean) => void | undefined;
    className?: string | undefined;
    style?: CSSProperties | undefined;
}

export const ToggleButton = (props: PropsWithChildren<ToggleButtonProps>) => {
    return <button
        className={`${props.className} toggleButton ${props.value ? "valueTrue" : "valueFalse"}`}
        style={props.style}
        onClick={e => props.onChange && props.onChange(!props.value)}
        >
            {props.children}
        </button>;
};



