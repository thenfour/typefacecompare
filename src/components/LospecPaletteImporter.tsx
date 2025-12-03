import { useState, type ChangeEvent, type DragEvent } from "react";
import { extractLospecSlug, formatLospecPaletteText, normalizeLospecColor, type LospecPaletteResponse } from "@/utils/lospec";

interface LospecPaletteImporterProps {
    targetLabel: string;
    onApplyPalette: (paletteText: string) => void;
    className?: string;
}

export function LospecPaletteImporter({ targetLabel, onApplyPalette, className }: LospecPaletteImporterProps) {
    const [inputValue, setInputValue] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        setInputValue(event.target.value);
    };

    const handleDragOver = (event: DragEvent<HTMLInputElement>) => {
        event.preventDefault();
    };

    const importFromSlug = async (slug: string, { persistInput }: { persistInput?: boolean } = {}) => {
        if (isLoading) {
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/lospec?slug=${encodeURIComponent(slug)}`);
            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload.error || "Unable to import palette");
            }
            const data = (await response.json()) as LospecPaletteResponse;
            const normalizedColors = data.colors
                .map((color) => normalizeLospecColor(color))
                .filter((color): color is string => Boolean(color));
            if (normalizedColors.length === 0) {
                throw new Error("Lospec palette contains no colors");
            }
            const formatted = formatLospecPaletteText(data.name, data.author, normalizedColors, data.description);
            onApplyPalette(formatted);
            if (persistInput !== false) {
                setInputValue(slug);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to import palette");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDrop = (event: DragEvent<HTMLInputElement>) => {
        event.preventDefault();
        const textData = event.dataTransfer?.getData("text/plain");
        if (!textData) {
            return;
        }
        const trimmed = textData.trim();
        setInputValue(trimmed);
        const slug = extractLospecSlug(trimmed);
        if (!slug) {
            setError("Dropped text does not look like a Lospec URL or slug");
            return;
        }
        void importFromSlug(slug);
    };

    const handleImport = () => {
        const slug = extractLospecSlug(inputValue);
        if (!slug) {
            setError("Enter a Lospec palette slug or URL");
            return;
        }
        void importFromSlug(slug);
    };

    return (
        <div className={`lospec-import-block${className ? ` ${className}` : ""}`}>
            <label>
                <a href="https://lospec.com/palette-list" target="_blank" rel="noopener noreferrer">Import from Lospec</a>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                        type="text"
                        placeholder="URL or slug (e.g., aurora-16)"
                        value={inputValue}
                        onChange={handleChange}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                    />
                    <button type="button" onClick={handleImport} disabled={isLoading || !inputValue.trim()}>
                        {isLoading ? "Importing…" : "Import"}
                    </button>
                </div>
            </label>
            {error ? (
                <p className="dither-gradient-warning">{error}</p>
            ) : (
                <p className="dither-gradient-note">Paste or drag a Lospec URL/slug to apply to the {targetLabel}.</p>
            )}
        </div>
    );
}
