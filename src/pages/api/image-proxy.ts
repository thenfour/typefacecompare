import type { NextApiRequest, NextApiResponse } from "next";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const DEFAULT_CACHE_CONTROL = "public, s-maxage=600, stale-while-revalidate=86400";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
    if (request.method !== "GET") {
        response.setHeader("Allow", "GET");
        return response.status(405).json({ error: "Method Not Allowed" });
    }

    const targetParam = request.query.url;
    if (typeof targetParam !== "string" || targetParam.trim().length === 0) {
        return response.status(400).json({ error: "Missing or invalid url parameter" });
    }

    let targetUrl: URL;
    try {
        targetUrl = new URL(targetParam);
    } catch {
        return response.status(400).json({ error: "Invalid URL" });
    }

    if (!ALLOWED_PROTOCOLS.has(targetUrl.protocol)) {
        return response.status(400).json({ error: "URL must use HTTP or HTTPS" });
    }

    try {
        const upstreamResponse = await fetch(targetUrl.toString(), {
            headers: {
                "User-Agent": "TypefaceCompare/1.0 (+https://github.com/thenfour/typefacecompare)",
                Accept: "image/*",
            },
        });

        if (!upstreamResponse.ok) {
            const status = upstreamResponse.status;
            const statusText = upstreamResponse.statusText || "Unknown error";
            return response.status(status === 404 ? 404 : 502).json({ error: `Image request failed: ${statusText}` });
        }

        const contentType = upstreamResponse.headers.get("content-type") ?? "application/octet-stream";
        const buffer = Buffer.from(await upstreamResponse.arrayBuffer());

        response.setHeader("Content-Type", contentType);
        response.setHeader("Cache-Control", DEFAULT_CACHE_CONTROL);
        return response.status(200).send(buffer);
    } catch (error) {
        console.error("image-proxy", error);
        return response.status(502).json({ error: "Unable to fetch remote image" });
    }
}
