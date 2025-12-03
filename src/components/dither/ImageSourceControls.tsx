import type { ChangeEvent } from "react";
import type { ExampleImage } from "@/data/ditherSourceExamples";
import type { ImageSourceState } from "@/hooks/useImageSource";
import { IMAGE_SCALE_MODE_LABELS, type ImageScaleMode } from "@/utils/imageScaling";

export interface ImageSourceControlsProps {
    imageUrlInput: string;
    onImageUrlChange: (value: string) => void;
    onImportImage: () => void;
    exampleImages: ExampleImage[];
    exampleImagesLoading: boolean;
    exampleImagesError: string | null;
    onImportExampleImage: (example: ExampleImage) => void;
    isImportingImage: boolean;
    imageScaleMode: ImageScaleMode;
    onImageScaleModeChange: (mode: ImageScaleMode) => void;
    imageSource: ImageSourceState | null;
    imageImportError: string | null;
    imageSourceReady: boolean;
}

export function ImageSourceControls({
    imageUrlInput,
    onImageUrlChange,
    onImportImage,
    exampleImages,
    exampleImagesLoading,
    exampleImagesError,
    onImportExampleImage,
    isImportingImage,
    imageScaleMode,
    onImageScaleModeChange,
    imageSource,
    imageImportError,
    imageSourceReady,
}: ImageSourceControlsProps) {
    const activeExampleLabel = imageSource?.kind === "example" ? imageSource.label : null;

    return (
        <div className="image-source-controls">
            <label>
                Image URL
                <div className="image-source-controls__import-row">
                    <input
                        type="url"
                        placeholder="https://example.com/image.png"
                        value={imageUrlInput}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => onImageUrlChange(event.target.value)}
                    />
                    <button type="button" onClick={onImportImage} disabled={isImportingImage || !imageUrlInput.trim()}>
                        {isImportingImage ? "Importing…" : "Import"}
                    </button>
                </div>
            </label>
            {exampleImagesLoading && <p className="dither-gradient-note">Loading example images…</p>}
            {exampleImagesError && <p className="dither-gradient-warning">{exampleImagesError}</p>}
            {exampleImages.length > 0 && !exampleImagesError && (
                <label className="image-source-controls__examples">
                    Example Images
                    <div className="image-source-controls__example-buttons">
                        {exampleImages.map((example) => {
                            const isActive = activeExampleLabel === example.label;
                            return (
                                <button
                                    key={example.path}
                                    type="button"
                                    className={`image-source-controls__example-button${isActive ? " is-active" : ""}`}
                                    onClick={() => onImportExampleImage(example)}
                                    disabled={isImportingImage}
                                    aria-pressed={isActive}
                                >
                                    <span>{example.label}</span>
                                    {isActive && <small>Active</small>}
                                </button>
                            );
                        })}
                    </div>
                </label>
            )}
            <label>
                Image Scaling
                <select value={imageScaleMode} onChange={(event) => onImageScaleModeChange(event.target.value as ImageScaleMode)}>
                    {Object.entries(IMAGE_SCALE_MODE_LABELS).map(([value, label]) => (
                        <option value={value} key={value}>
                            {label}
                        </option>
                    ))}
                </select>
            </label>
            {imageSource && !imageImportError && (
                <p className="dither-gradient-note">
                    {imageSource.label} • {imageSource.element.naturalWidth}×{imageSource.element.naturalHeight}px
                </p>
            )}
            {imageImportError && <p className="dither-gradient-warning">{imageImportError}</p>}
            {!imageSourceReady && !imageImportError && !imageSource && (
                <p className="dither-gradient-warning">Import an image to enable the image source.</p>
            )}
            <p className="dither-gradient-note">Tip: Try the example set, paste directly (Ctrl/Cmd+V), or import any image URL.</p>
        </div>
    );
}
