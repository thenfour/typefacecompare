import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Data, Layout, Scene } from "plotly.js";

export type ScatterPoint = {
    coords: [number, number, number];
    color: [number, number, number];
};

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type PlotRelayoutEvent = Record<string, unknown> & {
    "scene.camera"?: Scene["camera"];
};

interface ColorSpaceScatterPlotProps {
    sourcePoints: ScatterPoint[];
    gamutPoints?: ScatterPoint[];
    palettePoints: ScatterPoint[];
    axisLabels: [string, string, string];
}

export function ColorSpaceScatterPlot({ sourcePoints, gamutPoints = [], palettePoints, axisLabels }: ColorSpaceScatterPlotProps) {
    const [cameraState, setCameraState] = useState<Scene["camera"]>();

    const plotData = useMemo(() => buildScatterSeries(sourcePoints, gamutPoints, palettePoints), [
        sourcePoints,
        gamutPoints,
        palettePoints,
    ]);

    const plotLayout = useMemo(() => buildScatterLayout(axisLabels, cameraState), [axisLabels, cameraState]);

    const handleRelayout = useCallback((event: PlotRelayoutEvent) => {
        const cameraUpdate = extractCameraState(event);
        if (!cameraUpdate) {
            return;
        }
        setCameraState((previousCamera) => mergeCameraState(previousCamera, cameraUpdate));
    }, []);

    return (
        <Plot
            data={plotData}
            layout={plotLayout}
            config={{ displaylogo: false, responsive: true }}
            style={{ width: "100%", height: "100%" }}
            onRelayout={handleRelayout}
        />
    );
}

function buildScatterSeries(sourcePoints: ScatterPoint[], gamutPoints: ScatterPoint[], palettePoints: ScatterPoint[]) {
    const data: Partial<Data>[] = [];
    if (sourcePoints.length > 0) {
        data.push(
            buildScatterTrace("Source Image", sourcePoints, {
                size: 3,
                opacity: 0.5,
            })
        );
    }
    if (gamutPoints.length > 0) {
        data.push(
            buildScatterTrace("Gamut Fit", gamutPoints, {
                size: 3,
                opacity: 0.7,
                line: {
                    color: "rgba(0,0,0,0.25)",
                    width: 0.5,
                },
            })
        );
    }
    if (palettePoints.length > 0) {
        data.push(
            buildScatterTrace("Target Palette", palettePoints, {
                size: 6,
                line: {
                    color: "#111",
                    width: 1,
                },
            })
        );
    }
    return data;
}

function buildScatterTrace(name: string, points: ScatterPoint[], markerOverrides: Partial<Data["marker"]>): Partial<Data> {
    return {
        type: "scatter3d",
        mode: "markers",
        name,
        x: points.map((point) => point.coords[0]),
        y: points.map((point) => point.coords[1]),
        z: points.map((point) => point.coords[2]),
        marker: {
            color: points.map((point) => `rgb(${point.color[0]}, ${point.color[1]}, ${point.color[2]})`),
            ...markerOverrides,
        },
    } satisfies Partial<Data>;
}

function buildScatterLayout(axisLabels: [string, string, string], camera: Scene["camera"] | undefined): Partial<Layout> {
    const scene: NonNullable<Layout["scene"]> = {
        xaxis: buildAxisLayout(axisLabels[0]),
        yaxis: buildAxisLayout(axisLabels[1]),
        zaxis: buildAxisLayout(axisLabels[2]),
        aspectmode: "cube",
        camera,
    };
    return {
        margin: { l: 0, r: 0, b: 0, t: 0 },
        scene,
        legend: { orientation: "h", y: -0.1 },
    } satisfies Partial<Layout>;
}

function buildAxisLayout(label: string): NonNullable<Scene["xaxis"]> {
    return {
        title: { text: label },
        gridcolor: "rgba(0,0,0,0.1)",
        zerolinecolor: "rgba(0,0,0,0.2)",
    } satisfies NonNullable<Scene["xaxis"]>;
}

function extractCameraState(event: PlotRelayoutEvent): Scene["camera"] | null {
    const directCamera = event["scene.camera"];
    const cameraUpdate: Scene["camera"] = isPlainObject(directCamera) ? { ...(directCamera as Scene["camera"]) } : {};
    let hasUpdate = Boolean(directCamera);
    Object.keys(event)
        .filter((key) => key.startsWith("scene.camera.") && key.split(".").length > 2)
        .forEach((key) => {
            const value = event[key as keyof PlotRelayoutEvent];
            if (value === undefined) {
                return;
            }
            const pathSegments = key.split(".").slice(2);
            applyCameraPath(cameraUpdate, pathSegments, value);
            hasUpdate = true;
        });
    return hasUpdate ? cameraUpdate : null;
}

function applyCameraPath(target: Scene["camera"], pathSegments: string[], value: unknown) {
    if (!pathSegments.length) {
        return;
    }
    const [head, ...rest] = pathSegments;
    if (rest.length === 0) {
        (target as Record<string, unknown>)[head] = value;
        return;
    }
    const nextTarget = (target as Record<string, Scene["camera"] | Record<string, unknown>>)[head];
    if (!isPlainObject(nextTarget)) {
        (target as Record<string, unknown>)[head] = {};
    }
    applyCameraPath((target as Record<string, Scene["camera"] | Record<string, unknown>>)[head] as Scene["camera"], rest, value);
}

function mergeCameraState(current: Scene["camera"] | undefined, update: Scene["camera"]): Scene["camera"] {
    if (!current) {
        return { ...update };
    }
    const merged: Scene["camera"] = { ...current };
    Object.entries(update).forEach(([key, value]) => {
        if (isPlainObject(value)) {
            const existing = isPlainObject((merged as Record<string, unknown>)[key])
                ? { ...((merged as Record<string, unknown>)[key] as Record<string, unknown>) }
                : {};
            (merged as Record<string, unknown>)[key] = {
                ...existing,
                ...(value as Record<string, unknown>),
            };
            return;
        }
        (merged as Record<string, unknown>)[key] = value;
    });
    return merged;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
