const buildProxiedUrl = (url: string) => `/api/image-proxy?url=${encodeURIComponent(url)}`;

export async function loadImageElementFromUrl(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.decoding = "async";
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Unable to load image"));
        image.src = buildProxiedUrl(url);
    });
}
