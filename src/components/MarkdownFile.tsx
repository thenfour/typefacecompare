import { useEffect, useState } from "react";
import { Markdown } from "./MarkdownWrapper";

type LoadState = "idle" | "loading" | "ready" | "error";

export interface MarkdownFileProps {
    /** Public path to the markdown asset, e.g. /docs/example.md */
    path: string;
    /** Optional className for the wrapping element */
    className?: string;
    /** Message shown while the file is being fetched */
    loadingMessage?: string;
    /** Message shown if the file fails to load */
    errorMessage?: string;
}

export function MarkdownFile({
    path,
    className,
    loadingMessage = "Loading document…",
    errorMessage = "Unable to load document.",
}: MarkdownFileProps) {
    const [markdown, setMarkdown] = useState<string>("");
    const [state, setState] = useState<LoadState>("idle");

    useEffect(() => {
        let isMounted = true;
        setState("loading");

        // Fetch the markdown file from the provided public path and stream it to the Markdown renderer once available.
        fetch(path)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch markdown: ${response.status}`);
                }
                return response.text();
            })
            .then((text) => {
                if (!isMounted) {
                    return;
                }
                setMarkdown(text);
                setState("ready");
            })
            .catch(() => {
                if (!isMounted) {
                    return;
                }
                setState("error");
            });

        return () => {
            isMounted = false;
        };
    }, [path]);

    if (state === "error") {
        return (
            <div className={className} role="status">
                {errorMessage}
            </div>
        );
    }

    if (state !== "ready") {
        return (
            <div className={className} role="status">
                {loadingMessage}
            </div>
        );
    }

    return (
        <div className={className}>
            <Markdown markdown={markdown} />
        </div>
    );
}
