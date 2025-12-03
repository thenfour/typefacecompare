const buildProxiedUrl = (url: string) => `/api/image-proxy?url=${encodeURIComponent(url)}`;

const loadImageElement = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.decoding = "async";
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Unable to load image"));
        image.src = src;
    });

export async function loadImageElementFromUrl(url: string): Promise<HTMLImageElement> {
    return loadImageElement(buildProxiedUrl(url));
}

export async function loadLocalImageElement(path: string): Promise<HTMLImageElement> {
    return loadImageElement(path);
}
