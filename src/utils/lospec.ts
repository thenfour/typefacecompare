export interface LospecPaletteResponse {
    slug: string;
    name: string;
    author: string | null;
    colors: string[];
    description?: string;
}

export function extractLospecSlug(input: string) {
    const trimmed = input.trim();
    if (!trimmed) {
        return null;
    }
    const urlMatch = trimmed.match(/lospec\.com\/palette-list\/([a-z0-9-]+)/i);
    if (urlMatch) {
        return urlMatch[1].toLowerCase();
    }
    const slugCandidate = trimmed.toLowerCase();
    if (/^[a-z0-9-]+$/.test(slugCandidate)) {
        return slugCandidate;
    }
    return null;
}

export function normalizeLospecColor(color: string) {
    const sanitized = color.trim().replace(/^#/u, "");
    if (/^[0-9a-f]{6}$/i.test(sanitized)) {
        return `#${sanitized.toUpperCase()}`;
    }
    if (/^[0-9a-f]{3}$/i.test(sanitized)) {
        return `#${sanitized.toUpperCase()}`;
    }
    return null;
}

export function formatLospecPaletteText(name: string, author: string | null, colors: string[], description?: string) {
    const headerParts = [`// Lospec: ${name}`];
    if (author) {
        headerParts.push(`by ${author}`);
    }
    if (description) {
        headerParts.push(description);
    }
    const header = headerParts.join(" | ");
    const paletteLines = insertRowSeparators(colors);
    const lines = [header, ...paletteLines];
    return lines.join("\n");
}

function insertRowSeparators(colors: string[]) {
    if (colors.length === 0) {
        return [];
    }
    const chunkSize = inferRowSize(colors.length);
    const lines: string[] = [];
    colors.forEach((color, index) => {
        lines.push(color);
        const nextIndex = index + 1;
        if (nextIndex < colors.length && nextIndex % chunkSize === 0) {
            lines.push("-----");
        }
    });
    if (lines[lines.length - 1] === "-----") {
        lines.pop();
    }
    return lines;
}

function inferRowSize(paletteSize: number) {
    if (paletteSize <= 0) {
        return 1;
    }
    const heuristic = Math.floor(Math.sqrt(paletteSize));
    const preferred = Math.max(2, heuristic);
    return Math.min(paletteSize, preferred);
}
