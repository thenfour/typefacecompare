import dynamic from "next/dynamic";
import type { Data, Layout } from "plotly.js";

export type RGBPoint = [number, number, number];

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const AXIS_CONFIG = {
    range: [0, 255],
    gridcolor: "rgba(0,0,0,0.1)",
    zerolinecolor: "rgba(0,0,0,0.2)",
};

interface ColorSpaceScatterPlotProps {
    sourcePoints: RGBPoint[];
    palettePoints: RGBPoint[];
}

export function ColorSpaceScatterPlot({ sourcePoints, palettePoints }: ColorSpaceScatterPlotProps) {
    console.log(sourcePoints);
    const data: Partial<Data>[] = [];
    if (sourcePoints.length > 0) {
        data.push({
            type: "scatter3d",
            mode: "markers",
            name: "Source Image",
            x: sourcePoints.map((point) => point[0]),
            y: sourcePoints.map((point) => point[1]),
            z: sourcePoints.map((point) => point[2]),
            marker: {
                size: 3,
                opacity: 0.5,
                color: sourcePoints.map((point) => `rgb(${point[0]}, ${point[1]}, ${point[2]})`),
            },
        });
    }
    if (palettePoints.length > 0) {
        data.push({
            type: "scatter3d",
            mode: "markers",
            name: "Target Palette",
            x: palettePoints.map((point) => point[0]),
            y: palettePoints.map((point) => point[1]),
            z: palettePoints.map((point) => point[2]),
            marker: {
                size: 6,
                color: palettePoints.map((point) => `rgb(${point[0]}, ${point[1]}, ${point[2]})`),
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
            xaxis: { title: "Red", ...AXIS_CONFIG },
            yaxis: { title: "Green", ...AXIS_CONFIG },
            zaxis: { title: "Blue", ...AXIS_CONFIG },
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
