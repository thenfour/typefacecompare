import { useEffect, useRef, useState } from "react";

const DEFAULT_RATIO = 1;

const getDevicePixelRatio = () => {
    if (typeof window === "undefined") {
        return DEFAULT_RATIO;
    }
    return window.devicePixelRatio || DEFAULT_RATIO;
};

export function useDevicePixelRatio(pollInterval = 500) {
    const [ratio, setRatio] = useState(DEFAULT_RATIO);
    const ratioRef = useRef(ratio);

    useEffect(() => {
        ratioRef.current = ratio;
    }, [ratio]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        let rafId: number | null = null;
        const commitRatio = (next: number) => {
            if (next === ratioRef.current) {
                return;
            }
            ratioRef.current = next;
            setRatio(next);
        };

        commitRatio(getDevicePixelRatio());

        const scheduleUpdate = () => {
            if (rafId !== null) {
                return;
            }
            rafId = window.requestAnimationFrame(() => {
                rafId = null;
                commitRatio(getDevicePixelRatio());
            });
        };

        const handleResize = () => {
            scheduleUpdate();
        };

        window.addEventListener("resize", handleResize);

        const viewport = window.visualViewport;
        viewport?.addEventListener("resize", handleResize);

        let intervalId: number | null = null;
        if (!viewport && pollInterval > 0) {
            intervalId = window.setInterval(() => {
                const next = getDevicePixelRatio();
                if (next !== ratioRef.current) {
                    commitRatio(next);
                }
            }, pollInterval);
        }

        return () => {
            if (rafId !== null) {
                window.cancelAnimationFrame(rafId);
            }
            window.removeEventListener("resize", handleResize);
            viewport?.removeEventListener("resize", handleResize);
            if (intervalId !== null) {
                window.clearInterval(intervalId);
            }
        };
    }, [pollInterval]);

    return ratio;
}
