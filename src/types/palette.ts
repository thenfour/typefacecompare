export type Variation = {
    name: string;
    deltaL: number;
    deltaC: number;
    deltaH: number;
    enabled: boolean;
};

// Core swatch shapes used throughout palette calculations
export type BaseColor = {
    h: number;
    L: number;
    C: number;
    hex: string;
    ratio: number;
};

export type SwatchVariation = {
    name: string;
    hex: string;
    L: number;
    C: number;
    h: number;
    inGamut: boolean;
};

export type PaletteSwatch = BaseColor & {
    closestIndex: number;
    closestDistance: number;
    isTooSimilar: boolean;
    variations: SwatchVariation[];
};

export type GeneratedVariation = Omit<SwatchVariation, "name">;
