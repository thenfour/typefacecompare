import { KeyboardEvent, MutableRefObject, ReactElement, ReactNode, Ref, cloneElement, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
    title: ReactNode;
    children: ReactElement;
    placement?: TooltipPlacement;
    enterDelay?: number;
    leaveDelay?: number;
    disableHoverListener?: boolean;
    disableFocusListener?: boolean;
    open?: boolean;
    onOpen?: () => void;
    onClose?: () => void;
    className?: string;
    arrow?: boolean;
    offset?: number;
    interactive?: boolean;
}

interface TooltipPosition {
    top: number;
    left: number;
    transformOrigin: string;
}

const noop = () => undefined;

const isRenderable = (value: ReactNode) =>
    !(value === null || value === undefined || value === "");

const setRef = <T,>(ref: Ref<T> | undefined, value: T | null) => {
    if (!ref) {
        return;
    }

    if (typeof ref === "string") {
        return;
    }

    if (typeof ref === "function") {
        ref(value);
        return;
    }

    try {
        (ref as MutableRefObject<T | null>).current = value;
    }
    catch {
        // ignore
    }
};

const mergeHandlers = <E,>(theirHandler?: (event: E) => void, ourHandler?: (event: E) => void) => {
    if (!theirHandler && !ourHandler) {
        return undefined;
    }

    return (event: E) => {
        theirHandler?.(event);
        if ((event as unknown as { defaultPrevented?: boolean }).defaultPrevented) {
            return;
        }

        ourHandler?.(event);
    };
};

export const Tooltip = ({
    title,
    children,
    placement = "top",
    enterDelay = 100,
    leaveDelay = 100,
    disableHoverListener = false,
    disableFocusListener = false,
    open: openProp,
    onOpen = noop,
    onClose = noop,
    className,
    arrow = false,
    offset = 8,
    interactive = false
}: TooltipProps) => {
    const tooltipId = useId();
    const anchorRef = useRef<Element | null>(null);
    const tooltipRef = useRef<HTMLDivElement | null>(null);
    const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [internalOpen, setInternalOpen] = useState(false);
    const [position, setPosition] = useState<TooltipPosition | null>(null);
    const [mounted, setMounted] = useState(false);
    const openRef = useRef(false);

    const contentAvailable = isRenderable(title);
    const isControlled = openProp !== undefined;
    const open = isControlled ? Boolean(openProp && contentAvailable) : internalOpen && contentAvailable;
    openRef.current = open;

    useEffect(() => setMounted(true), []);

    useEffect(() => () => {
        if (enterTimer.current) {
            clearTimeout(enterTimer.current);
        }
        if (leaveTimer.current) {
            clearTimeout(leaveTimer.current);
        }
    }, []);

    const clearTimers = () => {
        if (enterTimer.current) {
            clearTimeout(enterTimer.current);
            enterTimer.current = null;
        }
        if (leaveTimer.current) {
            clearTimeout(leaveTimer.current);
            leaveTimer.current = null;
        }
    };

    const setOpen = useCallback((value: boolean) => {
        if (!contentAvailable) {
            return;
        }

        if (openRef.current === value) {
            return;
        }

        if (!isControlled) {
            setInternalOpen(value);
        }

        if (value) {
            onOpen();
        }
        else {
            onClose();
        }
    }, [contentAvailable, isControlled, onClose, onOpen]);

    const handleOpen = useCallback(() => {
        clearTimers();
        enterTimer.current = setTimeout(() => setOpen(true), enterDelay);
    }, [enterDelay, setOpen]);

    const handleClose = useCallback(() => {
        clearTimers();
        leaveTimer.current = setTimeout(() => setOpen(false), leaveDelay);
    }, [leaveDelay, setOpen]);

    const updatePosition = useCallback(() => {
        if (!anchorRef.current || !tooltipRef.current || typeof window === "undefined") {
            return;
        }

        const anchorRect = anchorRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const spacing = offset;
        let top = 0;
        let left = 0;
        let transformOrigin = "center bottom";

        switch (placement) {
            case "bottom":
                top = anchorRect.bottom + spacing;
                left = anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2;
                transformOrigin = "center top";
                break;
            case "left":
                top = anchorRect.top + anchorRect.height / 2 - tooltipRect.height / 2;
                left = anchorRect.left - tooltipRect.width - spacing;
                transformOrigin = "right center";
                break;
            case "right":
                top = anchorRect.top + anchorRect.height / 2 - tooltipRect.height / 2;
                left = anchorRect.right + spacing;
                transformOrigin = "left center";
                break;
            case "top":
            default:
                top = anchorRect.top - tooltipRect.height - spacing;
                left = anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2;
                transformOrigin = "center bottom";
                break;
        }

        const nextPosition = {
            top: top + window.scrollY,
            left: left + window.scrollX,
            transformOrigin
        } satisfies TooltipPosition;

        setPosition(nextPosition);
    }, [offset, placement]);

    useLayoutEffect(() => {
        if (!open) {
            setPosition(null);
            return;
        }

        updatePosition();
    }, [open, updatePosition, title]);

    useEffect(() => {
        if (!open) {
            return;
        }

        const handleWindowChange = () => updatePosition();
        window.addEventListener("scroll", handleWindowChange, true);
        window.addEventListener("resize", handleWindowChange);
        return () => {
            window.removeEventListener("scroll", handleWindowChange, true);
            window.removeEventListener("resize", handleWindowChange);
        };
    }, [open, updatePosition]);

    const child = useMemo(() => {
        if (!contentAvailable) {
            return children;
        }

        return cloneElement(children, {
            ref: (node: Element | null) => {
                anchorRef.current = node;
                setRef(children.ref, node);
            },
            onMouseEnter: disableHoverListener ? children.props.onMouseEnter : mergeHandlers(children.props.onMouseEnter, handleOpen),
            onMouseLeave: disableHoverListener ? children.props.onMouseLeave : mergeHandlers(children.props.onMouseLeave, handleClose),
            onFocus: disableFocusListener ? children.props.onFocus : mergeHandlers(children.props.onFocus, handleOpen),
            onBlur: disableFocusListener ? children.props.onBlur : mergeHandlers(children.props.onBlur, handleClose),
            onKeyDown: mergeHandlers(children.props.onKeyDown, (event: KeyboardEvent) => {
                if (event.key === "Escape") {
                    handleClose();
                }
            }),
            "aria-describedby": open && contentAvailable ? tooltipId : undefined
        });
    }, [children, contentAvailable, disableFocusListener, disableHoverListener, handleClose, handleOpen, open, tooltipId]);

    if (!contentAvailable) {
        return child;
    }

    const tooltipNode = mounted && open && typeof document !== "undefined"
        ? createPortal(
            <div
                className={["tooltip-root", className].filter(Boolean).join(" ")}
                style={{
                    top: position?.top ?? -9999,
                    left: position?.left ?? -9999,
                    opacity: position ? 1 : 0
                }}
                data-placement={placement}
                data-interactive={interactive}
            >
                <div
                    ref={tooltipRef}
                    id={tooltipId}
                    role="tooltip"
                    className="tooltip-content"
                    style={{
                        transformOrigin: position?.transformOrigin ?? "center top",
                        pointerEvents: interactive ? "auto" : "none"
                    }}
                >
                    {title}
                    {arrow && <span className="tooltip-arrow" />}
                </div>
            </div>,
            document.body
        )
        : null;

    return (
        <>
            {child}
            {tooltipNode}
        </>
    );
};
