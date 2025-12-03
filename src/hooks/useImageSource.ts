import { useCallback, useEffect, useState } from "react";
import { drawImageWithScaleMode, type ImageScaleMode } from "@/utils/imageScaling";
import type { ExampleImage } from "@/data/ditherSourceExamples";
import { loadImageElementFromUrl, loadLocalImageElement } from "@/utils/imageSource";

export type ImageSourceKind = "url" | "clipboard" | "example";

export interface ImageSourceState {
    element: HTMLImageElement;
    label: string;
    kind: ImageSourceKind;
    cleanup?: () => void;
}

interface UseImageSourceOptions {
    width: number;
    height: number;
    onActivateImageSource?: (label: string) => void;
}

export function useImageSource({ width, height, onActivateImageSource }: UseImageSourceOptions) {
    const [imageUrlInput, setImageUrlInput] = useState("");
    const [imageScaleMode, setImageScaleMode] = useState<ImageScaleMode>("cover");
    const [imageSource, setImageSource] = useState<ImageSourceState | null>(null);
    const [sourceImageData, setSourceImageData] = useState<ImageData | null>(null);
    const [isImportingImage, setIsImportingImage] = useState(false);
    const [imageImportError, setImageImportError] = useState<string | null>(null);

    const replaceImageSource = useCallback((next: ImageSourceState | null) => {
        setImageSource((previous) => {
            if (previous?.cleanup) {
                try {
                    previous.cleanup();
                } catch {
                    // ignore cleanup failures
                }
            }
            return next;
        });
    }, []);

    useEffect(() => {
        if (!imageSource?.element) {
            setSourceImageData(null);
            return;
        }
        if (typeof document === "undefined") {
            return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            return;
        }
        drawImageWithScaleMode(ctx, imageSource.element, imageScaleMode, width, height);
        const nextImageData = ctx.getImageData(0, 0, width, height);
        setSourceImageData(nextImageData);
    }, [imageSource, width, height, imageScaleMode]);

    useEffect(() => () => replaceImageSource(null), [replaceImageSource]);

    const activateImage = useCallback(
        (state: ImageSourceState) => {
            replaceImageSource(state);
            setImageImportError(null);
            onActivateImageSource?.(state.label);
        },
        [onActivateImageSource, replaceImageSource]
    );

    const importImageFromUrl = useCallback(async () => {
        const trimmedUrl = imageUrlInput.trim();
        if (!trimmedUrl) {
            setImageImportError("Enter an image URL");
            return;
        }
        if (typeof window === "undefined") {
            setImageImportError("Image import is only available in the browser");
            return;
        }
        setIsImportingImage(true);
        setImageImportError(null);
        try {
            const imageElement = await loadImageElementFromUrl(trimmedUrl);
            activateImage({
                element: imageElement,
                label: "Imported URL",
                kind: "url",
            });
        } catch (error) {
            replaceImageSource(null);
            setImageImportError(error instanceof Error ? error.message : "Failed to import image");
        } finally {
            setIsImportingImage(false);
        }
    }, [activateImage, imageUrlInput, replaceImageSource]);

    const importExampleImage = useCallback(
        async (example: ExampleImage) => {
            if (!example?.path) {
                setImageImportError("Example image path missing");
                return;
            }
            if (typeof window === "undefined") {
                setImageImportError("Image import is only available in the browser");
                return;
            }
            setIsImportingImage(true);
            setImageImportError(null);
            try {
                const imageElement = await loadLocalImageElement(example.path);
                activateImage({
                    element: imageElement,
                    label: example.label,
                    kind: "example",
                });
                setImageUrlInput("");
            } catch (error) {
                replaceImageSource(null);
                setImageImportError(error instanceof Error ? error.message : "Failed to import image");
            } finally {
                setIsImportingImage(false);
            }
        },
        [activateImage, replaceImageSource]
    );

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        const handlePaste = (event: ClipboardEvent) => {
            const clipboardData = event.clipboardData;
            if (!clipboardData) {
                return;
            }
            const fileItem = Array.from(clipboardData.items).find((item) => item.kind === "file" && item.type.startsWith("image/"));
            if (!fileItem) {
                return;
            }
            const file = fileItem.getAsFile();
            if (!file) {
                return;
            }
            const objectUrl = URL.createObjectURL(file);
            const pastedImage = new Image();
            pastedImage.decoding = "async";
            pastedImage.onload = () => {
                activateImage({
                    element: pastedImage,
                    label: "Pasted image",
                    kind: "clipboard",
                    cleanup: () => URL.revokeObjectURL(objectUrl),
                });
                setImageUrlInput("");
            };
            pastedImage.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                setImageImportError("Unable to decode pasted image");
            };
            pastedImage.src = objectUrl;
        };
        window.addEventListener("paste", handlePaste);
        return () => window.removeEventListener("paste", handlePaste);
    }, [activateImage]);

    return {
        imageUrlInput,
        setImageUrlInput,
        imageScaleMode,
        setImageScaleMode,
        imageSource,
        sourceImageData,
        importImageFromUrl,
        importExampleImage,
        isImportingImage,
        imageImportError,
    } as const;
}
