import type { ChangeEvent } from "react";
import type { ImageSourceState } from "@/hooks/useImageSource";
import { IMAGE_SCALE_MODE_LABELS, type ImageScaleMode } from "@/utils/imageScaling";

export interface ImageSourceControlsProps {
    imageUrlInput: string;
    onImageUrlChange: (value: string) => void;
    onImportImage: () => void;
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
    isImportingImage,
    imageScaleMode,
    onImageScaleModeChange,
    imageSource,
    imageImportError,
    imageSourceReady,
}: ImageSourceControlsProps) {
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
            <p className="dither-gradient-note">Tip: You can also paste an image directly (Ctrl/Cmd+V).</p>
        </div>
    );
}
