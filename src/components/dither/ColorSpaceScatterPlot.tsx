import dynamic from "next/dynamic";
import type { Data, Layout } from "plotly.js";

export type ScatterPoint = {
    coords: [number, number, number];
    color: [number, number, number];
};

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface ColorSpaceScatterPlotProps {
    sourcePoints: ScatterPoint[];
    palettePoints: ScatterPoint[];
    axisLabels: [string, string, string];
}

export function ColorSpaceScatterPlot({ sourcePoints, palettePoints, axisLabels }: ColorSpaceScatterPlotProps) {
    const data: Partial<Data>[] = [];
    if (sourcePoints.length > 0) {
        data.push({
            type: "scatter3d",
            mode: "markers",
            name: "Source Image",
            x: sourcePoints.map((point) => point.coords[0]),
            y: sourcePoints.map((point) => point.coords[1]),
            z: sourcePoints.map((point) => point.coords[2]),
            marker: {
                size: 3,
                opacity: 0.5,
                color: sourcePoints.map((point) => `rgb(${point.color[0]}, ${point.color[1]}, ${point.color[2]})`),
            },
        });
    }
    if (palettePoints.length > 0) {
        data.push({
            type: "scatter3d",
            mode: "markers",
            name: "Target Palette",
            x: palettePoints.map((point) => point.coords[0]),
            y: palettePoints.map((point) => point.coords[1]),
            z: palettePoints.map((point) => point.coords[2]),
            marker: {
                size: 6,
                color: palettePoints.map((point) => `rgb(${point.color[0]}, ${point.color[1]}, ${point.color[2]})`),
                line: {
                    color: "#111",
                    width: 1,
                },
            },
        });
    }

    const layout: Partial<Layout> = {
        margin: { l: 0, r: 0, b: 0, t: 0 },
        scene: {
            xaxis: {
                title: axisLabels[0],
                gridcolor: "rgba(0,0,0,0.1)",
                zerolinecolor: "rgba(0,0,0,0.2)",
            },
            yaxis: {
                title: axisLabels[1],
                gridcolor: "rgba(0,0,0,0.1)",
                zerolinecolor: "rgba(0,0,0,0.2)",
            },
            zaxis: {
                title: axisLabels[2],
                gridcolor: "rgba(0,0,0,0.1)",
                zerolinecolor: "rgba(0,0,0,0.2)",
            },
            aspectmode: "cube",
        },
        legend: { orientation: "h", y: -0.1 },
    };

    return (
        <Plot
            data={data}
            layout={layout}
            config={{ displaylogo: false, responsive: true }}
            style={{ width: "100%", height: "100%" }}
        />
    );
}
