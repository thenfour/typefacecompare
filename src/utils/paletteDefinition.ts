import {
    PaletteColorToken,
    PaletteCoordinate,
    PaletteIgnoredToken,
    PaletteParseError,
    PaletteParseResult,
    PaletteRow,
    PaletteSeparatorToken,
    PaletteSwatchDefinition,
    PaletteToken,
} from "../types/paletteDefinition";

interface LineChunk {
    raw: string;
    line: string;
    lineIndex: number;
    absoluteIndex: number;
}

const COLOR_LITERAL = /^#?(?:[0-9a-fA-F]{1}|[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const COORDINATE_LITERAL = /^\(\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*\)(?:\s+(.*))?$/;
const SEPARATOR_LITERAL = /^-{5,}$/;

export function parsePaletteDefinition(text: string): PaletteParseResult {
    const lines = sliceIntoLines(text);
    const tokens: PaletteToken[] = lines.map(toToken);

    const rows: PaletteRow[] = [[]];
    const swatches: PaletteSwatchDefinition[] = [];
    const errors: PaletteParseError[] = [];
    let rowIndex = 0;
    let ordinal = 0;

    tokens.forEach((token) => {
        if (token.kind === "separator") {
            rowIndex = rows.push([]) - 1;
            return;
        }

        if (token.kind !== "color") {
            return;
        }

        const row = rows[rowIndex] ?? (rows[rowIndex] = []);
        const columnIndex = row.length;
        const position = normalizeCoordinate(token, errors);
        const swatch: PaletteSwatchDefinition = {
            tokenId: token.id,
            hex: token.normalizedHex,
            comment: token.commentText,
            rowIndex,
            columnIndex,
            ordinal,
            lineIndex: token.lineIndex,
            line: token.line,
            position,
        };

        row.push(swatch);
        swatches.push(swatch);
        ordinal += 1;
    });

    return {
        text,
        tokens,
        rows: rows.filter((row) => row.length > 0),
        swatches,
        errors,
    } satisfies PaletteParseResult;
}

export function stringifyPaletteTokens(tokens: PaletteToken[]): string {
    return tokens.map((token) => token.raw).join("");
}

function sliceIntoLines(text: string): LineChunk[] {
    if (!text) {
        return [];
    }

    const chunks: LineChunk[] = [];
    let cursor = 0;
    let lineIndex = 0;
    let absoluteIndex = 0;

    while (cursor < text.length) {
        const newline = text.indexOf("\n", cursor);
        if (newline === -1) {
            const raw = text.slice(cursor);
            chunks.push({ raw, line: raw.replace(/[\r\n]+$/, ""), lineIndex, absoluteIndex });
            absoluteIndex += 1;
            break;
        }

        const sliceEnd = newline + 1;
        const raw = text.slice(cursor, sliceEnd);
        chunks.push({ raw, line: raw.replace(/[\r\n]+$/, ""), lineIndex, absoluteIndex });
        cursor = sliceEnd;
        lineIndex += 1;
        absoluteIndex += 1;
    }

    return chunks;
}

function toToken(chunk: LineChunk): PaletteToken {
    const leadingWhitespaceMatch = chunk.line.match(/^\s*/);
    const leadingWhitespace = leadingWhitespaceMatch ? leadingWhitespaceMatch[0] : "";
    const trimmedLeading = chunk.line.slice(leadingWhitespace.length);

    if (isSeparatorLine(trimmedLeading)) {
        return {
            id: tokenId(chunk),
            kind: "separator",
            raw: chunk.raw,
            line: chunk.line,
            lineIndex: chunk.lineIndex,
            dashCount: trimmedLeading.length,
        } satisfies PaletteSeparatorToken;
    }

    const colorMatch = trimmedLeading.match(/^([^\s]+)(?:\s+(.*))?$/);
    if (colorMatch) {
        const candidate = colorMatch[1] ?? "";
        if (COLOR_LITERAL.test(candidate)) {
            const normalizedHex = normalizeHex(candidate);
            if (normalizedHex) {
                const { coordinate, commentText } = extractCoordinateFromRemainder(colorMatch[2]);
                return {
                    id: tokenId(chunk),
                    kind: "color",
                    raw: chunk.raw,
                    line: chunk.line,
                    lineIndex: chunk.lineIndex,
                    colorText: candidate,
                    commentText,
                    normalizedHex,
                    leadingWhitespace,
                    coordinate,
                } satisfies PaletteColorToken;
            }
        }
    }

    return {
        id: tokenId(chunk),
        kind: "ignored",
        raw: chunk.raw,
        line: chunk.line,
        lineIndex: chunk.lineIndex,
    } satisfies PaletteIgnoredToken;
}

function tokenId(chunk: LineChunk): string {
    return `palette-token-${chunk.absoluteIndex}`;
}

function isSeparatorLine(value: string): boolean {
    if (!value) {
        return false;
    }
    return SEPARATOR_LITERAL.test(value.trim());
}

function normalizeHex(input: string): string | null {
    let hex = input.replace(/^#/, "");

    if (hex.length === 1) {
        hex = hex.repeat(6);
    } else if (hex.length === 3) {
        hex = hex.split("").map((char) => char + char).join("");
    } else if (hex.length !== 6) {
        return null;
    }

    if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
        return null;
    }

    return `#${hex.toUpperCase()}`;
}

function extractCoordinateFromRemainder(remainder?: string): { coordinate: PaletteCoordinate | null; commentText: string } {
    if (!remainder) {
        return { coordinate: null, commentText: "" };
    }
    const trimmed = remainder.trim();
    if (!trimmed.startsWith("(")) {
        return { coordinate: null, commentText: trimmed };
    }
    const coordinateMatch = trimmed.match(COORDINATE_LITERAL);
    if (!coordinateMatch) {
        return { coordinate: null, commentText: trimmed };
    }
    const parsedX = Number(coordinateMatch[1]);
    const parsedY = Number(coordinateMatch[2]);
    const coordinate: PaletteCoordinate | null = Number.isFinite(parsedX) && Number.isFinite(parsedY)
        ? { x: parsedX, y: parsedY }
        : null;
    const commentText = coordinateMatch[3]?.trim() ?? "";
    return { coordinate, commentText };
}

function normalizeCoordinate(token: PaletteColorToken, errors: PaletteParseError[]): PaletteCoordinate | null {
    if (!token.coordinate) {
        return null;
    }
    const { x, y } = token.coordinate;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        errors.push({
            lineIndex: token.lineIndex,
            message: "Invalid gradient coordinate. Use (x,y) with numeric values between 0 and 1.",
        });
        return null;
    }
    const clampedX = clamp01(x);
    const clampedY = clamp01(y);
    if (clampedX !== x || clampedY !== y) {
        errors.push({
            lineIndex: token.lineIndex,
            message: "Gradient coordinates must be between 0 and 1; values were clamped.",
        });
    }
    return { x: clampedX, y: clampedY } satisfies PaletteCoordinate;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
