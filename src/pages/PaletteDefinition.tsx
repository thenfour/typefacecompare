import Head from "next/head";
import Link from "next/link";
import { ChangeEvent, useMemo, useState } from "react";
import { parsePaletteDefinition } from "../utils/paletteDefinition";
import { PaletteDefinitionViewer } from "../components/PaletteDefinitionViewer";
import { PaletteSwatchDefinition } from "../types/paletteDefinition";
import "../styles/PaletteDefinition.css";

export default function PaletteDefinitionPage() {
    const [text, setText] = useState("");
    const [selected, setSelected] = useState<PaletteSwatchDefinition | null>(null);

    const parsed = useMemo(() => parsePaletteDefinition(text), [text]);

    const handleTextareaChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
        setText(event.target.value);
        setSelected(null);
    };

    return (
        <>
            <Head>
                <title>Palette Definition</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>
            <main className="palette-definition-page">
                <div className="palette-definition-header">
                    <Link href="/">&#8592; TypefaceComparisonTool</Link>
                    <h1>Palette Definition Workspace</h1>
                    <p style={{ maxWidth: 720, color: "#4a4a4a" }}>
                        Each non-empty line on the left defines a color. Supported tokens: #0, 0, #000, 000, 000000, #000000.
                        Use at least five dashes (-----) to start a new row. Add comments after a color with whitespace.
                    </p>
                </div>

                <div className="palette-definition-layout">
                    <textarea
                        className="palette-definition-textarea"
                        spellCheck={false}
                        value={text}
                        onChange={handleTextareaChange}
                        placeholder={`#0 // darkest
#fff hero text
-----
#0ff tag bg
#111 codes`}
                    />

                    <PaletteDefinitionViewer
                        rows={parsed.rows}
                        swatches={parsed.swatches}
                        onSwatchClick={setSelected}
                    />
                </div>

                {selected && (
                    <div className="palette-definition-meta" style={{ fontFamily: "var(--palette-definition-font)" }}>
                        <span>Selected #{selected.ordinal + 1}</span>
                        <span>{selected.hex}</span>
                        <span>Row {selected.rowIndex + 1}, Column {selected.columnIndex + 1}</span>
                        <span>Source line {selected.lineIndex + 1}</span>
                        {selected.comment && <span>Comment: {selected.comment}</span>}
                    </div>
                )}
            </main>
        </>
    );
}
