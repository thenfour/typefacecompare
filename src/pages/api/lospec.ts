import type { NextApiRequest, NextApiResponse } from "next";
import type { LospecPaletteResponse } from "@/utils/lospec";

interface LospecApiResponse {
    name?: string;
    colors?: string[];
    author?: string;
    slug?: string;
    description?: string;
}

const LOSPEC_HOST = "https://lospec.com";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
    if (request.method !== "GET") {
        response.setHeader("Allow", "GET");
        return response.status(405).json({ error: "Method not allowed" });
    }

    const rawSlug = request.query.slug;
    if (typeof rawSlug !== "string") {
        return response.status(400).json({ error: "Missing palette slug" });
    }

    const slug = rawSlug.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slug)) {
        return response.status(400).json({ error: "Invalid palette slug" });
    }

    const paletteUrl = `${LOSPEC_HOST}/palette-list/${slug}.json`;

    try {
        const lospecResponse = await fetch(paletteUrl, {
            headers: {
                // use a known working User-Agent to avoid potential blocking (google chrome on windows)
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
                Accept: "application/json",
            },
        });

        if (!lospecResponse.ok) {
            const status = lospecResponse.status;
            if (status === 404) {
                return response.status(404).json({ error: "Palette not found" });
            }
            return response.status(502).json({ error: "Lospec responded with an error" });
        }

        const payload = (await lospecResponse.json()) as LospecApiResponse;
        const colors = Array.isArray(payload.colors) ? payload.colors.filter((color) => typeof color === "string") : [];
        if (colors.length === 0) {
            return response.status(502).json({ error: "Lospec palette contains no colors" });
        }

        const normalized: LospecPaletteResponse = {
            slug,
            name: payload.name?.trim() || slug,
            author: payload.author?.trim() || null,
            colors,
            description: payload.description?.trim() || undefined,
        };

        response.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");
        return response.status(200).json(normalized);
    } catch (error) {
        return response.status(500).json({
            error: "Unable to contact Lospec",
            details: error instanceof Error ? error.message : String(error),
        });
    }
}
