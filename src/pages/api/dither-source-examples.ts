import type { NextApiRequest, NextApiResponse } from "next";
import path from "path";
import { promises as fs } from "fs";
import type { ExampleImage } from "@/data/ditherSourceExamples";

const SUPPORTED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".avif"]);
const EXAMPLES_DIRECTORY = path.join(process.cwd(), "public", "DitherSourceExamples");

const titleCase = (value: string) =>
    value
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());

const buildLabelFromFilename = (fileName: string) => titleCase(fileName.replace(path.extname(fileName), ""));

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
    if (_req.method !== "GET") {
        res.setHeader("Allow", "GET");
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }

    try {
        const entries = await fs.readdir(EXAMPLES_DIRECTORY, { withFileTypes: true });
        const images: ExampleImage[] = entries
            .filter((entry) => entry.isFile())
            .filter((entry) => SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
            .map((entry) => ({
                label: buildLabelFromFilename(entry.name),
                path: `/DitherSourceExamples/${entry.name}`,
            }))
            .sort((a, b) => a.label.localeCompare(b.label));

        res.status(200).json(images);
    } catch (error) {
        console.error("Failed to read example images", error);
        res.status(500).json({ error: "Unable to read example images" });
    }
}
