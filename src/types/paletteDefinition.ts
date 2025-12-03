export type PaletteTokenKind = "color" | "separator" | "ignored";

export interface PaletteTokenBase {
    id: string;
    kind: PaletteTokenKind;
    /**
     * Raw text for this token, including any trailing newline characters.
     * When tokens are re-serialized, concatenating these raw strings will
     * reconstruct the original palette definition exactly.
     */
    raw: string;
    /** Zero-based line index for the start of this token. */
    lineIndex: number;
    /** Text of the line without its trailing newline sequence. */
    line: string;
}

export interface PaletteColorToken extends PaletteTokenBase {
    kind: "color";
    /** The substring that matched the color literal (e.g., "#0", "000000"). */
    colorText: string;
    /** Optional comment captured after the color literal. */
    commentText: string;
    /** Normalized #RRGGBB string derived from the color literal. */
    normalizedHex: string;
    /** Amount of whitespace that preceded the color literal on the line. */
    leadingWhitespace: string;
}

export interface PaletteSeparatorToken extends PaletteTokenBase {
    kind: "separator";
    dashCount: number;
}

export interface PaletteIgnoredToken extends PaletteTokenBase {
    kind: "ignored";
}

export type PaletteToken = PaletteColorToken | PaletteSeparatorToken | PaletteIgnoredToken;

export interface PaletteSwatchDefinition {
    tokenId: string;
    hex: string;
    comment: string;
    rowIndex: number;
    columnIndex: number;
    ordinal: number;
    lineIndex: number;
    line: string;
}

export type PaletteRow = PaletteSwatchDefinition[];

export interface PaletteParseError {
    lineIndex: number;
    message: string;
}

export interface PaletteParseResult {
    text: string;
    tokens: PaletteToken[];
    rows: PaletteRow[];
    swatches: PaletteSwatchDefinition[];
    errors: PaletteParseError[];
}
